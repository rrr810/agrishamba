/** advisory.js — advisory listing, search, categories, saved articles and reader. */
import { advisory } from './api.js';
import { store } from './state.js';
import { advisoryCategories } from '../data/demo-data.js';
import {
  qs, qsa, getParam, escapeHtml, formatDate, loadingState, emptyState,
  errorState, toast, debounce
} from './ui.js';

const card = (a) => {
  const saved = store.getSavedArticles().includes(a.id);
  return `
  <article class="article-card">
    <a href="article.html?id=${encodeURIComponent(a.id)}" aria-label="Read ${escapeHtml(a.title)}">
      <img src="${a.image}" alt="" loading="lazy" data-emoji="📚" data-label="${escapeHtml(a.category)}"></a>
    <div class="article-card__body">
      <span class="badge badge--green">${escapeHtml(a.category)}</span>
      <h3><a href="article.html?id=${encodeURIComponent(a.id)}" style="color:inherit">${escapeHtml(a.title)}</a></h3>
      <p class="small muted">${escapeHtml(a.excerpt)}</p>
      <div class="flex items-center justify-between mt-auto pt-3">
        <span class="small muted">${formatDate(a.date)} · ${a.read} min read</span>
        <button class="btn btn--ghost btn--sm" data-save-article="${a.id}" aria-pressed="${saved}"
          aria-label="${saved ? 'Remove from saved articles' : 'Save article'}">${saved ? '♥' : '♡'}</button>
      </div>
    </div>
  </article>`;
};

/* ------------------------------------------------------------- LISTING */
const grid = qs('#articleGrid');
if (grid) {
  let category = 'All';
  let savedOnly = false;

  qs('#advCategories').innerHTML = ['All', ...advisoryCategories]
    .map((c) => `<button class="chip ${c === 'All' ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('');

  const load = async () => {
    grid.innerHTML = loadingState('Loading advisory articles…');
    const { data, error } = await advisory.list({ search: qs('#advSearch').value, category });
    if (error) return (grid.innerHTML = errorState(error.message));
    let rows = data;
    if (savedOnly) {
      const saved = store.getSavedArticles();
      rows = rows.filter((a) => saved.includes(a.id));
    }
    grid.innerHTML = rows.length ? rows.map(card).join('')
      : emptyState(savedOnly ? 'No saved articles yet' : 'No articles found',
          savedOnly ? 'Tap the heart on any article to keep it here for later.' : 'Try a different search term or category.');
  };
  load();

  qs('#advCategories').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    qsa('#advCategories .chip').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    category = btn.dataset.cat;
    load();
  });

  qs('#advSearch').addEventListener('input', debounce(load, 280));

  qs('#savedToggle').addEventListener('click', (e) => {
    savedOnly = !savedOnly;
    e.currentTarget.setAttribute('aria-pressed', String(savedOnly));
    e.currentTarget.classList.toggle('btn--primary', savedOnly);
    load();
  });

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-save-article]');
    if (!btn) return;
    const now = store.toggleSavedArticle(btn.dataset.saveArticle);
    btn.textContent = now ? '♥' : '♡';
    btn.setAttribute('aria-pressed', String(now));
    toast(now ? 'Article saved.' : 'Article removed from saved list.', 'success');
    if (savedOnly) load();
  });
}

/* -------------------------------------------------------------- READER */
const reader = qs('#articleContainer');
if (reader) {
  const id = getParam('id');
  (async () => {
    if (!id) return (reader.innerHTML = errorState('No article was specified.'));
    reader.innerHTML = loadingState('Loading article…');
    const { data: a, error } = await advisory.get(id);
    if (error) return (reader.innerHTML = errorState(error.message));
    document.title = `${a.title} — SokoShamba Advisory`;
    qs('#crumbTitle').textContent = a.title;
    const saved = store.getSavedArticles().includes(a.id);
    reader.innerHTML = `
      <header class="mt-4 mb-5" style="max-width:760px">
        <span class="badge badge--green">${escapeHtml(a.category)}</span>
        <h1 class="mt-3">${escapeHtml(a.title)}</h1>
        <p class="muted small mt-2">By ${escapeHtml(a.author)} · ${formatDate(a.date)} · ${a.read} min read</p>
        <div class="flex gap-2 mt-4">
          <button class="btn btn--outline btn--sm" id="saveArticle" aria-pressed="${saved}">${saved ? '♥ Saved' : '♡ Save article'}</button>
          <button class="btn btn--outline btn--sm" id="printArticle">🖨 Print</button>
          <a class="btn btn--ghost btn--sm" href="advisory.html">← All articles</a>
        </div>
      </header>
      <img src="${a.image}" alt="" style="border-radius:var(--radius-lg);max-height:420px;object-fit:cover;width:100%"
        data-emoji="📚" data-label="${escapeHtml(a.category)}">
      <div class="article-body mt-5">${a.body}</div>
      <div class="card card--pad mt-6" style="max-width:760px;background:var(--green-50);border-color:var(--green-100)">
        <h3 style="font-size:var(--fs-base)">Put this into practice</h3>
        <p class="small mt-2">Model the numbers for your own farm with the cost calculator, then source inputs on the marketplace.</p>
        <div class="flex gap-2 mt-3 wrap">
          <a class="btn btn--primary btn--sm" href="calculator.html">Open farm calculator</a>
          <a class="btn btn--outline btn--sm" href="marketplace.html">Find inputs</a>
        </div>
      </div>`;

    qs('#saveArticle').addEventListener('click', (e) => {
      const now = store.toggleSavedArticle(a.id);
      e.currentTarget.textContent = now ? '♥ Saved' : '♡ Save article';
      e.currentTarget.setAttribute('aria-pressed', String(now));
      toast(now ? 'Article saved to your list.' : 'Article removed.', 'success');
    });
    qs('#printArticle').addEventListener('click', () => window.print());
  })();

  const bar = qs('#readingProgress');
  window.addEventListener('scroll', () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = `${Math.min(100, (window.scrollY / (h || 1)) * 100)}%`;
  }, { passive: true });
}
