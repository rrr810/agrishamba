/** admin.js — admin console UI shell (metrics + management tables). */
import { adminService, orders, products } from '../api.js';
import { store } from '../state.js';
import { getSupabase } from '../supabase-client.js';
import { advisoryCategories, demoArticles } from '../../data/demo-data.js';
import { CATEGORIES } from '../config.js';
import { qs, qsa, formatKES, formatNumber, formatDate, escapeHtml, loadingState, toast, confirmDialog } from '../ui.js';

const root = qs('#adminRoot');
const stat = (label, value, meta, mod = '') =>
  `<div class="stat ${mod}"><p class="stat__label">${label}</p><p class="stat__value">${value}</p><p class="stat__meta">${meta}</p></div>`;

const TABS = [
  ['users', 'Users'],
  ['products', 'Products'],
  ['orders', 'Orders'],
  ['reports', 'Reports'],
  ['categories', 'Categories'],
  ['advisory', 'Advisory Content']
];

async function init() {
  root.innerHTML = loadingState('Loading platform metrics…');
  let m = { users: 0, farmers: 0, buyers: 0, suppliers: 0, riders: 0, products: 0, orders: 0, revenue: 0 };
  
  try {
    const res = await adminService.metrics();
    if (res?.data) m = res.data;
  } catch (_) {}

  root.innerHTML = `
    <div class="stat-grid mb-5">
      ${stat('Total users', formatNumber(m.users), 'Registered in Supabase')}
      ${stat('Farmers', formatNumber(m.farmers), 'Selling produce', 'stat--info')}
      ${stat('Buyers', formatNumber(m.buyers), 'Sourcing produce', 'stat--info')}
      ${stat('Suppliers', formatNumber(m.suppliers), 'Input businesses', 'stat--gold')}
      ${stat('Riders & Logistics', formatNumber(m.riders || 0), 'Delivery partners', 'stat--info')}
      ${stat('Products', formatNumber(m.products), 'Live listings')}
      ${stat('Orders', formatNumber(m.orders), 'All time', 'stat--info')}
      ${stat('Revenue', formatKES(m.revenue), 'Processed volume', 'stat--gold')}
    </div>
    <div class="tabs mb-4" id="adminTabs" role="tablist">
      ${TABS.map(([v, l], i) => `<button class="tab ${i === 0 ? 'active' : ''}" role="tab" aria-selected="${i === 0}" data-tab="${v}">${l}</button>`).join('')}
    </div>
    <div class="card" id="adminPanel" role="tabpanel"></div>`;

  qs('#adminTabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    qsa('#adminTabs .tab').forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    btn.classList.add('active'); btn.setAttribute('aria-selected', 'true');
    show(btn.dataset.tab);
  });
  show('users');
}

const table = (head, rows) => `<div class="table-wrap"><table class="data">
  <thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
  <tbody>${rows}</tbody></table></div>`;

