/** marketplace.js — search-as-you-type, filtering, sorting, pagination. */
import { products } from '../api.js';
import { CATEGORIES, COUNTIES } from '../config.js';
import { store } from '../state.js';
import {
  qs, qsa, productCard, skeletonGrid, emptyState, errorState,
  debounce, escapeHtml, page, formatNumber, formatKES
} from '../ui.js';

const params = new URLSearchParams(location.search);

const state = {
  search: params.get('q') || '',
  categories: (params.get('category') || '').split(',').filter(Boolean),
  counties: [], min: '', max: '', sort: 'newest', page: 1, perPage: 12,
  verifiedOnly: false, inStockOnly: false, accumulated: []
};

const results = qs('#productResults');
const searchInput = qs('#searchInput');

/* ============================================ SUGGESTION DROPDOWN SETUP */
function injectSuggestBox() {
  const box = qs('.search-box');
  if (!box || qs('#suggestBox')) return;
  box.style.position = 'relative';
  box.insertAdjacentHTML('beforeend', `
    <div id="suggestBox" hidden role="listbox" aria-label="Search suggestions"
      style="position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:60;
             background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
             box-shadow:var(--shadow-lg);max-height:420px;overflow:auto"></div>`);

  searchInput.setAttribute('autocomplete', 'off');
  searchInput.setAttribute('role', 'combobox');
  searchInput.setAttribute('aria-expanded', 'false');
  searchInput.setAttribute('aria-controls', 'suggestBox');
}

