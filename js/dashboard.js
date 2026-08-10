/**
 * dashboard.js — shared dashboard shell + role-specific views.
 */
import { products, orders, wallet, adminService, deliveries } from './api.js';
import { store } from './state.js';
import { renderRouteMap } from './map.js';
import {
  qs, qsa, formatKES, formatNumber, formatDate, escapeHtml, loadingState,
  emptyState, initials, page, toast, confirmDialog, setButtonLoading
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
      ['Rider Hub', 'rider-dashboard.html', '🛵'],
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

  const roleNav = byRole[user.accountType] || byRole.rider;
  const link = ([label, href, icon]) =>
    `<a href="${href}"${href.split('#')[0] === active ? ' class="active" aria-current="page"' : ''}><span aria-hidden="true">${icon}</span>${label}</a>`;

  return `
  <aside class="dash-side" aria-label="Dashboard navigation">
    <div class="dash-side__user">
      <div class="avatar">${initials(user.fullName || user.email || 'Rider')}</div>
      <div><strong>${escapeHtml(user.fullName || user.email || 'User')}</strong><span>${ROLE_LABEL[user.accountType] || user.accountType}</span></div>
    </div>
    <nav class="dash-nav">
      <p class="group-label">Workspace</p>
      ${roleNav.map(link).join('')}
      <p class="group-label">General</p>
      ${common.map(link).join('')}
      <p class="group-label">Account</p>
      ${account.map(link).join('')}
    </nav>
  </aside>`;
}

const statCard = (label, value, meta, mod = '') =>
  `<div class="stat ${mod}"><p class="stat__label">${label}</p><p class="stat__value">${value}</p><p class="stat__meta">${meta}</p></div>`;

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

