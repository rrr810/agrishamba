/**
 * dashboard.js — shared dashboard shell + role-specific views.
 * Used by dashboard.html, farmer-, buyer-, supplier- and service-dashboard.html.
 */
import { products, orders, wallet, adminService } from './api.js';
import { store } from './state.js';
import {
  qs, formatKES, formatNumber, formatDate, escapeHtml, loadingState,
  emptyState, requireAuth, initials, page
} from './ui.js';

const ROLE_LABEL = { farmer: 'Farmer', buyer: 'Buyer', supplier: 'Supplier', service: 'Service Provider', admin: 'Administrator' };

export function renderSidebar(user, active) {
  const common = [
    ['Overview', 'dashboard.html', '📊'],
    ['Marketplace', 'marketplace.html', '🛒'],
    ['My Orders', 'orders.html', '📦'],
    ['Notifications', 'notifications.html', '🔔']
  ];
  const byRole = {
    farmer: [['Farmer Home', 'farmer-dashboard.html', '🧑‍🌾'], ['Add Product', 'sell.html', '➕'], ['Farm Calculator', 'calculator.html', '🧮'], ['Advisory', 'advisory.html', '📚']],
    buyer: [['Buyer Home', 'buyer-dashboard.html', '🛍️'], ['Saved Products', 'buyer-dashboard.html#saved', '♥'], ['Market Prices', 'market-prices.html', '📈']],
    supplier: [['Supplier Home', 'supplier-dashboard.html', '🏪'], ['Add Product', 'sell.html', '➕'], ['Market Prices', 'market-prices.html', '📈']],
    service: [['Provider Home', 'service-dashboard.html', '🚜'], ['Services Directory', 'services.html', '🧰']],
    admin: [['Admin Console', 'admin.html', '🛡️']]
  };
  const account = [['Profile', 'profile.html', '👤'], ['Settings', 'settings.html', '⚙️']];
  const link = ([label, href, icon]) =>
    `<a href="${href}"${href.split('#')[0] === active ? ' class="active" aria-current="page"' : ''}><span aria-hidden="true">${icon}</span>${label}</a>`;

  return `
  <aside class="dash-side" aria-label="Dashboard navigation">
    <div class="dash-side__user">
      <div class="avatar">${initials(user.fullName)}</div>
      <div><strong>${escapeHtml(user.fullName)}</strong><span>${ROLE_LABEL[user.accountType] || user.accountType}</span></div>
    </div>
    <nav class="dash-nav">
      <p class="group-label">Workspace</p>
      ${(byRole[user.accountType] || []).map(link).join('')}
      <p class="group-label">General</p>
      ${common.map(link).join('')}
      <p class="group-label">Account</p>
      ${account.map(link).join('')}
    </nav>
  </aside>`;
}

const statCard = (label, value, meta, mod = '') =>
  `<div class="stat ${mod}"><p class="stat__label">${label}</p><p class="stat__value">${value}</p><p class="stat__meta">${meta}</p></div>`;

const quickAction = (icon, title, sub, href) =>
  `<a class="quick-action" href="${href}"><span aria-hidden="true">${icon}</span><strong>${title}</strong><small>${sub}</small></a>`;

const statusBadge = (s) => {
  const map = { Delivered: 'badge--green', 'Out for Delivery': 'badge--info', Confirmed: 'badge--info', Pending: 'badge--warn', Cancelled: 'badge--danger' };
  return `<span class="badge ${map[s] || ''}">${escapeHtml(s)}</span>`;
};

function ordersTable(rows, emptyMsg) {
  if (!rows.length) return `<p class="small muted">${emptyMsg}</p>`;
  return `<div class="table-wrap"><table class="data">
    <thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows.map((o) => `<tr>
      <td><strong>${escapeHtml(o.id)}</strong></td>
      <td>${formatDate(o.date)}</td>
      <td>${o.items.length}</td>
      <td>${formatKES(o.total)}</td>
      <td><span class="badge ${o.paymentStatus === 'Paid' ? 'badge--green' : 'badge--warn'}">${escapeHtml(o.paymentStatus)}</span></td>
      <td>${statusBadge(o.status)}</td>
      <td><a class="btn btn--outline btn--sm" href="order-details.html?id=${encodeURIComponent(o.id)}">View</a></td>
    </tr>`).join('')}</tbody></table></div>`;
}

function salesChart(ordersList) {
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
  const base = ordersList.reduce((s, o) => s + o.total, 0) || 100000;
  const values = months.map((m, i) => Math.round((base / 6) * (0.6 + ((i * 7) % 5) / 5)));
  const max = Math.max(...values);
  return `<div class="bars" role="img" aria-label="Sales by month, demo data">
    ${values.map((v, i) => `<div class="bars__col"><div class="bars__bar" style="height:${(v / max) * 100}%"></div><small>${months[i]}</small></div>`).join('')}
  </div><p class="small muted mt-3">Demo sales trend — replaced by real aggregates once orders are stored in Supabase.</p>`;
}

