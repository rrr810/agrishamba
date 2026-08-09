/**
 * ui.js — Reusable UI primitives (no framework).
 * renderHeader / renderFooter / toast / modal / states / product cards.
 */
import { APP, isDemo } from './config.js';
import { store } from './state.js';

/* ------------------------------------------------------------- helpers */
export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function url(path) {
  const inPages = location.pathname.includes('/pages/');
  const clean = String(path).replace(/^\/+/, '');
  return (inPages ? '../' : './') + clean;
}
export function page(name) { return url('pages/' + name); }

export function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export const formatKES = (n) =>
  'KES ' + Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 });

export const formatNumber = (n) => Number(n || 0).toLocaleString('en-KE');

export function formatDate(value) {
  const d = new Date(value);
  if (isNaN(d)) return String(value ?? '');
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(value) {
  const d = new Date(String(value).replace(' ', 'T'));
  if (isNaN(d)) return '';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export function debounce(fn, wait = 280) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); };
}

export const initials = (name = '?') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');

/* -------------------------------------------------------------- HEADER */
const NAV_LINKS = [
  { label: 'Home', href: 'index.html', root: true },
  { label: 'Marketplace', href: 'pages/marketplace.html' },
  { label: 'Start Farming', href: 'pages/start-farming.html' },
  { label: 'Farm Tools', href: 'pages/farm-tools.html' },
  { label: 'Advisory', href: 'pages/advisory.html' },
  { label: 'Services', href: 'pages/services.html' },
  { label: 'About', href: 'pages/about.html' }
];

/** Where each account type's "My Dashboard" link should point. */
const ROLE_HOME = {
  farmer: 'farmer-dashboard.html',
  buyer: 'buyer-dashboard.html',
  supplier: 'supplier-dashboard.html',
  rider: 'rider-dashboard.html',
  service: 'service-dashboard.html',
  admin: 'admin.html'
};

function currentFile() {
  const parts = location.pathname.split('/');
  return parts[parts.length - 1] || 'index.html';
}

export function renderHeader(activeKey = '') {
  const mount = qs('#site-header');
  if (!mount) return;
  const user = store.getUser();
  const cartCount = store.cartCount();
  const unread = store.unreadCount();
  const file = currentFile();

  const links = NAV_LINKS.map((l) => {
    const target = l.href.split('#')[0].split('/').pop();
    const active = target === file && (activeKey ? activeKey === l.label : true);
    return `<a href="${url(l.href)}"${active ? ' class="active" aria-current="page"' : ''}>${l.label}</a>`;
  }).join('');

  mount.innerHTML = `
  ${isDemo() ? `<div class="demo-ribbon" role="status">Demo mode — no backend connected. All data is sample data stored in your browser.</div>` : ''}
  <header class="site-header">
    <div class="container site-header__inner">
      <a class="brand" href="${url('index.html')}" aria-label="SokoShamba home">
        <span class="brand__mark" aria-hidden="true">🌿</span>
        <span class="brand__text">SokoShamba<small>Agri Marketplace</small></span>
      </a>
      <button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="primaryNav" aria-label="Toggle navigation"><span></span></button>
      <nav class="nav" id="primaryNav" aria-label="Primary">${links}</nav>
      <div class="header-actions">
        <a class="icon-btn" href="${page('cart.html')}" aria-label="Cart (${cartCount} items)" title="Cart">🛒
          <span class="badge-dot" id="cartBadge"${cartCount ? '' : ' hidden'}>${cartCount}</span></a>
        <div class="dropdown">
          <button class="icon-btn" id="notifBtn" aria-haspopup="true" aria-expanded="false" aria-label="Notifications (${unread} unread)">🔔
            <span class="badge-dot" id="notifBadge"${unread ? '' : ' hidden'}>${unread}</span></button>
          <div class="dropdown__panel" id="notifPanel" hidden role="dialog" aria-label="Notifications"></div>
        </div>
        ${user ? `
        <div class="dropdown">
          <button class="avatar" id="accountBtn" aria-haspopup="true" aria-expanded="false" aria-label="Account menu">${initials(user.fullName)}</button>
          <div class="dropdown__panel" id="accountPanel" hidden role="menu" style="width:250px">
            <div style="padding:10px 10px 12px;border-bottom:1px solid var(--border)">
              <strong style="display:block">${escapeHtml(user.fullName)}</strong>
              <small class="muted" style="text-transform:capitalize">${escapeHtml(user.accountType)} account</small>
            </div>
            <a class="menu-item" role="menuitem" href="${page(ROLE_HOME[user.accountType] || 'dashboard.html')}">📊 My Dashboard</a>
            <a class="menu-item" role="menuitem" href="${page('orders.html')}">📦 My Orders</a>
            ${['farmer', 'supplier', 'admin'].includes(user.accountType)
              ? `<a class="menu-item" role="menuitem" href="${page('sell.html')}">➕ Sell a Product</a>` : ''}
            ${['rider', 'service', 'admin'].includes(user.accountType)
              ? `<a class="menu-item" role="menuitem" href="${page('services.html')}#list-service">🧰 List a Service</a>` : ''}
            ${['rider', 'admin'].includes(user.accountType)
              ? `<a class="menu-item" role="menuitem" href="${page('rider-dashboard.html')}">🚛 Delivery Jobs</a>` : ''}
            <a class="menu-item" role="menuitem" href="${page('profile.html')}">👤 Profile</a>
            <a class="menu-item" role="menuitem" href="${page('settings.html')}">⚙️ Settings</a>
            <a class="menu-item" role="menuitem" href="${page('notifications.html')}">🔔 Notifications</a>
            <button class="menu-item" role="menuitem" data-action="logout" style="color:var(--danger-600)">↩ Log out</button>
          </div>
        </div>` : `
        <a class="btn btn--ghost btn--sm" href="${page('login.html')}">Login</a>
        <a class="btn btn--primary btn--sm" href="${page('register.html')}">Get Started</a>`}
      </div>
    </div>
  </header>`;

  wireHeader();
}

