/** orders.js — orders list + Glovo-style live order tracking & delivery confirmation. */
import { orders, payments, reviews as reviewsApi, deliveries } from '../api.js';
import { store } from '../state.js';
import { ORDER_STATUSES } from '../config.js';
import { renderRouteMap } from '../map.js';
import {
  qs, getParam, formatKES, formatDate, escapeHtml, loadingState, emptyState,
  errorState, toast, confirmDialog, setButtonLoading, debounce, modal
} from '../ui.js';

const statusBadge = (s) => {
  const map = {
    Delivered: 'badge--green', 'Confirmed by Buyer': 'badge--green',
    'Out for Delivery': 'badge--info', Confirmed: 'badge--info', 'Rider Assigned': 'badge--info',
    'Payment Received': 'badge--green',
    Processing: 'badge--warn', 'Being Prepared': 'badge--warn', Ready: 'badge--warn', Pending: 'badge--warn',
    Cancelled: 'badge--danger', Disputed: 'badge--danger'
  };
  return `<span class="badge ${map[s] || ''}">${escapeHtml(s)}</span>`;
};

const payBadge = (s) => {
  const map = { Paid: 'badge--green', Pending: 'badge--warn', Failed: 'badge--danger', Cancelled: 'badge--danger', Refunded: 'badge--info' };
  return `<span class="badge ${map[s] || ''}">${escapeHtml(s)}</span>`;
};

function promptForReview(order) {
  return new Promise((resolve) => {
    const m = modal({
      title: '⭐ Rate your experience',
      body: `
        <p style="margin-bottom:16px">How was your delivery for
          <strong>${escapeHtml(order.items?.[0]?.name || 'produce')}</strong>?
          Your review helps other buyers across Kenya.</p>

        <div id="starRating" style="display:flex;gap:8px;justify-content:center;font-size:2.5rem;margin:18px 0;user-select:none">
          ${[1, 2, 3, 4, 5].map((n) => `<span data-star="${n}" style="cursor:pointer;color:#fbbf24;transition:transform .1s ease">★</span>`).join('')}
        </div>
        <p id="ratingLabel" style="text-align:center;color:var(--green-700);font-weight:600">Excellent! 5/5</p>

        <div class="field mt-3">
          <label for="reviewText">Comment (optional)</label>
          <textarea class="textarea" id="reviewText" rows="3"
            placeholder="Was the produce fresh? Was the rider on time?"></textarea>
        </div>`,
      actions: [
        { label: 'Close', variant: 'btn--outline', onClick: (close) => { close(); resolve(false); } },
        { label: 'Submit review', variant: 'btn--primary', onClick: async (close) => {
          close();
          toast('Thank you! Review posted. 🌟', 'success');
          resolve(true);
        } }
      ]
    });
  });
}

const listEl = qs('#ordersList');
if (listEl) {
  const filter = qs('#statusFilter');
  if (filter) {
    filter.insertAdjacentHTML('beforeend', ORDER_STATUSES.map((s) => `<option>${s}</option>`).join(''));
  }
  let all = [];

  const draw = () => {
    const q = qs('#orderSearch')?.value.trim().toLowerCase() || '';
    const status = filter?.value || 'all';
    let rows = all;
    if (status !== 'all') rows = rows.filter((o) => o.status === status);
    if (q) rows = rows.filter((o) => (o.id + o.items.map((i) => i.name).join(' ')).toLowerCase().includes(q));

    if (!rows.length) {
      listEl.innerHTML = emptyState('No orders found',
        all.length ? 'Try another filter.' : 'When you place an order it will appear here with live rider tracking.',
        { href: 'marketplace.html', label: 'Browse marketplace' });
      return;
    }
    listEl.innerHTML = rows.map((o) => `
      <article class="order-card">
        <div class="order-card__head">
          <div><strong>${escapeHtml(o.id)}</strong><p class="small muted">Placed ${formatDate(o.date)} · ${o.items.length} item(s)</p></div>
          <div class="flex gap-2 wrap items-center">${statusBadge(o.status)} ${payBadge(o.paymentStatus)}</div>
        </div>
        <div class="card__body">
          ${o.items.map((i) => `<div class="list-row">
            <div class="list-row__main"><strong>${escapeHtml(i.name)}</strong><small>${i.qty} × ${formatKES(i.price)} / ${escapeHtml(i.unit)}</small></div>
            <strong>${formatKES(i.qty * i.price)}</strong></div>`).join('')}
          <div class="flex items-center justify-between wrap gap-3 mt-4">
            <div><span class="small muted">Total:</span> <strong style="font-size:var(--fs-md)">${formatKES(o.total)}</strong></div>
            <div class="flex gap-2 wrap">
              <a class="btn btn--primary btn--sm" href="order-details.html?id=${encodeURIComponent(o.id)}">🛵 Track Live Delivery</a>
            </div>
          </div>
        </div>
      </article>`).join('');
  };

  (async () => {
    listEl.innerHTML = loadingState('Loading orders…');
    const { data } = await orders.list();
    all = data || store.getOrders();
    draw();
  })();

  qs('#orderSearch')?.addEventListener('input', debounce(draw, 200));
  filter?.addEventListener('change', draw);
}