/* ------------------------------------------------------------ ROLE VIEWS */
async function farmerView(user) {
  const [{ data: mine }, { data: ordersList }, { data: bal }] = await Promise.all([products.mine(), orders.list(), wallet.balance()]);
  const sellerOrders = ordersList.filter((o) => o.sellerId === user.id);
  const pending = sellerOrders.filter((o) => ['Pending', 'Confirmed', 'Processing'].includes(o.status));
  const sales = sellerOrders.filter((o) => o.paymentStatus === 'Paid').reduce((s, o) => s + o.subtotal, 0);

  return `
  <div class="dash-header">
    <div><h1>Karibu, ${escapeHtml(user.fullName.split(' ')[0])} 👋</h1>
      <p class="muted small">Your farm business at a glance. ${escapeHtml(user.location || '')} ${escapeHtml(user.county || '')}</p></div>
    <a class="btn btn--primary" href="sell.html">➕ Add product</a>
  </div>

  <div class="stat-grid">
    ${statCard('Total sales', formatKES(sales), 'Paid orders, all time')}
    ${statCard('Active listings', formatNumber(mine.length), 'Products visible to buyers', 'stat--info')}
    ${statCard('Pending orders', formatNumber(pending.length), 'Awaiting your action', 'stat--gold')}
    ${statCard('Available balance', formatKES(bal.available), `${formatKES(bal.pending)} pending clearance`, 'stat--info')}
  </div>

  <section class="card">
    <div class="card__head"><h2>Quick actions</h2></div>
    <div class="card__body"><div class="quick-actions">
      ${quickAction('➕', 'Add Product', 'List new produce', 'sell.html')}
      ${quickAction('📦', 'View Orders', 'Track buyer orders', 'orders.html')}
      ${quickAction('🧮', 'Farm Calculator', 'Plan season costs', 'calculator.html')}
      ${quickAction('📚', 'Advisory', 'Read farming guides', 'advisory.html')}
      ${quickAction('🛒', 'Marketplace', 'See what buyers want', 'marketplace.html')}
    </div></div>
  </section>

  <section class="card">
    <div class="card__head"><h2>Recent orders</h2><a class="btn btn--outline btn--sm" href="orders.html">All orders</a></div>
    <div class="card__body">${ordersTable(sellerOrders.slice(0, 5), 'No orders yet. Share your listings to attract buyers.')}</div>
  </section>

  <div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <section class="card"><div class="card__head"><h2>Sales summary</h2><span class="badge badge--demo">Demo</span></div>
      <div class="card__body">${salesChart(sellerOrders)}</div></section>
    <section class="card"><div class="card__head"><h2>My products</h2><a class="btn btn--outline btn--sm" href="sell.html">Manage</a></div>
      <div class="card__body">${mine.length ? mine.slice(0, 5).map((p) => `
        <div class="list-row">
          <img class="list-row__img" src="${p.images?.[0] || ''}" alt="" loading="lazy" data-emoji="${p.emoji || '🌿'}" data-label="${escapeHtml(p.name)}">
          <div class="list-row__main"><strong>${escapeHtml(p.name)}</strong><small>${formatKES(p.price)} / ${escapeHtml(p.unit)} · ${formatNumber(p.quantity)} left</small></div>
          <a class="btn btn--ghost btn--sm" href="product.html?id=${encodeURIComponent(p.id)}">View</a></div>`).join('')
        : emptyState('No listings yet', 'Publish your first product to start selling.', { href: 'sell.html', label: 'Add a product' })}</div></section>
  </div>`;
}