function wireHeader() {
  const toggle = qs('#navToggle');
  const nav = qs('#primaryNav');
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  setupDropdown('#notifBtn', '#notifPanel', renderNotifPanel);
  setupDropdown('#accountBtn', '#accountPanel');
}

function setupDropdown(btnSel, panelSel, onOpen) {
  const btn = qs(btnSel), panel = qs(panelSel);
  if (!btn || !panel) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = panel.hidden;
    qsa('.dropdown__panel').forEach((p) => { p.hidden = true; });
    qsa('[aria-haspopup="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    panel.hidden = !willOpen;
    btn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen && onOpen) onOpen(panel);
  });
  panel.addEventListener('click', (e) => {
    // Let [data-action] buttons (like Log out) bubble up to app.js.
    if (!e.target.closest('[data-action]')) {
      e.stopPropagation();
    }
  });
  document.addEventListener('click', () => { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
}

const NOTIF_ICONS = { order: '📦', payment: '💳', message: '💬', listing: '🏷️', system: '⚙️' };

export function renderNotifPanel(panel) {
  const items = store.getNotifications().slice(0, 6);
  panel.innerHTML = `
    <div class="dropdown__head">
      <h4>Notifications</h4>
      <button class="btn btn--ghost btn--sm" data-action="mark-all-read">Mark all read</button>
    </div>
    ${items.length ? items.map((n) => `
      <button class="notif-item ${n.read ? '' : 'unread'}" data-action="read-notification" data-id="${n.id}">
        <span class="notif-item__icon" aria-hidden="true">${NOTIF_ICONS[n.type] || '🔔'}</span>
        <span>
          <span class="notif-item__title">${escapeHtml(n.title)}</span>
          <span class="notif-item__body">${escapeHtml(n.body)}</span>
          <time>${timeAgo(n.at)}</time>
        </span>
      </button>`).join('') : `<p class="muted small" style="padding:18px;text-align:center">No notifications yet.</p>`}
    <div style="border-top:1px solid var(--border);padding:8px">
      <a class="btn btn--outline btn--sm btn--block" href="${page('notifications.html')}">View all notifications</a>
    </div>`;
}

export function refreshHeaderBadges() {
  const cart = qs('#cartBadge'), notif = qs('#notifBadge');
  const c = store.cartCount(), u = store.unreadCount();
  if (cart) { cart.textContent = c; cart.hidden = !c; }
  if (notif) { notif.textContent = u; notif.hidden = !u; }
}

/* -------------------------------------------------------------- FOOTER */
export function renderFooter() {
  const mount = qs('#site-footer');
  if (!mount) return;
  const col = (title, links) => `
    <div><h5>${title}</h5><ul>${links.map(([l, h]) => `<li><a href="${h}">${l}</a></li>`).join('')}</ul></div>`;

  mount.innerHTML = `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <a class="brand" href="${url('index.html')}"><span class="brand__mark" aria-hidden="true">🌿</span>
            <span class="brand__text">SokoShamba<small>Agri Marketplace</small></span></a>
          <p class="small" style="margin-top:14px;max-width:300px;color:#a8c9b6">${APP.tagline}. A digital marketplace and farm management platform built for Kenyan agriculture.</p>
          <p class="small" style="margin-top:14px;color:#cfe6d9">
            📧 <a href="mailto:${APP.supportEmail}" style="color:#cfe6d9">${APP.supportEmail}</a><br>
            💬 <a href="mailto:${APP.businessEmail}" style="color:#cfe6d9">${APP.businessEmail}</a><br>
            📱 <a href="tel:${APP.supportPhone.replace(/\s/g, '')}" style="color:#cfe6d9">${APP.supportPhone}</a><br>
            📍 ${APP.officeLocation}
          </p>
          <p class="small" style="margin-top:10px">
            <a href="https://wa.me/${APP.whatsapp}" target="_blank" rel="noopener" style="color:#7bd6a4">
              💚 Chat on WhatsApp
            </a>
          </p>
        </div>
        ${col('Platform', [['Marketplace', page('marketplace.html')], ['Sell a Product', page('sell.html')], ['Services', page('services.html')], ['Market Prices', page('market-prices.html')], ['Orders', page('orders.html')]])}
        ${col('Resources', [['🌱 Start Farming', page('start-farming.html')], ['🛠️ Farm Tools', page('farm-tools.html')], ['🧮 Cost Calculator', page('calculator.html')], ['💰 Loan Calculator', page('loan-calculator.html')]])}
        ${col('Company', [['About', page('about.html')], ['Contact', page('contact.html')], ['Register', page('register.html')], ['Login', page('login.html')]])}
        ${col('Support & Legal', [['Help &amp; FAQ', page('help.html')], ['Contact Us', page('contact.html')], ['Privacy Policy', page('privacy.html')], ['Terms of Service', page('terms.html')]])}
      </div>
      <div class="footer-bottom">
        <span>© ${APP.yearFounded}–${new Date().getFullYear()} ${APP.name}. Built in Kenya 🇰🇪 by ${APP.founder.name}.</span>
        <span>Powered by Supabase · Paystack ready · v${APP.version}</span>
      </div>
    </div>
  </footer>`;
}

/* --------------------------------------------------- WHATSAPP FLOATING BTN */
export function renderWhatsAppButton() {
  if (document.getElementById('waFloat')) return;

  const btn = document.createElement('a');
  btn.id = 'waFloat';
  btn.href = `https://wa.me/${APP.whatsapp}?text=${encodeURIComponent('Hi SokoShamba team! I need help with:')}`;
  btn.target = '_blank';
  btn.rel = 'noopener';
  btn.setAttribute('aria-label', 'Chat with SokoShamba on WhatsApp');
  btn.title = 'Chat with us on WhatsApp';
  btn.innerHTML = `
    <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
    <span class="wa-float__label">Chat with us</span>`;

  const style = document.createElement('style');
  style.textContent = `
    #waFloat{position:fixed;bottom:20px;right:20px;z-index:150;display:flex;align-items:center;gap:10px;
      background:#25D366;color:#fff;padding:12px 18px 12px 14px;border-radius:50px;
      box-shadow:0 8px 24px rgba(37,211,102,.4);text-decoration:none;font-weight:700;font-size:14px;
      transition:transform .2s ease,box-shadow .2s ease;animation:waPulse 2.4s ease-in-out infinite;}
    #waFloat:hover{transform:translateY(-3px) scale(1.03);box-shadow:0 12px 32px rgba(37,211,102,.5);
      text-decoration:none;color:#fff;}
    #waFloat:active{transform:translateY(0) scale(.98);}
    #waFloat svg{flex:none;}
    @keyframes waPulse{0%,100%{box-shadow:0 8px 24px rgba(37,211,102,.4),0 0 0 0 rgba(37,211,102,.5);}
      50%{box-shadow:0 8px 24px rgba(37,211,102,.4),0 0 0 12px rgba(37,211,102,0);}}
    @media (max-width:640px){
      #waFloat{bottom:16px;right:16px;padding:12px;}
      #waFloat .wa-float__label{display:none;}
    }
    @media print{#waFloat{display:none;}}
  `;
  document.head.appendChild(style);
  document.body.appendChild(btn);
}

/* -------------------------------------------------------------- TOASTS */
function toastStack() {
  let s = qs('.toast-stack');
  if (!s) {
    s = document.createElement('div');
    s.className = 'toast-stack';
    s.setAttribute('role', 'status');
    s.setAttribute('aria-live', 'polite');
    document.body.appendChild(s);
  }
  return s;
}

export function toast(message, type = 'success', title = '') {
  const icons = { success: '✅', error: '⛔', warn: '⚠️', info: 'ℹ️' };
  const node = document.createElement('div');
  node.className = `toast toast--${type}`;
  node.innerHTML = `<span aria-hidden="true">${icons[type] || 'ℹ️'}</span>
    <div><div class="toast__title">${escapeHtml(title || ({ success: 'Success', error: 'Something went wrong', warn: 'Heads up', info: 'Notice' }[type]))}</div>
    <div class="toast__msg">${escapeHtml(message)}</div></div>
    <button class="toast__close" aria-label="Dismiss notification">×</button>`;
  const close = () => { node.classList.add('is-out'); setTimeout(() => node.remove(), 200); };
  node.querySelector('.toast__close').addEventListener('click', close);
  toastStack().appendChild(node);
  setTimeout(close, 4600);
  return node;
}

/* --------------------------------------------------------------- MODAL */
export function modal({ title, body, actions = [], size = '' }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal__head"><h3 id="modalTitle">${escapeHtml(title)}</h3>
        <button class="modal__close" aria-label="Close dialog">×</button></div>
      <div class="modal__body">${body}</div>
      ${actions.length ? `<div class="modal__foot">${actions.map((a, i) =>
        `<button class="btn ${a.variant || 'btn--outline'}" data-idx="${i}">${escapeHtml(a.label)}</button>`).join('')}</div>` : ''}
    </div>`;
  const close = () => { backdrop.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  backdrop.querySelector('.modal__close').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey);
  backdrop.querySelectorAll('.modal__foot .btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = actions[Number(btn.dataset.idx)];
      if (action.onClick) action.onClick(close, backdrop);
      else close();
    });
  });
  document.body.appendChild(backdrop);
  setTimeout(() => backdrop.querySelector('.modal__foot .btn, .modal__close')?.focus(), 30);
  return { close, root: backdrop };
}

export function confirmDialog({ title = 'Please confirm', message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    modal({
      title,
      body: `<p>${escapeHtml(message)}</p>`,
      actions: [
        { label: 'Cancel', variant: 'btn--outline', onClick: (close) => { close(); resolve(false); } },
        { label: confirmLabel, variant: danger ? 'btn--danger' : 'btn--primary', onClick: (close) => { close(); resolve(true); } }
      ]
    });
  });
}

/* --------------------------------------------------------------- STATES */
export const loadingState = (msg = 'Loading…') =>
  `<div class="state"><div class="spinner" role="status" aria-label="${escapeHtml(msg)}"></div><p>${escapeHtml(msg)}</p></div>`;

export const emptyState = (title, msg, action) =>
  `<div class="state"><div class="state__icon" aria-hidden="true">🗂️</div><h3>${escapeHtml(title)}</h3>
   <p>${escapeHtml(msg)}</p>${action ? `<a class="btn btn--primary" href="${action.href}">${escapeHtml(action.label)}</a>` : ''}</div>`;

export const errorState = (msg = 'Unable to load this content.', retryAttr = '') =>
  `<div class="state state--error"><div class="state__icon" aria-hidden="true">⛔</div><h3>Something went wrong</h3>
   <p>${escapeHtml(msg)}</p>${retryAttr ? `<button class="btn btn--outline" ${retryAttr}>Try again</button>` : ''}</div>`;

export const skeletonGrid = (n = 8) =>
  `<div class="product-grid">${Array.from({ length: n }, () => '<div class="skeleton skeleton-card"></div>').join('')}</div>`;

export function setButtonLoading(btn, loading, loadingText = 'Working…') {
  if (!btn) return;
  if (loading) {
    btn.dataset.origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${escapeHtml(loadingText)}</span>`;
  } else {
    btn.disabled = false;
    if (btn.dataset.origHtml) btn.innerHTML = btn.dataset.origHtml;
  }
}