const detailEl = qs('#orderContainer');
if (detailEl) {
  const id = getParam('id') || 'SS-24081';

  const render = (o) => {
    const crumb = qs('#crumbId');
    if (crumb) crumb.textContent = o.id;
    document.title = `Order ${o.id} — Live Tracking`;

    const isDelivered = o.status === 'Delivered';
    const isConfirmed = o.status === 'Confirmed by Buyer';

    detailEl.innerHTML = `
    <div class="flex items-center justify-between wrap gap-3 mt-4 mb-5">
      <div>
        <h1 style="font-size:var(--fs-xl)">Order ${escapeHtml(o.id)}</h1>
        <p class="muted small">Placed ${formatDate(o.date)} · Paid via ${escapeHtml(o.paymentMethod || 'M-Pesa')}</p>
      </div>
      <div class="flex gap-2 wrap">${statusBadge(o.status)} ${payBadge(o.paymentStatus)}</div>
    </div>

    <div class="cart-layout">
      <div class="grid gap-4">
        <section class="card card--pad" style="border:2px solid var(--green-600);background:#fff">
          <div class="flex justify-between items-center mb-3">
            <h2 style="font-size:var(--fs-md)">🗺️ Live Delivery Tracker</h2>
            <span class="badge badge--green">🟢 Live GPS</span>
          </div>
          <div id="orderRouteMap"></div>
        </section>

        <section class="card">
          <div class="card__head"><h2>Order Items</h2><span class="small muted">${o.items.length} item(s)</span></div>
          <div class="card__body">
            ${o.items.map((i) => `<div class="list-row">
              <div class="list-row__main"><strong>${escapeHtml(i.name)}</strong><small>${i.qty} × ${formatKES(i.price)} / ${escapeHtml(i.unit)}</small></div>
              <strong>${formatKES(i.qty * i.price)}</strong></div>`).join('')}
          </div>
        </section>

        <section class="card">
          <div class="card__head"><h2>Delivery Progress</h2></div>
          <div class="card__body">
            <ul class="timeline">${(o.timeline || []).map((t) => `<li><strong>${escapeHtml(t.label)}</strong><time>${escapeHtml(t.at)}</time></li>`).join('')}</ul>
          </div>
        </section>
      </div>

      <aside class="grid gap-4">
        ${isDelivered ? `
        <section class="card card--pad" style="background:linear-gradient(135deg, var(--green-50), #ffffff); border:2px solid var(--green-600)">
          <div style="font-size:2rem;text-align:center" aria-hidden="true">📦</div>
          <h2 style="font-size:var(--fs-md);text-align:center" class="mt-2 mb-2">Did you receive your produce?</h2>
          <p class="small text-center mb-4">Confirming releases escrow payment to the farmer and delivery rider.</p>
          <div class="grid gap-2">
            <button class="btn btn--primary btn--block btn--lg" id="confirmReceived">✅ Yes, I received it</button>
            <button class="btn btn--outline btn--block" id="disputeOrder" style="color:var(--danger-600)">⛔ Report Issue / Dispute</button>
          </div>
        </section>` : ''}

        ${isConfirmed ? `
        <section class="card card--pad" style="background:#e8f5ee; border:2px solid var(--green-500); text-align:center">
          <span style="font-size:2rem" aria-hidden="true">🎉</span>
          <h2 style="font-size:var(--fs-md);margin-top:8px">Delivery Confirmed!</h2>
          <p class="small muted">Payment released to farmer and rider. Thank you for using SokoShamba!</p>
          <button class="btn btn--outline btn--block mt-3" id="reviewSellerBtn">⭐ Rate this delivery</button>
        </section>` : ''}

        <section class="card card--pad">
          <h2 style="font-size:var(--fs-md)" class="mb-3">Payment Summary</h2>
          <div class="summary__row"><span>Subtotal</span><strong>${formatKES(o.subtotal)}</strong></div>
          <div class="summary__row"><span>Delivery Fee</span><strong>${formatKES(o.delivery || 1200)}</strong></div>
          <div class="summary__row total"><span>Total Paid</span><strong>${formatKES(o.total)}</strong></div>
          <p class="small muted mt-3">🔒 100% Escrow Protected</p>
        </section>

        <section class="card card--pad">
          <h2 style="font-size:var(--fs-md)" class="mb-2">Delivery Address</h2>
          <p class="small">
            <strong>${escapeHtml(o.address?.name || 'Buyer')}</strong><br>
            📞 ${escapeHtml(o.address?.phone || '+254712345002')}<br>
            📍 ${escapeHtml(o.address?.line || 'Delivery Location')}, ${escapeHtml(o.address?.town || '')}, ${escapeHtml(o.address?.county || 'Nairobi')}
          </p>
        </section>

        <a class="btn btn--outline" href="orders.html">← Back to orders</a>
      </aside>
    </div>`;

    const mapMount = qs('#orderRouteMap');
    if (mapMount) {
      const seller = store.getProduct(o.items?.[0]?.productId);
      const pickupCounty = seller?.county || 'Uasin Gishu';
      const pickupLoc = seller?.location || (pickupCounty + ' Farm Depot');
      const dropoffCounty = o.address?.county || 'Nairobi';
      const dropoffLoc = o.address?.town || o.address?.line || 'Embakasi';

      renderRouteMap(mapMount, {
        pickupCounty,
        pickupLocation: pickupLoc,
        dropoffCounty,
        dropoffLocation: dropoffLoc,
        status: o.status,
        riderName: o.riderName || 'Kevin Kipchirchir',
        riderPhone: o.riderPhone || '+254712345006'
      });
    }

    qs('#confirmReceived')?.addEventListener('click', async (e) => {
      const yes = await confirmDialog({
        title: 'Confirm Delivery Receipt',
        message: 'This will release the payment to the farmer and delivery rider.',
        confirmLabel: 'Yes, Release Payment'
      });
      if (!yes) return;

      setButtonLoading(e.currentTarget, true, 'Releasing payout…');
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const timeline = o.timeline || [];
      timeline.push({ label: 'Buyer confirmed receipt · Payment released', at: now });

      store.updateOrder(o.id, {
        status: 'Confirmed by Buyer',
        timeline
      });

      setButtonLoading(e.currentTarget, false);
      toast('Payment released to farmer and rider! 🎉', 'success');
      const updated = store.getOrder(o.id);
      render(updated || o);
      setTimeout(() => promptForReview(updated || o), 600);
    });

    qs('#reviewSellerBtn')?.addEventListener('click', () => promptForReview(o));
  };

  (async () => {
    detailEl.innerHTML = loadingState('Loading order…');
    const { data } = await orders.get(id);
    const orderData = data || store.getOrder(id) || store.getOrders()[0];
    render(orderData);
  })();
}