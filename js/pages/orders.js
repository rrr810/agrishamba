/** orders.js — orders list + order details controller with review flow + route map. */
import { orders, payments, reviews as reviewsApi, deliveries } from '../api.js';
import { store } from '../state.js';
import { ORDER_STATUSES } from '../config.js';
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

function orderRole(order) {
  const user = store.getUser();
  if (!user) return 'guest';
  if (order.userId === user.id) return 'buyer';
  if (order.sellerId === user.id) return 'seller';
  return user.accountType === 'admin' ? 'admin' : 'viewer';
}

/** Star-rating modal shown after the buyer confirms delivery. */
async function promptForReview(order) {
  const already = await reviewsApi.alreadyReviewed(order.id);
  if (already) return;

  return new Promise((resolve) => {
    const m = modal({
      title: '⭐ Rate your experience',
      body: `
        <p style="margin-bottom:16px">How was your order from
          <strong>${escapeHtml(order.items[0]?.name || 'this seller')}</strong>?
          Your review helps other buyers.</p>

        <div id="starRating" style="display:flex;gap:8px;justify-content:center;font-size:2.5rem;margin:18px 0;user-select:none">
          ${[1, 2, 3, 4, 5].map((n) => `<span data-star="${n}" style="cursor:pointer;color:#ddd;transition:transform .1s ease"
            onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">★</span>`).join('')}
        </div>
        <p id="ratingLabel" style="text-align:center;color:var(--ink-500);font-weight:600;min-height:1.5em">Tap a star</p>

        <div class="field mt-3">
          <label for="reviewText">Comment (optional)</label>
          <textarea class="textarea" id="reviewText" rows="3"
            placeholder="Was the produce fresh? Was delivery on time? Would you buy again?"></textarea>
        </div>`,
      actions: [
        { label: 'Skip for now', variant: 'btn--outline', onClick: (close) => { close(); resolve(false); } },
        { label: 'Submit review', variant: 'btn--primary', onClick: async (close, root) => {
          const rating = Number(root.dataset.rating || 0);
          if (!rating) { toast('Please tap a star to rate.', 'warn'); return; }
          const comment = root.querySelector('#reviewText').value.trim();
          const submitBtn = root.querySelector('.modal__foot .btn--primary');
          setButtonLoading(submitBtn, true, 'Submitting…');

          const { error } = await reviewsApi.submit({
            orderId: order.id, subjectId: order.sellerId,
            productId: order.items[0]?.productId,
            rating, comment, reviewType: 'seller'
          });

          setButtonLoading(submitBtn, false);
          if (error) { toast(error.message, 'error'); return; }
          close();
          toast('Thank you! Review posted. 🌟', 'success');
          resolve(true);
        } }
      ]
    });

    const stars = m.root.querySelectorAll('[data-star]');
    const label = m.root.querySelector('#ratingLabel');
    const labels = ['', 'Terrible', 'Not great', 'OK', 'Good', 'Excellent!'];
    stars.forEach((star) => {
      star.addEventListener('click', () => {
        const val = Number(star.dataset.star);
        m.root.dataset.rating = val;
        stars.forEach((s) => { s.style.color = Number(s.dataset.star) <= val ? '#fbbf24' : '#ddd'; });
        label.textContent = labels[val];
        label.style.color = val >= 4 ? 'var(--green-700)' : val >= 3 ? 'var(--warn-600)' : 'var(--danger-600)';
      });
    });
  });
}

/* ------------------------------------------------------------- LIST VIEW */
const listEl = qs('#ordersList');
if (listEl) {
  const filter = qs('#statusFilter');
  filter.insertAdjacentHTML('beforeend', ORDER_STATUSES.map((s) => `<option>${s}</option>`).join(''));
  let all = [];

  const draw = () => {
    const q = qs('#orderSearch').value.trim().toLowerCase();
    const status = filter.value;
    let rows = all;
    if (status !== 'all') rows = rows.filter((o) => o.status === status);
    if (q) rows = rows.filter((o) => (o.id + o.items.map((i) => i.name).join(' ')).toLowerCase().includes(q));

    if (!rows.length) {
      listEl.innerHTML = emptyState('No orders found',
        all.length ? 'Try another status filter or search term.'
                   : 'When you place an order it will appear here with payment and delivery tracking.',
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
            <div><span class="small muted">Total</span> <strong style="font-size:var(--fs-md)">${formatKES(o.total)}</strong>
              <span class="small muted"> · ${escapeHtml(o.paymentMethod)}</span></div>
            <div class="flex gap-2 wrap">
              <a class="btn btn--outline btn--sm" href="order-details.html?id=${encodeURIComponent(o.id)}">View details</a>
              ${o.paymentStatus === 'Pending' && o.status !== 'Cancelled'
                ? `<button class="btn btn--primary btn--sm" data-retry="${o.id}">Complete payment</button>` : ''}
            </div>
          </div>
        </div>
      </article>`).join('');
  };

  (async () => {
    listEl.innerHTML = loadingState('Loading your orders…');
    const { data, error } = await orders.list();
    if (error) { listEl.innerHTML = errorState(error.message); return; }
    all = data; draw();
  })();

  qs('#orderSearch').addEventListener('input', debounce(draw, 250));
  filter.addEventListener('change', draw);
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-retry]');
    if (btn) location.href = `order-details.html?id=${encodeURIComponent(btn.dataset.retry)}`;
  });
}