async function show(tab) {
  const panel = qs('#adminPanel');
  if (!panel) return;
  panel.innerHTML = loadingState('Loading…');

  if (tab === 'users') {
    let usersList = [];
    try {
      const sb = await getSupabase();
      if (sb) {
        const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
        if (!error && data) usersList = data;
      }
    } catch (_) {}

    panel.innerHTML = `
      <div class="card__head">
        <h2>Registered Users in Database</h2>
        <span class="badge badge--green">${usersList.length} Live Supabase Accounts</span>
      </div>
      ${usersList.length ? table(['Name', 'Email', 'Type', 'County', 'Verified', 'Joined', 'Action'],
      usersList.map((u) => `<tr>
        <td><strong>${escapeHtml(u.full_name || u.email?.split('@')[0] || 'User')}</strong></td>
        <td>${escapeHtml(u.email || '')}</td>
        <td><span class="badge badge--light" style="text-transform:capitalize">${escapeHtml(u.account_type || 'buyer')}</span></td>
        <td>📍 ${escapeHtml(u.county || 'Kenya')}</td>
        <td>${u.verified ? '<span class="badge badge--green">Verified</span>' : '<span class="badge badge--warn">Pending</span>'}</td>
        <td>${formatDate(u.created_at)}</td>
        <td><button class="btn btn--outline btn--sm" onclick="alert('User details: ${escapeHtml(u.full_name || u.email)}')">Manage</button></td>
      </tr>`).join('')) : `
        <div style="padding:28px;text-align:center">
          <p class="muted">No user profile rows found in Supabase <code>public.profiles</code> table yet.</p>
          <p class="small mt-2">Run the sync script in Supabase SQL editor to import your registered users into the profiles table.</p>
        </div>`}`;
  }

  if (tab === 'products') {
    let prods = [];
    try {
      const sb = await getSupabase();
      if (sb) {
        const { data } = await sb.from('products').select('*, seller:profiles(full_name)').order('created_at', { ascending: false });
        if (data) prods = data;
      }
    } catch (_) {}

    panel.innerHTML = `
      <div class="card__head"><h2>Live Products</h2><span class="small muted">${prods.length} database listings</span></div>
      ${prods.length ? table(['Product', 'Seller', 'Category', 'Price', 'Stock', 'County', 'Action'],
      prods.map((p) => `<tr>
        <td><a href="product.html?id=${encodeURIComponent(p.id)}"><strong>${escapeHtml(p.name)}</strong></a></td>
        <td>${escapeHtml(p.seller?.full_name || 'Farmer')}</td><td>${escapeHtml(p.category_id || '')}</td>
        <td>${formatKES(p.price)}</td><td>${formatNumber(p.quantity)} ${escapeHtml(p.unit || '')}</td><td>${escapeHtml(p.county || '')}</td>
        <td><button class="btn btn--ghost btn--sm" style="color:var(--danger-600)">Remove</button></td>
      </tr>`).join('')) : `<p class="muted" style="padding:24px;text-align:center">No products published in the database yet.</p>`}`;
  }

  if (tab === 'orders') {
    let ords = [];
    try {
      const sb = await getSupabase();
      if (sb) {
        const { data } = await sb.from('orders').select('*').order('created_at', { ascending: false });
        if (data) ords = data;
      }
    } catch (_) {}

    panel.innerHTML = `
      <div class="card__head"><h2>Orders in Database</h2><span class="small muted">${ords.length} orders</span></div>
      ${ords.length ? table(['Reference', 'Date', 'Total', 'Payment', 'Status', 'Action'],
      ords.map((o) => `<tr>
        <td><strong>${escapeHtml(o.reference || o.id)}</strong></td><td>${formatDate(o.created_at)}</td>
        <td>${formatKES(o.total)}</td>
        <td><span class="badge ${o.payment_status === 'Paid' ? 'badge--green' : 'badge--warn'}">${escapeHtml(o.payment_status || 'Pending')}</span></td>
        <td><span class="badge">${escapeHtml(o.status || 'Pending')}</span></td>
        <td><a class="btn btn--outline btn--sm" href="order-details.html?id=${encodeURIComponent(o.reference || o.id)}">Open</a></td>
      </tr>`).join('')) : `<p class="muted" style="padding:24px;text-align:center">No orders recorded in Supabase yet.</p>`}`;
  }

  if (tab === 'reports') {
    panel.innerHTML = `<div class="card__head"><h2>Reports &amp; Moderation</h2><span class="badge badge--green">All Clear</span></div>
      <p class="muted" style="padding:24px;text-align:center">No active user disputes or listing flags.</p>`;
  }

  if (tab === 'categories') {
    panel.innerHTML = `<div class="card__head"><h2>Marketplace Categories</h2><span class="small muted">${CATEGORIES.length} categories</span></div>
      <div class="card__body"><div class="chips">
        ${CATEGORIES.map((c) => `<span class="chip">${c.icon} ${c.name}</span>`).join('')}</div></div>`;
  }

  if (tab === 'advisory') {
    panel.innerHTML = `<div class="card__head"><h2>Advisory Content</h2><span class="small muted">${demoArticles.length} published guides · ${advisoryCategories.length} topics</span></div>
      ${table(['Title', 'Category', 'Author', 'Published', 'Action'],
      demoArticles.map((a) => `<tr><td><a href="advisory.html"><strong>${escapeHtml(a.title)}</strong></a></td>
        <td>${escapeHtml(a.category)}</td><td>${escapeHtml(a.author)}</td><td>${formatDate(a.date)}</td>
        <td><button class="btn btn--outline btn--sm">View Guide</button></td></tr>`).join(''))}`;
  }
}

init();