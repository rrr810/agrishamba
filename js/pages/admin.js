/** admin.js — admin console UI shell (metrics + management tables). */
import { adminService, orders, products } from '../api.js';
import { store } from '../state.js';
import { demoUsers, advisoryCategories, demoArticles } from '../../data/demo-data.js';
import { CATEGORIES } from '../config.js';
import { qs, qsa, formatKES, formatNumber, formatDate, escapeHtml, loadingState, toast, confirmDialog } from '../ui.js';

const root = qs('#adminRoot');
const stat = (label, value, meta, mod = '') =>
  `<div class="stat ${mod}"><p class="stat__label">${label}</p><p class="stat__value">${value}</p><p class="stat__meta">${meta}</p></div>`;

const TABS = [['users', 'Users'], ['products', 'Products'], ['orders', 'Orders'], ['reports', 'Reports'], ['categories', 'Categories'], ['advisory', 'Advisory Content']];

async function init() {
  root.innerHTML = loadingState('Loading platform metrics…');
  const { data: m } = await adminService.metrics();
  root.innerHTML = `
    <div class="stat-grid mb-5">
      ${stat('Total users', formatNumber(m.users), 'All account types')}
      ${stat('Farmers', formatNumber(m.farmers), 'Selling produce', 'stat--info')}
      ${stat('Buyers', formatNumber(m.buyers), 'Sourcing produce', 'stat--info')}
      ${stat('Suppliers', formatNumber(m.suppliers), 'Input businesses', 'stat--gold')}
      ${stat('Products', formatNumber(m.products), 'Live listings')}
      ${stat('Orders', formatNumber(m.orders), 'All time', 'stat--info')}
      ${stat('Revenue', formatKES(m.revenue), 'Paid orders', 'stat--gold')}
      ${stat('Pending reports', formatNumber(m.pendingReports), 'Awaiting moderation', 'stat--danger')}
    </div>
    <div class="tabs mb-4" id="adminTabs" role="tablist">
      ${TABS.map(([v, l], i) => `<button class="tab ${i === 0 ? 'active' : ''}" role="tab" aria-selected="${i === 0}" data-tab="${v}">${l}</button>`).join('')}
    </div>
    <div class="card" id="adminPanel" role="tabpanel"></div>`;

  qs('#adminTabs').addEventListener('click', (e) => {
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
  panel.innerHTML = loadingState('Loading…');

  if (tab === 'users') {
    panel.innerHTML = `<div class="card__head"><h2>Users</h2><span class="badge badge--demo">Demo records</span></div>
      ${table(['Name', 'Email', 'Type', 'County', 'Verified', 'Joined', 'Action'],
      demoUsers.map((u) => `<tr>
        <td><strong>${escapeHtml(u.fullName)}</strong></td><td>${escapeHtml(u.email)}</td>
        <td style="text-transform:capitalize">${escapeHtml(u.accountType)}</td><td>${escapeHtml(u.county)}</td>
        <td>${u.verified ? '<span class="badge badge--green">Verified</span>' : '<span class="badge badge--warn">Pending</span>'}</td>
        <td>${formatDate(u.joined)}</td>
        <td><button class="btn btn--outline btn--sm" data-action="coming-soon"
          data-message="User moderation writes to the profiles table and requires an admin-only server function.">Manage</button></td>
      </tr>`).join(''))}`;
  }

  if (tab === 'products') {
    const { data } = await products.list({ perPage: 100 });
    panel.innerHTML = `<div class="card__head"><h2>Products</h2><span class="small muted">${data.total} listings</span></div>
      ${table(['Product', 'Seller', 'Category', 'Price', 'Stock', 'County', 'Action'],
      data.rows.map((p) => `<tr>
        <td><a href="product.html?id=${encodeURIComponent(p.id)}"><strong>${escapeHtml(p.name)}</strong></a></td>
        <td>${escapeHtml(p.seller)}</td><td>${escapeHtml(p.category)}</td>
        <td>${formatKES(p.price)}</td><td>${formatNumber(p.quantity)}</td><td>${escapeHtml(p.county)}</td>
        <td><button class="btn btn--ghost btn--sm" data-del-product="${p.id}" style="color:var(--danger-600)">Remove</button></td>
      </tr>`).join(''))}`;
    panel.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-del-product]');
      if (!btn) return;
      const yes = await confirmDialog({ title: 'Remove listing', message: 'Remove this listing from the marketplace (demo only)?', confirmLabel: 'Remove', danger: true });
      if (!yes) return;
      store.deleteProduct(btn.dataset.delProduct);
      toast('Listing removed.', 'success');
      show('products');
    });
  }

  if (tab === 'orders') {
    const { data } = await orders.list();
    panel.innerHTML = `<div class="card__head"><h2>Orders</h2><span class="small muted">${data.length} orders</span></div>
      ${table(['Order', 'Date', 'Buyer', 'Total', 'Payment', 'Status', 'Action'],
      data.map((o) => `<tr>
        <td><strong>${escapeHtml(o.id)}</strong></td><td>${formatDate(o.date)}</td>
        <td>${escapeHtml(o.address?.name || '—')}</td><td>${formatKES(o.total)}</td>
        <td><span class="badge ${o.paymentStatus === 'Paid' ? 'badge--green' : 'badge--warn'}">${escapeHtml(o.paymentStatus)}</span></td>
        <td><span class="badge">${escapeHtml(o.status)}</span></td>
        <td><a class="btn btn--outline btn--sm" href="order-details.html?id=${encodeURIComponent(o.id)}">Open</a></td>
      </tr>`).join(''))}`;
  }

  if (tab === 'reports') {
    panel.innerHTML = `<div class="card__head"><h2>Reports &amp; moderation</h2><span class="badge badge--demo">Demo queue</span></div>
      ${table(['Reference', 'Type', 'Subject', 'Reported by', 'Status'], [
        ['RPT-1042', 'Listing', 'Suspicious pricing on “Water Tank 5,000L”', 'buyer@sokoshamba.demo', 'Open'],
        ['RPT-1039', 'User', 'Unresponsive seller after payment', 'buyer@sokoshamba.demo', 'Investigating'],
        ['RPT-1031', 'Payment', 'Duplicate M-Pesa charge query', 'farmer@sokoshamba.demo', 'Open']
      ].map((r) => `<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td>${escapeHtml(r[2])}</td><td>${r[3]}</td>
        <td><span class="badge badge--warn">${r[4]}</span></td></tr>`).join(''))}
      <div class="card__foot small muted">Reporting workflows write to a <code>reports</code> table with admin-only RLS policies.</div>`;
  }

  if (tab === 'categories') {
    panel.innerHTML = `<div class="card__head"><h2>Categories</h2><span class="small muted">${CATEGORIES.length} marketplace categories</span></div>
      <div class="card__body"><div class="chips">
        ${CATEGORIES.map((c) => `<span class="chip">${c.icon} ${c.name}</span>`).join('')}</div>
        <p class="small muted mt-4">Categories live in <code>js/config.js</code> for demo mode and move to a
        <code>categories</code> table in production so they can be edited without a deploy.</p>
        <button class="btn btn--outline btn--sm mt-3" data-action="coming-soon"
          data-message="Category editing requires the categories table and admin policies.">Add category</button></div>`;
  }

  if (tab === 'advisory') {
    panel.innerHTML = `<div class="card__head"><h2>Advisory content</h2><span class="small muted">${demoArticles.length} articles · ${advisoryCategories.length} topics</span></div>
      ${table(['Title', 'Category', 'Author', 'Published', 'Action'],
      demoArticles.map((a) => `<tr><td><a href="article.html?id=${encodeURIComponent(a.id)}"><strong>${escapeHtml(a.title)}</strong></a></td>
        <td>${escapeHtml(a.category)}</td><td>${escapeHtml(a.author)}</td><td>${formatDate(a.date)}</td>
        <td><button class="btn btn--outline btn--sm" data-action="coming-soon"
          data-message="Article editing requires the advisory_articles table with admin write policies.">Edit</button></td></tr>`).join(''))}`;
  }
}

init();