/* ---------------------------------------------------------- DETAIL VIEW */
const detailEl = qs('#orderContainer');
if (detailEl) {
  const id = getParam('id');

  const render = (o) => {
    qs('#crumbId').textContent = o.id;
    document.title = `Order ${o.id} — SokoShamba`;
    detailEl.innerHTML = `
    <div class="flex items-center justify-between wrap gap-3 mt-4 mb-5">
      <div><h1 style="font-size:var(--fs-xl)">Order ${escapeHtml(o.id)}</h1>
        <p class="muted small">Placed ${formatDate(o.date)} · Paid via ${escapeHtml(o.paymentMethod)}</p></div>
      <div class="flex gap-2 wrap">${statusBadge(o.status)} ${payBadge(o.paymentStatus)}</div>
    </div>
    <div class="cart-layout">
      <div class="grid gap-4">
        <section class="card">
          <div class="card__head"><h2>Items</h2><span class="small muted">${o.items.length} product(s)</span></div>
          <div class="card__body">
            ${o.items.map((i) => `<div class="list-row">
              <div class="list-row__main"><strong>${escapeHtml(i.name)}</strong><small>${i.qty} × ${formatKES(i.price)} / ${escapeHtml(i.unit)}</small></div>
              <strong>${formatKES(i.qty * i.price)}</strong></div>`).join('')}
          </div>
        </section>

        <section class="card">
          <div class="card__head"><h2>Order timeline</h2></div>
          <div class="card__body">
            <ul class="timeline">${(o.timeline || []).map((t) => `<li><strong>${escapeHtml(t.label)}</strong><time>${escapeHtml(t.at)}</time></li>`).join('')}</ul>
            ${['Delivered', 'Confirmed by Buyer', 'Cancelled'].includes(o.status) ? '' : `
            <div class="divider"></div>
            <p class="small muted mb-3">Sellers update progress here. Row-level security restricts this to the seller and admins.</p>
            <div class="flex gap-2 wrap">
              <label class="sr-only" for="statusSelect">New status</label>
              <select class="select" id="statusSelect" style="max-width:220px">
                ${['Confirmed', 'Being Prepared', 'Ready', 'Rider Assigned', 'Out for Delivery', 'Delivered']
                  .map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <button class="btn btn--primary" id="updateStatus">Update status</button>
              <button class="btn btn--outline" id="cancelOrder" style="color:var(--danger-600)">Cancel order</button>
            </div>`}
          </div>
        </section>
      </div>

      <aside class="grid gap-4">
        <section class="card card--pad">
          <h2 style="font-size:var(--fs-md)" class="mb-3">Payment summary</h2>
          <div class="summary__row"><span>Subtotal</span><strong>${formatKES(o.subtotal)}</strong></div>
          <div class="summary__row"><span>Delivery</span><strong>${formatKES(o.delivery)}</strong></div>
          <div class="summary__row total"><span>Total</span><strong>${formatKES(o.total)}</strong></div>
          ${o.paymentStatus === 'Pending' ? `<button class="btn btn--primary btn--block mt-4" id="payNow">Complete payment</button>` : ''}
        </section>

        ${orderRole(o) === 'buyer' && o.status === 'Delivered' ? `
        <section class="card card--pad" style="background:linear-gradient(135deg, var(--green-50), #ffffff); border-color: var(--green-400)">
          <h2 style="font-size:var(--fs-md)" class="mb-3">📦 Did you receive your order?</h2>
          <p class="small mb-4">Confirming releases payment to the seller and rider. If something is wrong, tap Dispute instead.</p>
          <div class="grid gap-2">
            <button class="btn btn--primary btn--block btn--lg" id="confirmReceived">✅ Yes, I received it</button>
            <button class="btn btn--outline btn--block" id="disputeOrder" style="color:var(--danger-600)">⛔ Something is wrong — dispute</button>
          </div>
          <p class="small muted mt-3">Auto-confirms in 72 hours if no action.</p>
        </section>` : ''}

        ${orderRole(o) === 'buyer' && o.status === 'Confirmed by Buyer' ? `
        <section class="card card--pad" style="background:#e8f5ee; border-color:var(--green-400)">
          <p style="text-align:center; margin:0"><span style="font-size:1.5rem" aria-hidden="true">🎉</span><br>
          <strong>Delivery confirmed. Thank you!</strong><br>
          <span class="small muted">Payment released to seller and rider.</span></p>
          <button class="btn btn--outline btn--block mt-3" id="reviewSellerBtn">⭐ Rate this seller</button>
        </section>` : ''}

        <section class="card card--pad">
          <h2 style="font-size:var(--fs-md)" class="mb-3">Delivery address</h2>
          <p class="small">${escapeHtml(o.address.name || '')}<br>${escapeHtml(o.address.phone || '')}<br>
            ${escapeHtml(o.address.line || '')}<br>${escapeHtml(o.address.town || '')}, ${escapeHtml(o.address.county || '')}</p>
          ${o.address.notes ? `<p class="small muted mt-2"><em>${escapeHtml(o.address.notes)}</em></p>` : ''}
        </section>

        <section class="card card--pad">
          <h2 style="font-size:var(--fs-md)" class="mb-3">🗺️ Delivery route</h2>
          <div id="orderRouteMap"
            data-seller-id="${o.sellerId || ''}"
            data-pickup=""
            data-pickup-loc=""
            data-dropoff="${escapeHtml(o.address?.county || '')}"
            data-dropoff-loc="${escapeHtml(o.address?.town || '')}"></div>
        </section>

        <a class="btn btn--outline" href="orders.html">← Back to orders</a>
      </aside>
    </div>`;

    qs('#updateStatus')?.addEventListener('click', async (e) => {
      const status = qs('#statusSelect').value;
      setButtonLoading(e.currentTarget, true, 'Updating…');
      const { data } = await orders.updateStatus(o.id, status);
      setButtonLoading(e.currentTarget, false);
      store.pushNotification({ type: 'order', title: `Order ${o.id} · ${status}`, body: 'The order status was updated.' });
      toast(`Order marked as ${status}.`, 'success');
      render(data);
    });

    qs('#cancelOrder')?.addEventListener('click', async () => {
      const yes = await confirmDialog({ title: 'Cancel order', message: `Cancel order ${o.id}? This cannot be undone.`, confirmLabel: 'Cancel order', danger: true });
      if (!yes) return;
      const { data } = await orders.updateStatus(o.id, 'Cancelled');
      toast('Order cancelled.', 'success');
      render(data || o);
    });

    qs('#payNow')?.addEventListener('click', async (e) => {
      setButtonLoading(e.currentTarget, true, 'Contacting payment provider…');
      const { data, error } = await payments.createPayment({
        orderId: o.id, amount: o.total,
        email: store.getUser()?.email || '', method: o.paymentMethod,
        phone: o.address?.phone
      });
      setButtonLoading(e.currentTarget, false);
      if (error) return toast(error.message, 'error');
      toast(data?.message || 'Check your phone for the payment prompt.', 'info', 'Payment');
    });

    qs('#confirmReceived')?.addEventListener('click', async (e) => {
      const yes = await confirmDialog({
        title: '✅ Confirm you received your order?',
        message: 'This releases the payment to the seller and rider. You won\'t be able to dispute after this.',
        confirmLabel: 'Yes, confirm'
      });
      if (!yes) return;

      setButtonLoading(e.currentTarget, true, 'Confirming…');
      const { getSupabase } = await import('../supabase-client.js');
      const sb = await getSupabase();
      const dbOrderId = o.dbId || o.id;
      const { data: job } = await sb.from('delivery_jobs')
        .select('id').eq('order_id', dbOrderId).maybeSingle();

      if (job) await deliveries.confirmReceived(job.id);
      else await orders.updateStatus(o.id, 'Confirmed by Buyer');

      setButtonLoading(e.currentTarget, false);
      toast('Confirmed! Payment released. Thank you 🎉', 'success');
      store.pushNotification({
        type: 'payment', title: `Payment released for ${o.id}`,
        body: 'Seller and rider will be paid out within 24 hours.'
      });

      const { data: fresh } = await orders.get(o.id);
      if (fresh) render(fresh);
      setTimeout(() => promptForReview(fresh || o), 600);
    });

    qs('#reviewSellerBtn')?.addEventListener('click', () => promptForReview(o));

    qs('#disputeOrder')?.addEventListener('click', async () => {
      const yes = await confirmDialog({
        title: '⛔ Report an issue with this order?',
        message: 'The payment stays on hold and our team will contact you within 24 hours. Continue?',
        confirmLabel: 'Yes, dispute', danger: true
      });
      if (!yes) return;

      const { getSupabase } = await import('../supabase-client.js');
      const sb = await getSupabase();
      const dbOrderId = o.dbId || o.id;
      await sb.from('orders').update({ status: 'Disputed' }).eq('id', dbOrderId);
      await sb.from('delivery_jobs').update({ status: 'disputed' }).eq('order_id', dbOrderId);

      store.pushNotification({
        type: 'system', title: `Dispute filed for ${o.id}`,
        body: 'Our team will contact you within 24 hours.'
      });
      toast('Dispute filed. We\'ll reach out on WhatsApp soon.', 'warn');

      const { APP } = await import('../config.js');
      window.open(`https://wa.me/${APP.whatsapp}?text=${encodeURIComponent(`Hi SokoShamba, I need to dispute order ${o.id}. Issue: `)}`, '_blank');
    });
  };

  (async () => {
    if (!id) { detailEl.innerHTML = errorState('No order reference supplied.'); return; }
    detailEl.innerHTML = loadingState('Loading order…');
    const { data, error } = await orders.get(id);
    if (error) { detailEl.innerHTML = errorState(error.message); return; }
    render(data);
  })();
}