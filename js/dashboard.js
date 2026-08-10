/**
 * dashboard.js — shared dashboard shell + role-specific views.
 */
import { products, orders, wallet, adminService, deliveries } from './api.js';
import { store } from './state.js';
import { renderRouteMap } from './map.js';
import {
  qs, qsa, formatKES, formatNumber, formatDate, escapeHtml, loadingState,
  emptyState, requireAuth, initials, page, toast, confirmDialog, setButtonLoading
} from './ui.js';

const ROLE_LABEL = {
  farmer: 'Farmer',
  buyer: 'Buyer',
  supplier: 'Supplier',
  service: 'Service Provider',
  rider: 'Rider / Transporter',
  admin: 'Administrator'
};

export function renderSidebar(user, active) {
  const common = [
    ['Overview', 'dashboard.html', '📊'],
    ['Marketplace', 'marketplace.html', '🛒'],
    ['My Orders', 'orders.html', '📦'],
    ['Help & FAQ', 'help.html', '❓']
  ];
  const byRole = {
    farmer: [
      ['Farmer Home', 'farmer-dashboard.html', '🧑‍🌾'],
      ['Add Product', 'sell.html', '➕'],
      ['Farm Calculator', 'calculator.html', '🧮'],
      ['Advisory', 'advisory.html', '📚']
    ],
    buyer: [
      ['Buyer Home', 'buyer-dashboard.html', '🛍️'],
      ['Saved Products', 'buyer-dashboard.html#saved', '♥'],
      ['Market Prices', 'market-prices.html', '📈']
    ],
    supplier: [
      ['Supplier Home', 'supplier-dashboard.html', '🏪'],
      ['Add Product', 'sell.html', '➕'],
      ['Market Prices', 'market-prices.html', '📈']
    ],
    rider: [
      ['Rider Home', 'rider-dashboard.html', '🚛'],
      ['Available Jobs', 'rider-dashboard.html#available', '📦'],
      ['Active Routes', 'rider-dashboard.html#active', '🗺️'],
      ['Earnings', 'rider-dashboard.html#earnings', '💰']
    ],
    service: [
      ['Provider Home', 'service-dashboard.html', '🚜'],
      ['Services Directory', 'services.html', '🧰']
    ],
    admin: [
      ['Admin Console', 'admin.html', '🛡️']
    ]
  };
  const account = [
    ['Profile', 'profile.html', '👤'],
    ['Settings', 'settings.html', '⚙️']
  ];

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
  const map = {
    Delivered: 'badge--green',
    'Confirmed by Buyer': 'badge--green',
    'Out for Delivery': 'badge--info',
    Confirmed: 'badge--info',
    'Rider Assigned': 'badge--info',
    'Payment Received': 'badge--green',
    Pending: 'badge--warn',
    Cancelled: 'badge--danger'
  };
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

/* ---------------------------------------------------- RIDER DASHBOARD */
async function riderView(user) {
  const [{ data: availableJobs }, { data: activeJobs }, { data: completedJobs }, { data: earn }] =
    await Promise.all([
      deliveries.available(),
      deliveries.myActive(),
      deliveries.myCompleted(),
      deliveries.earnings()
    ]);

  const html = `
  <div class="dash-header">
    <div>
      <h1>Rider &amp; Logistics Hub 🚛</h1>
      <p class="muted small">${escapeHtml(user.fullName)} · Active in <strong>${escapeHtml(user.county || 'Uasin Gishu')}</strong></p>
    </div>
    <div class="flex gap-2">
      <span class="badge badge--green" style="font-size:13px;padding:6px 12px">🟢 Online &amp; Ready</span>
    </div>
  </div>

  <div class="stat-grid">
    ${statCard('Total Earned', formatKES(earn.total), 'Lifetime payouts')}
    ${statCard('Available Balance', formatKES(earn.released), 'Ready for M-Pesa withdrawal', 'stat--info')}
    ${statCard('Active Deliveries', formatNumber(activeJobs.length), 'In transit right now', activeJobs.length ? 'stat--gold' : '')}
    ${statCard('Completed Jobs', formatNumber(earn.jobs || completedJobs.length), 'Successful deliveries', 'stat--info')}
  </div>

  <!-- ACTIVE DELIVERIES -->
  <section class="card mb-6" id="active">
    <div class="card__head">
      <h2>🚀 My Active Deliveries (${activeJobs.length})</h2>
      <span class="badge ${activeJobs.length ? 'badge--info' : ''}">${activeJobs.length ? 'In Progress' : 'No active trip'}</span>
    </div>
    <div class="card__body">
      ${activeJobs.length ? activeJobs.map((j) => {
        const order = j.orders || {};
        const buyer = order.buyer || order.address || {};
        const seller = order.seller || {};
        const isPickedUp = ['picked_up', 'out_for_delivery', 'delivered'].includes(j.status);
        const isDelivered = j.status === 'delivered';

        return `
        <article class="order-card mb-4" style="border:2px solid var(--green-600);background:var(--surface)">
          <div class="order-card__head" style="background:var(--green-50)">
            <div>
              <strong style="font-size:var(--fs-md)">Job ${escapeHtml(j.id)} · Order ${escapeHtml(j.order_id || order.reference)}</strong>
              <p class="small muted">Vehicle: <strong>${escapeHtml(j.vehicle_type || 'Pickup')}</strong> · Weight: ~${j.weight_kg || 100}kg · Distance: ${j.distance_km || 40}km</p>
            </div>
            <div class="text-right">
              <span class="badge badge--green" style="font-size:14px;padding:6px 12px">Payout: ${formatKES(j.rider_earns)}</span>
              <div class="mt-1">${statusBadge(isDelivered ? 'Delivered' : isPickedUp ? 'Out for Delivery' : 'Rider Assigned')}</div>
            </div>
          </div>

          <div class="card__body">
            <div class="grid-2 gap-4 mb-4">
              <!-- PICKUP -->
              <div style="background:#f8fafc;padding:14px;border-radius:var(--radius-md);border-left:4px solid var(--green-700)">
                <div class="flex justify-between items-center mb-2">
                  <strong style="color:var(--green-900)">1. Pickup (Farmer)</strong>
                  ${isPickedUp ? '<span class="badge badge--green">✅ Picked Up</span>' : '<span class="badge badge--warn">Pending Pickup</span>'}
                </div>
                <p class="small">
                  <strong>${escapeHtml(seller.full_name || 'Farmer')}</strong><br>
                  📍 ${escapeHtml(j.pickup_location || 'Farm Depot')}, ${escapeHtml(j.pickup_county || 'County')}<br>
                  📞 ${escapeHtml(seller.phone || '+254712345001')}
                </p>
                <div class="flex gap-2 mt-3">
                  <a class="btn btn--outline btn--sm" href="tel:${escapeHtml(seller.phone || '0712345001')}">📞 Call</a>
                  ${!isPickedUp ? `<button class="btn btn--primary btn--sm" data-action="rider-pickup" data-id="${j.id}">✅ Confirm Pickup</button>` : ''}
                </div>
              </div>

              <!-- DROPOFF -->
              <div style="background:#f8fafc;padding:14px;border-radius:var(--radius-md);border-left:4px solid var(--primary-600)">
                <div class="flex justify-between items-center mb-2">
                  <strong style="color:var(--primary-900)">2. Delivery (Buyer)</strong>
                  ${isDelivered ? '<span class="badge badge--green">✅ Delivered</span>' : isPickedUp ? '<span class="badge badge--info">On the Way</span>' : '<span class="badge badge--warn">Next Step</span>'}
                </div>
                <p class="small">
                  <strong>${escapeHtml(buyer.full_name || buyer.name || 'Buyer')}</strong><br>
                  📍 ${escapeHtml(j.dropoff_location || 'Buyer Address')}, ${escapeHtml(j.dropoff_county || 'County')}<br>
                  📞 ${escapeHtml(buyer.phone || '+254712345002')}
                </p>
                <div class="flex gap-2 mt-3">
                  <a class="btn btn--outline btn--sm" href="tel:${escapeHtml(buyer.phone || '0712345002')}">📞 Call</a>
                  ${isPickedUp && !isDelivered ? `<button class="btn btn--primary btn--sm" data-action="rider-deliver" data-id="${j.id}">🎯 Confirm Delivery</button>` : ''}
                </div>
              </div>
            </div>

            <!-- MAP -->
            <div class="mt-4">
              <h3 style="font-size:var(--fs-sm);margin-bottom:8px">🗺️ Live Delivery Route</h3>
              <div class="rider-map-container"
                id="riderMap-${j.id}"
                data-pickup-county="${escapeHtml(j.pickup_county || '')}"
                data-pickup-loc="${escapeHtml(j.pickup_location || '')}"
                data-dropoff-county="${escapeHtml(j.dropoff_county || '')}"
                data-dropoff-loc="${escapeHtml(j.dropoff_location || '')}"
                data-status="${isDelivered ? 'Delivered' : isPickedUp ? 'In Transit' : 'Pickup Pending'}"></div>
            </div>
          </div>
        </article>`;
      }).join('') : `
        <div class="text-center" style="padding:24px">
          <div style="font-size:2.5rem" aria-hidden="true">🛵</div>
          <h3 class="mt-2">No active delivery right now</h3>
          <p class="small muted mt-1">Accept a delivery job from the available pool below.</p>
        </div>`}
    </div>
  </section>

  <!-- AVAILABLE JOBS POOL -->
  <section class="card mb-6" id="available">
    <div class="card__head">
      <h2>📦 Available Delivery Jobs (${availableJobs.length})</h2>
      <span class="small muted">Claim a job to lock in your payout</span>
    </div>
    <div class="card__body">
      ${availableJobs.length ? `
        <div class="grid gap-4">
          ${availableJobs.map((j) => `
            <div class="card card--pad" style="border-left:4px solid var(--green-600);box-shadow:var(--shadow-sm)">
              <div class="flex justify-between items-center wrap gap-2 mb-3">
                <div>
                  <strong>Job ${escapeHtml(j.id)}</strong> · <span class="badge badge--light">${escapeHtml(j.vehicle_type || 'Pickup')}</span>
                  ${j.isNearby ? '<span class="badge badge--green ml-2">📍 Nearby</span>' : ''}
                </div>
                <div class="price" style="font-size:var(--fs-lg);color:var(--green-800)">
                  ${formatKES(j.rider_earns)} <small style="font-size:12px;color:var(--ink-500)">payout</small>
                </div>
              </div>

              <div class="grid-2 gap-3 small mb-4">
                <div><span class="muted">📍 Pickup:</span> <strong>${escapeHtml(j.pickup_location)}, ${escapeHtml(j.pickup_county)}</strong></div>
                <div><span class="muted">🏁 Drop-off:</span> <strong>${escapeHtml(j.dropoff_location)}, ${escapeHtml(j.dropoff_county)}</strong></div>
                <div><span class="muted">🛣️ Est. Distance:</span> <strong>${j.distance_km || 30} km</strong></div>
                <div><span class="muted">⚖️ Cargo Weight:</span> <strong>~${j.weight_kg || 80} kg</strong></div>
              </div>

              <div class="flex justify-between items-center wrap gap-2 pt-3" style="border-top:1px solid var(--border-light)">
                <span class="small muted">Order: <strong>${escapeHtml(j.order_id || j.orders?.reference || '')}</strong></span>
                <button class="btn btn--primary" data-action="rider-accept" data-id="${j.id}">
                  Accept Delivery Job (${formatKES(j.rider_earns)})
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : emptyState('No new jobs in pool right now', 'All current orders have been claimed. New buyer orders will appear here automatically.', { href: 'orders.html', label: 'View all orders' })}
    </div>
  </section>`;

  setTimeout(() => {
    qsa('.rider-map-container').forEach((el) => {
      renderRouteMap(el, {
        pickupCounty: el.dataset.pickupCounty,
        pickupLocation: el.dataset.pickupLoc,
        dropoffCounty: el.dataset.dropoffCounty,
        dropoffLocation: el.dataset.dropoffLoc,
        status: el.dataset.status
      });
    });

    qsa('[data-action="rider-accept"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        setButtonLoading(btn, true, 'Claiming job…');
        const { error } = await deliveries.accept(btn.dataset.id);
        setButtonLoading(btn, false);
        if (error) return toast(error.message, 'error');
        toast('🎉 Job accepted! Proceed to farm pickup.', 'success');
        mountDashboard('rider');
      });
    });

    qsa('[data-action="rider-pickup"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        setButtonLoading(btn, true, 'Updating…');
        const { error } = await deliveries.markPickedUp(btn.dataset.id);
        setButtonLoading(btn, false);
        if (error) return toast(error.message, 'error');
        toast('📦 Marked as Picked Up! Navigate to buyer drop-off.', 'success');
        mountDashboard('rider');
      });
    });

    qsa('[data-action="rider-deliver"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const yes = await confirmDialog({
          title: 'Confirm Delivery',
          message: 'Have you safely delivered the produce to the buyer?',
          confirmLabel: 'Yes, Delivered'
        });
        if (!yes) return;

        setButtonLoading(btn, true, 'Confirming…');
        const { error } = await deliveries.markDelivered(btn.dataset.id);
        setButtonLoading(btn, false);
        if (error) return toast(error.message, 'error');
        toast('🎯 Delivery completed! Payout will release once buyer confirms.', 'success');
        mountDashboard('rider');
      });
    });
  }, 50);

  return html;
}

export async function mountDashboard(forcedRole) {
  const { requireRole, requireUser } = await import('./guards.js');
  const user = forcedRole ? await requireRole([forcedRole]) : await requireUser();
  if (!user) return;

  const root = qs('#dashRoot');
  const sideMount = qs('#dashSide');
  const role = forcedRole || user.accountType;
  const file = location.pathname.split('/').pop();

  if (sideMount) sideMount.outerHTML = renderSidebar(user, file);
  root.innerHTML = loadingState('Loading dashboard…');

  const views = { rider: riderView };
  const view = views[role] || riderView;

  try {
    root.innerHTML = await view(user);
  } catch (err) {
    console.error('[dashboard]', err);
    root.innerHTML = `<div class="card card--pad"><p>Unable to load dashboard.</p></div>`;
  }
}