/* ---------------------------------------------------- RIDER DASHBOARD */
export async function riderView(user) {
  let availableJobs = [];
  let activeJobs = [];
  let completedJobs = [];
  let earn = { total: 7920, released: 5400, pending: 2520, jobs: 4 };

  try {
    const [avRes, acRes, compRes, earnRes] = await Promise.all([
      deliveries.available(),
      deliveries.myActive(),
      deliveries.myCompleted(),
      deliveries.earnings()
    ]);
    if (avRes?.data) availableJobs = avRes.data;
    if (acRes?.data) activeJobs = acRes.data;
    if (compRes?.data) completedJobs = compRes.data;
    if (earnRes?.data) earn = earnRes.data;
  } catch (_) {}

  if (!activeJobs.length && !availableJobs.length) {
    const allJobs = store.getDeliveryJobs();
    activeJobs = allJobs.filter(j => ['accepted', 'picked_up', 'out_for_delivery'].includes(j.status));
    availableJobs = allJobs.filter(j => j.status === 'available');
  }

  const html = `
  <div class="dash-header">
    <div>
      <h1>Rider Logistics Hub 🛵</h1>
      <p class="muted small">${escapeHtml(user?.fullName || 'Rider Partner')} · Active in <strong>${escapeHtml(user?.county || 'Uasin Gishu & Nairobi')}</strong></p>
    </div>
    <div class="flex gap-2">
      <span class="badge badge--green" style="font-size:13px;padding:6px 14px">🟢 GPS Live &amp; Online</span>
    </div>
  </div>

  <div class="stat-grid">
    ${statCard('Total Earned', formatKES(earn.total || 7920), 'Lifetime delivery payouts')}
    ${statCard('Available Balance', formatKES(earn.released || 5400), 'Ready for M-Pesa withdrawal', 'stat--info')}
    ${statCard('Active Deliveries', formatNumber(activeJobs.length), 'In transit right now', activeJobs.length ? 'stat--gold' : '')}
    ${statCard('Completed Jobs', formatNumber(earn.jobs || 4), 'Delivered to buyers', 'stat--info')}
  </div>

  <!-- ACTIVE DELIVERIES (GLOVO STYLE) -->
  <section class="card mb-6" id="active">
    <div class="card__head">
      <h2>🛵 My Active Deliveries (${activeJobs.length})</h2>
      <span class="badge ${activeJobs.length ? 'badge--info' : ''}">${activeJobs.length ? 'Live Trip' : 'No active trip'}</span>
    </div>
    <div class="card__body">
      ${activeJobs.length ? activeJobs.map((j) => {
        const order = j.orders || {};
        const buyer = order.buyer || order.address || {};
        const seller = order.seller || {};
        const isPickedUp = ['picked_up', 'out_for_delivery', 'delivered'].includes(j.status);
        const isDelivered = j.status === 'delivered';

        return `
        <article class="order-card mb-4" style="border:2px solid var(--green-600);background:#fff">
          <div class="order-card__head" style="background:var(--green-50)">
            <div>
              <strong style="font-size:var(--fs-md)">Job ${escapeHtml(j.id)} · Order ${escapeHtml(j.order_id || order.reference || 'SS-24081')}</strong>
              <p class="small muted">Vehicle: <strong>${escapeHtml(j.vehicle_type || 'Pickup / Boda')}</strong> · Cargo: ~${j.weight_kg || 80}kg · Distance: ${j.distance_km || 35}km</p>
            </div>
            <div class="text-right">
              <span class="badge badge--green" style="font-size:14px;padding:6px 12px">Payout: ${formatKES(j.rider_earns || 1350)}</span>
              <div class="mt-1">${statusBadge(isDelivered ? 'Delivered' : isPickedUp ? 'Out for Delivery' : 'Rider Assigned')}</div>
            </div>
          </div>

          <div class="card__body">
            <div class="grid-2 gap-4 mb-4">
              <!-- STEP 1: FARMER PICKUP -->
              <div style="background:#f8fafc;padding:14px;border-radius:var(--radius-md);border-left:4px solid var(--green-700)">
                <div class="flex justify-between items-center mb-2">
                  <strong style="color:var(--green-900)">1. Pickup (Farmer)</strong>
                  ${isPickedUp ? '<span class="badge badge--green">✅ Picked Up</span>' : '<span class="badge badge--warn">Pending Pickup</span>'}
                </div>
                <p class="small">
                  <strong>${escapeHtml(seller.full_name || 'Farmer')}</strong><br>
                  📍 ${escapeHtml(j.pickup_location || 'Farm Depot')}, ${escapeHtml(j.pickup_county || 'Uasin Gishu')}<br>
                  📞 ${escapeHtml(seller.phone || '+254712345001')}
                </p>
                <div class="flex gap-2 mt-3">
                  <a class="btn btn--outline btn--sm" href="tel:${escapeHtml(seller.phone || '0712345001')}">📞 Call</a>
                  ${!isPickedUp ? `<button class="btn btn--primary btn--sm" data-action="rider-pickup" data-id="${j.id}">✅ Confirm Pickup from Farm</button>` : ''}
                </div>
              </div>

              <!-- STEP 2: BUYER DROPOFF -->
              <div style="background:#f8fafc;padding:14px;border-radius:var(--radius-md);border-left:4px solid var(--primary-600)">
                <div class="flex justify-between items-center mb-2">
                  <strong style="color:var(--primary-900)">2. Delivery (Buyer)</strong>
                  ${isDelivered ? '<span class="badge badge--green">✅ Delivered</span>' : isPickedUp ? '<span class="badge badge--info">On the Way 🛵</span>' : '<span class="badge badge--warn">Next Step</span>'}
                </div>
                <p class="small">
                  <strong>${escapeHtml(buyer.full_name || buyer.name || 'Buyer')}</strong><br>
                  📍 ${escapeHtml(j.dropoff_location || 'Buyer Address')}, ${escapeHtml(j.dropoff_county || 'Nairobi')}<br>
                  📞 ${escapeHtml(buyer.phone || '+254712345002')}
                </p>
                <div class="flex gap-2 mt-3">
                  <a class="btn btn--outline btn--sm" href="tel:${escapeHtml(buyer.phone || '0712345002')}">📞 Call Buyer</a>
                  ${isPickedUp && !isDelivered ? `<button class="btn btn--primary btn--sm" data-action="rider-deliver" data-id="${j.id}">🎯 Confirm Delivery to Buyer</button>` : ''}
                </div>
              </div>
            </div>

            <!-- GLOVO STYLE LIVE MAP -->
            <div class="mt-4">
              <h3 style="font-size:var(--fs-sm);margin-bottom:8px">🗺️ Live GPS Route Tracking</h3>
              <div class="rider-map-container"
                id="riderMap-${j.id}"
                data-pickup-county="${escapeHtml(j.pickup_county || 'Uasin Gishu')}"
                data-pickup-loc="${escapeHtml(j.pickup_location || 'Moiben Farm Depot')}"
                data-dropoff-county="${escapeHtml(j.dropoff_county || 'Nairobi')}"
                data-dropoff-loc="${escapeHtml(j.dropoff_location || 'Embakasi')}"
                data-status="${isDelivered ? 'Delivered' : isPickedUp ? 'Out for Delivery' : 'Rider Assigned'}"
                data-rider-name="${escapeHtml(user?.fullName || 'Kevin Kipchirchir')}"
                data-rider-phone="${escapeHtml(user?.phone || '+254712345006')}"></div>
            </div>
          </div>
        </article>`;
      }).join('') : `
        <div class="text-center" style="padding:24px">
          <div style="font-size:2.5rem" aria-hidden="true">🛵</div>
          <h3 class="mt-2">No active trip right now</h3>
          <p class="small muted mt-1">Accept a delivery job from the available pool below.</p>
        </div>`}
    </div>
  </section>

  <!-- AVAILABLE JOBS POOL -->
  <section class="card mb-6" id="available">
    <div class="card__head">
      <h2>📦 Available Delivery Jobs Pool (${availableJobs.length})</h2>
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
                  ${j.isNearby ? '<span class="badge badge--green ml-2">📍 Nearby in County</span>' : ''}
                </div>
                <div class="price" style="font-size:var(--fs-lg);color:var(--green-800)">
                  ${formatKES(j.rider_earns || 1350)} <small style="font-size:12px;color:var(--ink-500)">payout</small>
                </div>
              </div>

              <div class="grid-2 gap-3 small mb-4">
                <div><span class="muted">📍 Pickup:</span> <strong>${escapeHtml(j.pickup_location || 'Farm')}, ${escapeHtml(j.pickup_county || 'County')}</strong></div>
                <div><span class="muted">🏁 Drop-off:</span> <strong>${escapeHtml(j.dropoff_location || 'Address')}, ${escapeHtml(j.dropoff_county || 'County')}</strong></div>
                <div><span class="muted">🛣️ Est. Distance:</span> <strong>${j.distance_km || 30} km</strong></div>
                <div><span class="muted">⚖️ Cargo:</span> <strong>~${j.weight_kg || 80} kg</strong></div>
              </div>

              <div class="flex justify-between items-center wrap gap-2 pt-3" style="border-top:1px solid var(--border-light)">
                <span class="small muted">Order: <strong>${escapeHtml(j.order_id || j.orders?.reference || 'SS-24090')}</strong></span>
                <button class="btn btn--primary" data-action="rider-accept" data-id="${j.id}">
                  Accept Delivery Job (${formatKES(j.rider_earns || 1350)})
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
        status: el.dataset.status,
        riderName: el.dataset.riderName,
        riderPhone: el.dataset.riderPhone
      });
    });

    qsa('[data-action="rider-accept"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        setButtonLoading(btn, true, 'Claiming job…');
        await deliveries.accept(btn.dataset.id);
        setButtonLoading(btn, false);
        toast('🎉 Job accepted! Buyer and farmer have been notified.', 'success');
        mountDashboard('rider');
      });
    });

    qsa('[data-action="rider-pickup"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        setButtonLoading(btn, true, 'Updating…');
        await deliveries.markPickedUp(btn.dataset.id);
        setButtonLoading(btn, false);
        toast('📦 Marked as Picked Up! Buyer can now track your live GPS route.', 'success');
        mountDashboard('rider');
      });
    });

    qsa('[data-action="rider-deliver"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const yes = await confirmDialog({
          title: 'Confirm Delivery',
          message: 'Have you handed over the produce to the buyer?',
          confirmLabel: 'Yes, Delivered'
        });
        if (!yes) return;

        setButtonLoading(btn, true, 'Confirming…');
        await deliveries.markDelivered(btn.dataset.id);
        setButtonLoading(btn, false);
        toast('🎯 Delivery completed! Buyer prompted to confirm receipt.', 'success');
        mountDashboard('rider');
      });
    });
  }, 50);

  return html;
}

export async function mountDashboard(forcedRole = 'rider') {
  const root = qs('#dashRoot');
  const sideMount = qs('#dashSide');
  const user = store.getUser() || { fullName: 'Kevin Kipchirchir', accountType: 'rider', county: 'Uasin Gishu' };

  if (sideMount) sideMount.outerHTML = renderSidebar(user, 'rider-dashboard.html');
  if (!root) return;

  root.innerHTML = loadingState('Loading Rider Hub…');

  try {
    root.innerHTML = await riderView(user);
  } catch (err) {
    console.error('[dashboard]', err);
    root.innerHTML = `<div class="card card--pad"><p>Unable to load dashboard.</p></div>`;
  }
}