/** product.js — product detail page: gallery, quantity, actions, related items. */
import { products } from '../api.js';
import { cart } from '../cart.js';
import { store } from '../state.js';
import { CATEGORIES } from '../config.js';
import {
  qs, qsa, getParam, formatKES, formatNumber, escapeHtml, productCard,
  loadingState, errorState, toast, modal, confirmDialog, refreshHeaderBadges, page
} from '../ui.js';

const container = qs('#productContainer');
const id = getParam('id');

function template(p) {
  const cat = CATEGORIES.find((c) => c.id === p.category);
  const fav = store.isFavorite(p.id);
  return `
  <div class="product-layout">
    <div>
      <div class="gallery__main"><img id="galleryMain" src="${p.images[0]}" alt="${escapeHtml(p.name)}"
        data-emoji="${p.emoji}" data-label="${escapeHtml(p.name)}" width="800" height="600"></div>
      <div class="gallery__thumbs" role="group" aria-label="Product images">
        ${p.images.map((src, i) => `<button class="${i === 0 ? 'active' : ''}" data-src="${src}" aria-label="Show image ${i + 1}">
          <img src="${src}" alt="" loading="lazy" data-emoji="${p.emoji}" data-label="${escapeHtml(p.name)}"></button>`).join('')}
      </div>
      <div class="card card--pad mt-5">
        <h2 style="font-size:var(--fs-md)">Description</h2>
        <p class="mt-3" style="color:var(--ink-700)">${escapeHtml(p.description)}</p>
        <div class="divider"></div>
        <h3 style="font-size:var(--fs-base)">Delivery information</h3>
        <p class="small muted mt-2">${escapeHtml(p.delivery)}. Delivery cost is estimated at checkout based on quantity and destination county.
          Buyers may also arrange their own transport through the <a href="services.html">services directory</a>.</p>
      </div>
    </div>

    <div>
      <div class="card card--pad">
        <div class="flex gap-2 wrap mb-3">
          <span class="badge">${cat ? cat.icon + ' ' + cat.name : escapeHtml(p.category)}</span>
          ${p.verifiedSeller ? '<span class="badge badge--green badge--verified">Verified seller</span>' : '<span class="badge badge--warn">Unverified seller</span>'}
          <span class="badge ${p.availability === 'In Stock' ? 'badge--green' : 'badge--warn'}">${escapeHtml(p.availability)}</span>
        </div>
        <h1 style="font-size:var(--fs-2xl)">${escapeHtml(p.name)}</h1>
        <p class="price mt-3" style="font-size:2rem">${formatKES(p.price)} <small>per ${escapeHtml(p.unit)}</small></p>
        <p class="small muted">⭐ ${p.rating || 'New'} ${p.reviews ? `(${p.reviews} reviews)` : ''} · ${formatNumber(p.quantity)} ${escapeHtml(p.unit)} available</p>

        <div class="divider"></div>
        <div class="field">
          <label for="qtyInput">Quantity (${escapeHtml(p.unit)})</label>
          <div class="qty">
            <button type="button" id="qtyMinus" aria-label="Decrease quantity">−</button>
            <input id="qtyInput" type="number" min="1" max="${p.quantity}" value="1" aria-label="Quantity">
            <button type="button" id="qtyPlus" aria-label="Increase quantity">+</button>
          </div>
          <p class="hint">Order subtotal: <strong id="lineTotal">${formatKES(p.price)}</strong></p>
        </div>

        <div class="grid-2" style="gap:10px">
          <button class="btn btn--primary" data-action="add-to-cart" data-id="${p.id}" ${p.quantity ? '' : 'disabled'}>Add to Cart</button>
          <button class="btn btn--dark" id="buyNow" ${p.quantity ? '' : 'disabled'}>Buy Now</button>
        </div>
        <div class="grid-2 mt-3" style="gap:10px">
          <button class="btn btn--outline" id="contactSeller">Contact Seller</button>
          <button class="btn btn--outline" id="saveProduct" aria-pressed="${fav}">${fav ? '♥ Saved' : '♡ Save Product'}</button>
        </div>
      </div>

      <div class="seller-box mt-4">
        <div class="avatar">${escapeHtml(p.seller.split(' ').map((w) => w[0]).slice(0, 2).join(''))}</div>
        <div>
          <strong>${escapeHtml(p.seller)}</strong>
          <p class="small muted">📍 ${escapeHtml(p.location)}, ${escapeHtml(p.county)} · ${p.verifiedSeller ? 'ID &amp; phone verified' : 'Verification pending'}</p>
        </div>
      </div>

      <div class="card card--pad mt-4">
        <h3 style="font-size:var(--fs-base)" class="mb-3">Product details</h3>
        <dl class="spec-list">
          <div><dt>Category</dt><dd>${cat ? cat.name : escapeHtml(p.category)}</dd></div>
          <div><dt>Unit</dt><dd>${escapeHtml(p.unit)}</dd></div>
          <div><dt>Available quantity</dt><dd>${formatNumber(p.quantity)} ${escapeHtml(p.unit)}</dd></div>
          <div><dt>Location</dt><dd>${escapeHtml(p.location)}, ${escapeHtml(p.county)}</dd></div>
          <div><dt>Delivery</dt><dd>${escapeHtml(p.delivery)}</dd></div>
          <div><dt>Listed</dt><dd>${escapeHtml(p.createdAt)}</dd></div>
        </dl>
      </div>
      <p class="small muted mt-3">⚠️ Demo listing. Always inspect goods and agree terms before paying for high-value items.</p>
    </div>
  </div>`;
}