async function buyerView(user) {
  const { data: ordersList } = await orders.list();
  const mine = ordersList.filter((o) => o.userId === user.id || user.accountType === 'buyer');
  const active = mine.filter((o) => !['Delivered', 'Cancelled'].includes(o.status));
  const spend = mine.filter((o) => o.paymentStatus === 'Paid').reduce((s, o) => s + o.total, 0);
  const favIds = store.getFavorites();
  const saved = store.getProducts().filter((p) => favIds.includes(p.id));
  const { data: recommended } = await products.list({ perPage: 4, sort: 'rating' });

  return `
  <div class="dash-header">
    <div><h1>Welcome back, ${escapeHtml(user.fullName.split(' ')[0])}</h1>
      <p class="muted small">Sourcing overview and saved suppliers.</p></div>
    <a class="btn btn--primary" href="marketplace.html">Browse marketplace</a>
  </div>

  <div class="stat-grid">
    ${statCard('Total spend', formatKES(spend), 'Paid orders, all time')}
    ${statCard('Active orders', formatNumber(active.length), 'In progress right now', 'stat--info')}
    ${statCard('Saved products', formatNumber(saved.length), 'Your shortlist', 'stat--gold')}
    ${statCard('Orders placed', formatNumber(mine.length), 'Lifetime orders', 'stat--info')}
  </div>

  <section class="card"><div class="card__head"><h2>Quick actions</h2></div>
    <div class="card__body"><div class="quick-actions">
      ${quickAction('🛒', 'Browse Marketplace', 'Find produce & inputs', 'marketplace.html')}
      ${quickAction('📦', 'View Orders', 'Track deliveries', 'orders.html')}
      ${quickAction('♥', 'Saved Products', 'Your shortlist', 'buyer-dashboard.html#saved')}
      ${quickAction('📈', 'Market Prices', 'Compare reference prices', 'market-prices.html')}
    </div></div></section>

  <section class="card"><div class="card__head"><h2>Recent purchases</h2><a class="btn btn--outline btn--sm" href="orders.html">All orders</a></div>
    <div class="card__body">${ordersTable(mine.slice(0, 5), 'No purchases yet. Your orders will appear here.')}</div></section>

  <section class="card" id="saved"><div class="card__head"><h2>Saved products</h2><span class="small muted">${saved.length} saved</span></div>
    <div class="card__body">${saved.length ? saved.map((p) => `
      <div class="list-row">
        <img class="list-row__img" src="${p.images?.[0] || ''}" alt="" loading="lazy" data-emoji="${p.emoji}" data-label="${escapeHtml(p.name)}">
        <div class="list-row__main"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.seller)} · ${escapeHtml(p.county)}</small></div>
        <div class="flex gap-2"><span class="badge">${formatKES(p.price)}</span>
        <a class="btn btn--outline btn--sm" href="product.html?id=${encodeURIComponent(p.id)}">View</a></div></div>`).join('')
      : emptyState('Nothing saved yet', 'Tap the heart on any listing to save it here for quick reordering.', { href: 'marketplace.html', label: 'Find products' })}</div></section>

  <section class="card"><div class="card__head"><h2>Recommended for you</h2><span class="badge badge--demo">Demo ranking</span></div>
    <div class="card__body"><div class="product-grid">${recommended.rows.map((p) => `
      <a class="quick-action" href="product.html?id=${encodeURIComponent(p.id)}">
        <span aria-hidden="true">${p.emoji}</span><strong>${escapeHtml(p.name)}</strong>
        <small>${formatKES(p.price)} / ${escapeHtml(p.unit)} · ${escapeHtml(p.county)}</small></a>`).join('')}</div></div></section>`;
}

async function supplierView(user) {
  const [{ data: mine }, { data: ordersList }] = await Promise.all([products.mine(), orders.list()]);
  const sellerOrders = ordersList.filter((o) => o.sellerId === user.id);
  const revenue = sellerOrders.filter((o) => o.paymentStatus === 'Paid').reduce((s, o) => s + o.subtotal, 0);
  const lowStock = mine.filter((p) => p.quantity < 50);
  const customers = new Set(sellerOrders.map((o) => o.userId)).size;

  return `
  <div class="dash-header">
    <div><h1>Supplier dashboard</h1><p class="muted small">${escapeHtml(user.fullName)} · ${escapeHtml(user.county || 'Kenya')}</p></div>
    <a class="btn btn--primary" href="sell.html">➕ Add input product</a>
  </div>

  <div class="stat-grid">
    ${statCard('Revenue', formatKES(revenue), 'Paid supplier orders')}
    ${statCard('Listed inputs', formatNumber(mine.length), 'Seeds, fertilizer, feed, tools', 'stat--info')}
    ${statCard('Customers', formatNumber(customers), 'Unique buyers', 'stat--gold')}
    ${statCard('Low stock items', formatNumber(lowStock.length), 'Below 50 units', lowStock.length ? 'stat--danger' : '')}
  </div>

  <section class="card"><div class="card__head"><h2>Orders</h2><a class="btn btn--outline btn--sm" href="orders.html">All orders</a></div>
    <div class="card__body">${ordersTable(sellerOrders.slice(0, 6), 'No supplier orders yet.')}</div></section>

  <section class="card"><div class="card__head"><h2>Stock levels</h2><a class="btn btn--outline btn--sm" href="sell.html">Update stock</a></div>
    <div class="card__body">${mine.length ? mine.map((p) => {
      const pct = Math.min(100, (p.quantity / 400) * 100);
      return `<div class="mb-4"><div class="flex justify-between small"><strong>${escapeHtml(p.name)}</strong>
        <span class="${p.quantity < 50 ? 'trend-down' : 'muted'}">${formatNumber(p.quantity)} ${escapeHtml(p.unit)}</span></div>
        <div class="progress mt-2"><span style="width:${pct}%"></span></div></div>`;
    }).join('') : emptyState('No inputs listed', 'Add seeds, fertilizer, feed or equipment to start supplying farmers.', { href: 'sell.html', label: 'Add a product' })}</div></section>

  <section class="card"><div class="card__head"><h2>Sales summary</h2><span class="badge badge--demo">Demo</span></div>
    <div class="card__body">${salesChart(sellerOrders)}</div></section>`;
}