/** Rank products against a query — name first, then seller, then location. */
function rankMatches(query, pool, limit = 6) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return pool
    .map((p) => {
      const name = (p.name || '').toLowerCase();
      const seller = (p.seller || '').toLowerCase();
      const loc = `${p.location || ''} ${p.county || ''}`.toLowerCase();
      const cat = (p.category || '').toLowerCase();
      let score = 0;
      if (name.startsWith(q)) score += 100;
      else if (name.includes(q)) score += 60;
      if (seller.includes(q)) score += 25;
      if (loc.includes(q)) score += 15;
      if (cat.includes(q)) score += 10;
      if (p.quantity > 0) score += 3;
      if (p.verifiedSeller) score += 2;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

/** Bold the matched part of a string. */
function highlight(text, q) {
  const safe = escapeHtml(text);
  if (!q) return safe;
  const i = safe.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return safe;
  return safe.slice(0, i) +
    `<mark style="background:var(--green-100);color:var(--green-800);padding:0 2px;border-radius:3px">` +
    safe.slice(i, i + q.length) + `</mark>` + safe.slice(i + q.length);
}

let suggestIndex = -1;
let currentSuggestions = [];

function renderSuggestions(q) {
  const box = qs('#suggestBox');
  if (!box) return;

  if (!q.trim()) {
    box.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
    return;
  }

  const pool = store.getProducts();
  currentSuggestions = rankMatches(q, pool);
  suggestIndex = -1;

  // Matching categories
  const catMatches = CATEGORIES.filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 3);
  // Matching counties
  const countyMatches = COUNTIES.filter((c) =>
    c.toLowerCase().startsWith(q.toLowerCase())).slice(0, 3);

  if (!currentSuggestions.length && !catMatches.length && !countyMatches.length) {
    box.innerHTML = `<div style="padding:16px;text-align:center" class="small muted">
      No matches for "<strong>${escapeHtml(q)}</strong>". Press Enter to search anyway.</div>`;
    box.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
    return;
  }

  box.innerHTML = `
    ${currentSuggestions.length ? `
      <div style="padding:8px 12px 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;
                  color:var(--ink-400);font-weight:700">Products</div>
      ${currentSuggestions.map((p, i) => `
        <a href="${page('product.html')}?id=${encodeURIComponent(p.id)}"
           class="suggest-item" data-idx="${i}" role="option"
           style="display:flex;gap:10px;align-items:center;padding:9px 12px;text-decoration:none;color:inherit">
          <img src="${(p.images && p.images[0]) || ''}" alt="" loading="lazy"
               data-emoji="${p.emoji || '🌿'}" data-label="${escapeHtml(p.name)}"
               style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex:none;background:var(--ink-100)">
          <span style="flex:1;min-width:0">
            <span style="display:block;font-weight:650;font-size:14px">${highlight(p.name, q)}</span>
            <span style="display:block;font-size:12px;color:var(--ink-500)">
              ${escapeHtml(p.seller)} · ${escapeHtml(p.county)}</span>
          </span>
          <span style="font-weight:800;color:var(--green-700);font-size:13px;flex:none">
            ${formatKES(p.price)}</span>
        </a>`).join('')}` : ''}

    ${catMatches.length ? `
      <div style="padding:8px 12px 4px;border-top:1px solid var(--border);font-size:11px;
                  text-transform:uppercase;letter-spacing:.08em;color:var(--ink-400);font-weight:700">Categories</div>
      ${catMatches.map((c) => `
        <button class="suggest-cat" data-cat="${c.id}"
          style="display:flex;gap:10px;align-items:center;width:100%;padding:9px 12px;text-align:left">
          <span style="font-size:18px">${c.icon}</span>
          <span style="font-size:14px">${highlight(c.name, q)}</span>
        </button>`).join('')}` : ''}

    ${countyMatches.length ? `
      <div style="padding:8px 12px 4px;border-top:1px solid var(--border);font-size:11px;
                  text-transform:uppercase;letter-spacing:.08em;color:var(--ink-400);font-weight:700">Counties</div>
      ${countyMatches.map((c) => `
        <button class="suggest-county" data-county="${escapeHtml(c)}"
          style="display:flex;gap:10px;align-items:center;width:100%;padding:9px 12px;text-align:left">
          <span style="font-size:18px">📍</span>
          <span style="font-size:14px">${highlight(c, q)}</span>
        </button>`).join('')}` : ''}

    <div style="border-top:1px solid var(--border);padding:8px 12px;font-size:12px;color:var(--ink-500)">
      Press <kbd style="background:var(--ink-100);padding:1px 5px;border-radius:3px">Enter</kbd> to see all results</div>`;

  box.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');

  // Hover styling
  qsa('.suggest-item, .suggest-cat, .suggest-county', box).forEach((el) => {
    el.addEventListener('mouseenter', () => { el.style.background = 'var(--green-50)'; });
    el.addEventListener('mouseleave', () => { el.style.background = ''; });
  });

  // Category shortcut
  qsa('.suggest-cat', box).forEach((btn) => {
    btn.addEventListener('click', () => {
      state.categories = [btn.dataset.cat];
      qsa('#categoryFilters input').forEach((i) => { i.checked = i.value === btn.dataset.cat; });
      state.search = ''; searchInput.value = '';
      hideSuggestions(); state.page = 1; load();
    });
  });

  // County shortcut
  qsa('.suggest-county', box).forEach((btn) => {
    btn.addEventListener('click', () => {
      state.counties = [btn.dataset.county];
      const sel = qs('#countyFilter');
      if (sel) sel.value = btn.dataset.county;
      state.search = ''; searchInput.value = '';
      hideSuggestions(); state.page = 1; load();
    });
  });
}

function hideSuggestions() {
  const box = qs('#suggestBox');
  if (box) { box.hidden = true; searchInput.setAttribute('aria-expanded', 'false'); }
  suggestIndex = -1;
}

function moveSuggestion(dir) {
  const items = qsa('#suggestBox .suggest-item');
  if (!items.length) return;
  items.forEach((el) => { el.style.background = ''; });
  suggestIndex = (suggestIndex + dir + items.length) % items.length;
  const active = items[suggestIndex];
  active.style.background = 'var(--green-50)';
  active.scrollIntoView({ block: 'nearest' });
}

/* ============================================================== FILTERS */
function buildFilters() {
  qs('#categoryFilters').innerHTML = CATEGORIES.map((c) => `
    <label class="filter-option">
      <input type="checkbox" value="${c.id}" ${state.categories.includes(c.id) ? 'checked' : ''}>
      <span aria-hidden="true">${c.icon}</span> ${c.name}
    </label>`).join('');
  qs('#countyFilter').insertAdjacentHTML('beforeend',
    COUNTIES.map((c) => `<option>${c}</option>`).join(''));
  searchInput.value = state.search;
}

function activeChips() {
  const chips = [];
  state.categories.forEach((c) =>
    chips.push({ label: CATEGORIES.find((x) => x.id === c)?.name || c, type: 'category', value: c }));
  state.counties.forEach((c) => chips.push({ label: c, type: 'county', value: c }));
  if (state.search) chips.push({ label: `"${state.search}"`, type: 'search' });
  if (state.min) chips.push({ label: `Min ${formatKES(state.min)}`, type: 'min' });
  if (state.max) chips.push({ label: `Max ${formatKES(state.max)}`, type: 'max' });
  if (state.verifiedOnly) chips.push({ label: 'Verified sellers', type: 'verified' });
  if (state.inStockOnly) chips.push({ label: 'In stock', type: 'stock' });
  qs('#activeChips').innerHTML = chips.map((c) =>
    `<button class="chip active" data-chip="${c.type}" data-value="${c.value || ''}">${escapeHtml(c.label)} ✕</button>`).join('');
}

/* ================================================================= LOAD */
async function load({ append = false } = {}) {
  if (!append) results.innerHTML = skeletonGrid(8);
  const { data, error } = await products.list(state);
  if (error) {
    results.innerHTML = errorState(error.message, 'id="retryBtn"');
    qs('#retryBtn')?.addEventListener('click', () => load());
    return;
  }

  let rows = data.rows;
  if (state.verifiedOnly) rows = rows.filter((p) => p.verifiedSeller);
  if (state.inStockOnly) rows = rows.filter((p) => p.quantity > 0);

  state.accumulated = append ? [...state.accumulated, ...rows] : rows;

  if (!state.accumulated.length) {
    results.innerHTML = emptyState('No products found',
      'Try a different search term, widen your price range or clear the filters.',
      { href: page('marketplace.html'), label: 'Reset marketplace' });
    qs('#resultCount').textContent = '';
    qs('#pagination').innerHTML = '';
    qs('#loadMoreWrap').hidden = true;
    activeChips();
    return;
  }

  results.innerHTML = `<div class="product-grid">${state.accumulated.map(productCard).join('')}</div>`;
  qs('#resultCount').textContent =
    `Showing ${formatNumber(state.accumulated.length)} of ${formatNumber(data.total)} listings`;
  qs('#loadMoreWrap').hidden = state.page >= data.pages;
  renderPagination(data.pages);
  activeChips();
}

function renderPagination(pages) {
  const nav = qs('#pagination');
  if (pages <= 1) { nav.innerHTML = ''; return; }
  let html = `<button data-p="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>`;
  for (let i = 1; i <= pages; i++) {
    html += `<button data-p="${i}" class="${i === state.page ? 'active' : ''}"
      aria-label="Page ${i}" ${i === state.page ? 'aria-current="page"' : ''}>${i}</button>`;
  }
  html += `<button data-p="${state.page + 1}" ${state.page === pages ? 'disabled' : ''} aria-label="Next page">›</button>`;
  nav.innerHTML = html;
}

/* =============================================================== EVENTS */
buildFilters();
injectSuggestBox();
load();

/* Live suggestions — instant, from the local cache */
searchInput.addEventListener('input', (e) => {
  renderSuggestions(e.target.value);
});

/* Debounced full search against the server */
searchInput.addEventListener('input', debounce((e) => {
  state.search = e.target.value;
  state.page = 1;
  load();
}, 320));

/* Keyboard nav in the dropdown */
searchInput.addEventListener('keydown', (e) => {
  const box = qs('#suggestBox');
  if (!box || box.hidden) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); moveSuggestion(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveSuggestion(-1); }
  else if (e.key === 'Enter') {
    const items = qsa('#suggestBox .suggest-item');
    if (suggestIndex >= 0 && items[suggestIndex]) {
      e.preventDefault();
      location.href = items[suggestIndex].href;
    } else {
      hideSuggestions();
    }
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
});

searchInput.addEventListener('focus', () => {
  if (searchInput.value.trim()) renderSuggestions(searchInput.value);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-box')) hideSuggestions();
});

qs('#categoryFilters').addEventListener('change', () => {
  state.categories = qsa('#categoryFilters input:checked').map((i) => i.value);
  state.page = 1; load();
});

qs('#countyFilter').addEventListener('change', (e) => {
  state.counties = e.target.value ? [e.target.value] : [];
  state.page = 1; load();
});

qs('#applyPrice').addEventListener('click', () => {
  state.min = qs('#minPrice').value;
  state.max = qs('#maxPrice').value;
  state.page = 1; load();
});

qs('#sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; load(); });
qs('#verifiedOnly').addEventListener('change', (e) => { state.verifiedOnly = e.target.checked; state.page = 1; load(); });
qs('#inStockOnly').addEventListener('change', (e) => { state.inStockOnly = e.target.checked; state.page = 1; load(); });

qs('#clearFilters').addEventListener('click', () => {
  Object.assign(state, {
    search: '', categories: [], counties: [], min: '', max: '',
    sort: 'newest', page: 1, verifiedOnly: false, inStockOnly: false
  });
  qsa('#categoryFilters input').forEach((i) => { i.checked = false; });
  qs('#countyFilter').value = ''; qs('#minPrice').value = ''; qs('#maxPrice').value = '';
  searchInput.value = ''; qs('#sortSelect').value = 'newest';
  qs('#verifiedOnly').checked = false; qs('#inStockOnly').checked = false;
  hideSuggestions();
  load();
});

qs('#activeChips').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-chip]');
  if (!chip) return;
  const { chip: type, value } = chip.dataset;
  if (type === 'category') {
    state.categories = state.categories.filter((c) => c !== value);
    qsa('#categoryFilters input').forEach((i) => { if (i.value === value) i.checked = false; });
  }
  if (type === 'county') { state.counties = []; qs('#countyFilter').value = ''; }
  if (type === 'search') { state.search = ''; searchInput.value = ''; }
  if (type === 'min') { state.min = ''; qs('#minPrice').value = ''; }
  if (type === 'max') { state.max = ''; qs('#maxPrice').value = ''; }
  if (type === 'verified') { state.verifiedOnly = false; qs('#verifiedOnly').checked = false; }
  if (type === 'stock') { state.inStockOnly = false; qs('#inStockOnly').checked = false; }
  state.page = 1; load();
});

qs('#loadMoreBtn').addEventListener('click', () => { state.page += 1; load({ append: true }); });

qs('#pagination').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-p]');
  if (!btn) return;
  state.page = Number(btn.dataset.p);
  load();
  window.scrollTo({ top: 200, behavior: 'smooth' });
});

const toggle = qs('#filtersToggle');
toggle.addEventListener('click', () => {
  const open = qs('#filterPanel').classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});