async function init() {
  if (!id) {
    container.innerHTML = errorState('No product was specified. Return to the marketplace to pick a listing.');
    return;
  }
  container.innerHTML = loadingState('Loading product…');
  const { data: p, error } = await products.get(id);
  if (error) {
    container.innerHTML = errorState(error.message);
    return;
  }
  document.title = `${p.name} — SokoShamba`;
  qs('#crumbName').textContent = p.name;
  container.innerHTML = template(p);
  wire(p);
  loadRelated(p);
}

function wire(p) {
  const qtyInput = qs('#qtyInput');
  const lineTotal = qs('#lineTotal');
  const sync = () => {
    let v = Math.min(Math.max(1, Number(qtyInput.value) || 1), p.quantity || 1);
    qtyInput.value = v;
    lineTotal.textContent = formatKES(v * p.price);
  };
  qs('#qtyMinus').addEventListener('click', () => { qtyInput.value = Number(qtyInput.value) - 1; sync(); });
  qs('#qtyPlus').addEventListener('click', () => { qtyInput.value = Number(qtyInput.value) + 1; sync(); });
  qtyInput.addEventListener('input', sync);

  qsa('.gallery__thumbs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      qsa('.gallery__thumbs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      qs('#galleryMain').src = btn.dataset.src;
    });
  });

  qs('#buyNow').addEventListener('click', () => {
    const res = cart.add(p, Number(qtyInput.value));
    if (!res.ok) return toast(res.message, 'error');
    refreshHeaderBadges();
    location.href = 'checkout.html';
  });

  qs('#saveProduct').addEventListener('click', (e) => {
    const now = store.toggleFavorite(p.id);
    e.currentTarget.textContent = now ? '♥ Saved' : '♡ Save Product';
    e.currentTarget.setAttribute('aria-pressed', String(now));
    toast(now ? 'Added to saved products.' : 'Removed from saved products.', 'success');
  });

  qs('#contactSeller').addEventListener('click', () => {
    modal({
      title: `Contact ${p.seller}`,
      body: `<p>Send an enquiry about <strong>${escapeHtml(p.name)}</strong>. In production this creates a message thread
        and notifies the seller by email/SMS.</p>
        <div class="field mt-4"><label for="msgText">Your message</label>
        <textarea class="textarea" id="msgText" placeholder="Hello, I am interested in 10 bags. Is the price negotiable for bulk?"></textarea></div>
        <p class="small muted">Never send payments outside the platform.</p>`,
      actions: [
        { label: 'Cancel', variant: 'btn--outline' },
        { label: 'Send enquiry', variant: 'btn--primary', onClick: (close, root) => {
          const text = root.querySelector('#msgText').value.trim();
          if (text.length < 10) { toast('Write at least 10 characters so the seller can help you.', 'warn'); return; }
          store.pushNotification({ type: 'message', title: `Enquiry sent to ${p.seller}`, body: text.slice(0, 90) });
          close();
          toast('Enquiry recorded. Messaging goes live with the backend.', 'success');
        } }
      ]
    });
  });
}

async function loadRelated(p) {
  const { data } = await products.related(p);
  if (!data || !data.length) return;
  qs('#relatedSection').hidden = false;
  qs('#relatedProducts').innerHTML = data.map(productCard).join('');
}

init();