async function serviceView(user) {
  const svcs = store.getServices().filter((s) => s.providerId === user.id);
  const all = store.getServices();
  const list = svcs.length ? svcs : all.slice(0, 3);
  return `
  <div class="dash-header">
    <div><h1>Service provider dashboard</h1><p class="muted small">Transport, machinery, storage, labour and professional services.</p></div>
    <a class="btn btn--primary" href="services.html#list-service">➕ List a service</a>
  </div>
  <div class="stat-grid">
    ${statCard('Listed services', formatNumber(list.length), 'Visible in the directory')}
    ${statCard('Booking requests', '0', 'Bookings go live with the backend', 'stat--gold')}
    ${statCard('Average rating', (list.reduce((s, x) => s + x.rating, 0) / (list.length || 1)).toFixed(1), 'From demo reviews', 'stat--info')}
    ${statCard('Counties served', formatNumber(new Set(list.map((s) => s.county)).size), 'Coverage area', 'stat--info')}
  </div>
  <section class="card"><div class="card__head"><h2>My services</h2><a class="btn btn--outline btn--sm" href="services.html">Directory</a></div>
    <div class="card__body">${list.map((s) => `
      <div class="list-row">
        <div class="list-row__main"><strong>${s.emoji} ${escapeHtml(s.name)}</strong><small>${escapeHtml(s.location)}, ${escapeHtml(s.county)} · ${formatKES(s.price)} per ${escapeHtml(s.unit)}</small></div>
        <a class="btn btn--outline btn--sm" href="service-detail.html?id=${encodeURIComponent(s.id)}">View</a></div>`).join('')}
      <p class="dash-note mt-4">Booking management, calendars and payouts require the backend. Listings and enquiries work in demo mode.</p>
    </div></section>`;
}

async function adminSummary() {
  const { data: m } = await adminService.metrics();
  return `
  <div class="dash-header"><div><h1>Platform overview</h1><p class="muted small">Administrator view (demo metrics).</p></div>
    <a class="btn btn--primary" href="admin.html">Open admin console</a></div>
  <div class="stat-grid">
    ${statCard('Total users', formatNumber(m.users), 'All account types')}
    ${statCard('Products', formatNumber(m.products), 'Live listings', 'stat--info')}
    ${statCard('Orders', formatNumber(m.orders), 'All time', 'stat--gold')}
    ${statCard('Revenue', formatKES(m.revenue), 'Paid orders', 'stat--info')}
  </div>`;
}

/* ------------------------------------------------------------ BOOTSTRAP */
export async function mountDashboard(forcedRole) {
  const { requireRole, requireUser } = await import('./guards.js');

  // A role-specific dashboard enforces that role.
  // dashboard.html (no forcedRole) just needs any signed-in user.
  const user = forcedRole
    ? await requireRole([forcedRole])
    : await requireUser();

  if (!user) return; // guard already redirected or rendered the blocked card

  const root = qs('#dashRoot');
  const sideMount = qs('#dashSide');
  const role = forcedRole || user.accountType;
  const file = location.pathname.split('/').pop();

  if (sideMount) sideMount.outerHTML = renderSidebar(user, file);
  root.innerHTML = loadingState('Loading your dashboard…');

  const views = {
    farmer: farmerView, buyer: buyerView, supplier: supplierView,
    service: serviceView, rider: serviceView, admin: adminSummary
  };
  const view = views[role] || buyerView;

  try {
    root.innerHTML = await view(user);
  } catch (err) {
    console.error('[dashboard]', err);
    root.innerHTML = `<div class="card card--pad">
      <div class="state state--error">
        <div class="state__icon" aria-hidden="true">⛔</div>
        <h3>Unable to load the dashboard</h3>
        <p>${escapeHtml(err.message || 'Something went wrong.')}</p>
        <button class="btn btn--outline mt-3" onclick="location.reload()">Reload</button>
      </div></div>`;
  }
}