/* --------------------------------------------------------- PRODUCT CARD */
export function productCard(p) {
  const fav = store.isFavorite(p.id);
  const img = (p.images && p.images[0]) || '';
  return `
  <article class="product-card">
    <div class="product-card__media">
      <a href="${page('product.html')}?id=${encodeURIComponent(p.id)}" aria-label="View ${escapeHtml(p.name)}">
        <img src="${img}" alt="${escapeHtml(p.name)} from ${escapeHtml(p.seller)}" loading="lazy" decoding="async"
             data-emoji="${p.emoji || '🌿'}" data-label="${escapeHtml(p.name)}">
      </a>
      <div class="product-card__tags">
        ${p.verifiedSeller ? '<span class="badge badge--green badge--verified">Verified</span>' : ''}
        ${p.availability !== 'In Stock' ? `<span class="badge badge--warn">${escapeHtml(p.availability)}</span>` : ''}
      </div>
      <button class="fav-btn ${fav ? 'is-active' : ''}" data-action="toggle-fav" data-id="${p.id}"
        aria-pressed="${fav}" aria-label="${fav ? 'Remove from saved products' : 'Save product'}">${fav ? '♥' : '♡'}</button>
    </div>
    <div class="product-card__body">
      <h3 class="product-card__title"><a href="${page('product.html')}?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a></h3>
      <p class="product-card__meta">🧑‍🌾 <a href="${page('seller-profile.html')}?id=${encodeURIComponent(p.sellerId)}" style="color:inherit;text-decoration:none;font-weight:600">${escapeHtml(p.seller)}</a></p>
      <p class="product-card__meta">📍 ${escapeHtml(p.location)}, ${escapeHtml(p.county)}</p>
      <p class="price">${formatKES(p.price)} <small>/ ${escapeHtml(p.unit)}</small></p>
      <p class="product-card__meta">${p.quantity > 0 ? `<span class="badge badge--green">${formatNumber(p.quantity)} ${escapeHtml(p.unit)} available</span>` : '<span class="badge badge--danger">Out of stock</span>'}</p>
      <div class="product-card__actions">
        <button class="btn btn--primary btn--sm" data-action="add-to-cart" data-id="${p.id}" ${p.quantity > 0 ? '' : 'disabled'}>Add to Cart</button>
        <a class="btn btn--outline btn--sm" href="${page('product.html')}?id=${encodeURIComponent(p.id)}">View</a>
      </div>
    </div>
  </article>`;
}

/* ------------------------------------------------------ IMAGE FALLBACK */
import { placeholderImage } from '../data/demo-data.js';
export function installImageFallback(root = document) {
  root.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = '1';
    img.src = placeholderImage(img.dataset.label || img.alt || 'SokoShamba', img.dataset.emoji || '🌿');
  }, true);
}

export function getParam(key) {
  return new URLSearchParams(location.search).get(key);
}

/**
 * requireAuth() is async so it can await Supabase session hydration.
 * Page controllers must call it as `await requireAuth()`.
 */
export async function requireAuth(redirectTo) {
  const { auth } = await import('./auth.js');
  await auth.ready();
  const user = store.getUser();
  if (!user) {
    const target = redirectTo || (location.pathname.split('/').pop() + location.search);
    location.href = page('login.html') + '?next=' + encodeURIComponent(target);
    return null;
  }
  return user;
}