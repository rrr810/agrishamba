/**
 * checkout.js — Multi-step checkout with Paystack M-Pesa STK Push.
 * Steps: Cart → Delivery → Payment → Review → Confirmation
 */
import { cart } from '../cart.js';
import { orders, payments, automation } from '../api.js';
import { store } from '../state.js';
import { COUNTIES, PAYSTACK, APP, isDemo } from '../config.js';
import { rules, validateForm, liveValidate, normalizePhone } from '../validation.js';
import { calculateDelivery, calculateCommission, sellerPayout, HANDLING_EXTRAS } from '../pricing.js';
import { getSupabase } from '../supabase-client.js';
import { qs, formatKES, escapeHtml, toast, setButtonLoading, emptyState, refreshHeaderBadges } from '../ui.js';
import { read, write, KEYS } from '../storage.js';

/* ------------------------------------------------------------- state */
const STEPS = ['Cart', 'Delivery', 'Payment', 'Review', 'Confirmation'];
let step = 1;
let delivery = read(KEYS.settings, {}).lastDelivery || null;
let deliveryOpts = { vehicle: 'boda', distanceKm: 10, weightKg: 20, extras: [] };
let paymentMethod = 'mpesa';
let mpesaPhone = '';
let placedOrder = null;

const stepEl = qs('#checkoutStep');

/* ----------------------------------------------------------- helpers */
function estimateDistance(fromCounty, toCounty) {
  if (!fromCounty || !toCounty) return 15;
  if (fromCounty === toCounty) return 8;
  return 45;
}

function estimateWeight(items) {
  const weights = {
    'kg': 1, '90kg bag': 90, '50kg bag': 50, 'crate': 25, 'tray': 2,
    'litre': 1, 'bunch': 3, 'piece': 5, 'head': 300, 'tonne': 1000, 'acre': 5, 'day': 5
  };
  return items.reduce((sum, i) => sum + (weights[i.unit] || 5) * i.qty, 0);
}

/* --------------------------------------------------------- stepper UI */
function renderStepper() {
  const el = qs('#stepper');
  if (!el) return;
  el.innerHTML = STEPS.map((label, i) => `
    <span class="stepper__item ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}">
      <span class="stepper__num">${i < step ? '✓' : i + 1}</span>${label}</span>
    ${i < STEPS.length - 1 ? '<span class="stepper__sep"></span>' : ''}`).join('');
}

/* --------------------------------------------------------- summary UI */
function renderSummary() {
  const items = cart.items();
  const itemsEl = qs('#summaryItems');
  if (itemsEl) {
    itemsEl.innerHTML = items.length
      ? items.map((i) => `
          <div class="summary__row"><span>${escapeHtml(i.name)} <span class="muted">× ${i.qty}</span></span>
          <span>${formatKES(i.price * i.qty)}</span></div>`).join('')
      : '<p class="small muted">No items.</p>';
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const dc = calculateDelivery(deliveryOpts);
  const commission = calculateCommission(subtotal);
  const total = subtotal + (items.length ? dc.totalFee : 0);

  const setText = (sel, val) => { const n = qs(sel); if (n) n.textContent = val; };
  setText('#sumSubtotal', formatKES(subtotal));
  setText('#sumDelivery', items.length && dc.totalFee ? formatKES(dc.totalFee) : '—');
  setText('#sumTotal', formatKES(total));

  let breakdownEl = qs('#sumBreakdown');
  if (!breakdownEl) {
    const host = qs('#sumTotal')?.closest('.summary') || qs('#sumTotal')?.parentElement;
    if (host) {
      breakdownEl = document.createElement('div');
      breakdownEl.id = 'sumBreakdown';
      breakdownEl.style.cssText =
        'font-size:12px;color:var(--ink-500);padding:10px;background:var(--ink-50);border-radius:8px;margin-top:12px';
      host.appendChild(breakdownEl);
    }
  }
  if (breakdownEl && items.length) {
    breakdownEl.innerHTML = `
      <div style="display:flex;justify-content:space-between"><span>Seller receives</span><span>${formatKES(sellerPayout(subtotal))}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Rider earns</span><span>${formatKES(dc.riderEarns)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>SokoShamba fee</span><span>${formatKES(commission + dc.platformFee)}</span></div>`;
  } else if (breakdownEl) {
    breakdownEl.innerHTML = '';
  }
}

/* ================================================== STEP 1: DELIVERY */
function deliveryStep() {
  const user = store.getUser();
  const d = delivery || {};
  const items = cart.items();
  const sellerCounty = items[0]?.county || '';

  if (d.county) deliveryOpts.distanceKm = estimateDistance(sellerCounty, d.county);
  deliveryOpts.weightKg = estimateWeight(items);

  stepEl.innerHTML = `
  <form class="card card--pad" id="deliveryForm" novalidate>
    <h2 style="font-size:var(--fs-md)" class="mb-4">📍 Delivery information</h2>
    <div class="grid-2">
      <div class="field"><label for="name">Recipient name <span class="req">*</span></label>
        <input class="input" id="name" name="name" value="${escapeHtml(d.name || user?.fullName || '')}" autocomplete="name" required></div>
      <div class="field"><label for="phone">Phone <span class="req">*</span></label>
        <input class="input" id="phone" name="phone" type="tel" value="${escapeHtml(d.phone || user?.phone || '')}" autocomplete="tel" placeholder="0712345678" required></div>
    </div>
    <div class="grid-2">
      <div class="field"><label for="county">County <span class="req">*</span></label>
        <select class="select" id="county" name="county" required><option value="">Select</option>
        ${COUNTIES.map((c) => `<option ${d.county === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="field"><label for="town">Town / market <span class="req">*</span></label>
        <input class="input" id="town" name="town" value="${escapeHtml(d.town || '')}" placeholder="e.g. Eldoret" required></div>
    </div>
    <div class="field"><label for="line">Delivery address <span class="req">*</span></label>
      <input class="input" id="line" name="line" value="${escapeHtml(d.line || '')}" placeholder="e.g. Plot 12, Kapsoya" required></div>
    <div class="field"><label for="notes">Delivery notes (optional)</label>
      <textarea class="textarea" id="notes" name="notes" placeholder="Access, preferred time…">${escapeHtml(d.notes || '')}</textarea></div>

    <h2 style="font-size:var(--fs-md)" class="mb-3 mt-5">🚛 Delivery options</h2>
    <div class="grid-2">
      <div class="field"><label for="vehicle">Vehicle type</label>
        <select class="select" id="vehicle" name="vehicle">
          <option value="boda" ${deliveryOpts.vehicle === 'boda' ? 'selected' : ''}>🏍️ Boda-boda (up to 50kg)</option>
          <option value="pickup" ${deliveryOpts.vehicle === 'pickup' ? 'selected' : ''}>🚚 Pickup / Van (up to 200kg)</option>
        </select></div>
      <div class="field"><label for="distanceKm">Est. distance (km)</label>
        <input class="input" id="distanceKm" name="distanceKm" type="number" min="1" value="${deliveryOpts.distanceKm}"></div>
    </div>
    <div class="field">
      <label>Special handling (adds to fee)</label>
      <div class="chips">
        ${Object.entries(HANDLING_EXTRAS).map(([k, v]) => `
          <label class="chip" style="cursor:pointer">
            <input type="checkbox" name="extras" value="${k}" ${deliveryOpts.extras.includes(k) ? 'checked' : ''} style="margin-right:4px">
            ${escapeHtml(v.label)}
          </label>`).join('')}
      </div>
    </div>

    <div id="feeEstimate" class="alert alert--info mt-4"></div>

    <div class="form-actions">
      <a class="btn btn--outline" href="cart.html">Back to cart</a>
      <button class="btn btn--primary" type="submit">Continue to payment</button>
    </div>
  </form>`;

  const form = qs('#deliveryForm');
  const schema = {
    name: [rules.required, rules.minLen(3)], phone: [rules.required, rules.phone],
    county: [rules.required], town: [rules.required], line: [rules.required, rules.minLen(5)]
  };
  liveValidate(form, schema);

  const updateFee = () => {
    deliveryOpts.vehicle = qs('#vehicle').value;
    deliveryOpts.distanceKm = Number(qs('#distanceKm').value) || 0;
    deliveryOpts.weightKg = estimateWeight(items);
    deliveryOpts.extras = Array.from(form.querySelectorAll('input[name="extras"]:checked')).map((c) => c.value);
    const dc = calculateDelivery(deliveryOpts);
    qs('#feeEstimate').innerHTML = `
      <span aria-hidden="true">💰</span>
      <div><strong>Estimated delivery: ${formatKES(dc.totalFee)}</strong><br>
      <span class="small">Rider earns ${formatKES(dc.riderEarns)} · Platform ${formatKES(dc.platformFee)}
      · Vehicle: ${dc.vehicleRequired}${dc.vehicleRequired !== deliveryOpts.vehicle ? ' (auto-upgraded for weight)' : ''}</span></div>`;
    renderSummary();
  };

  form.addEventListener('change', updateFee);
  form.addEventListener('input', updateFee);
  updateFee();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { valid, values } = validateForm(form, schema);
    if (!valid) return;
    delivery = { ...values, phone: normalizePhone(values.phone) };
    write(KEYS.settings, { ...read(KEYS.settings, {}), lastDelivery: delivery });
    step = 2; render();
  });
}

/* =================================================== STEP 2: PAYMENT */
function paymentStep() {
  stepEl.innerHTML = `
  <form class="card card--pad" id="paymentForm" novalidate>
    <h2 style="font-size:var(--fs-md)" class="mb-4">💳 Payment method</h2>

    <div class="alert alert--info">
      <span aria-hidden="true">🔒</span>
      <div><strong>Escrow protection.</strong> Your payment is held safely by SokoShamba and released to the seller
      only after you confirm receiving the goods.</div>
    </div>

    ${PAYSTACK.testMode ? `
    <div class="alert alert--warn mt-3">
      <span aria-hidden="true">🧪</span>
      <div><strong>Test mode.</strong> Use M-Pesa number <code>${PAYSTACK.testMpesaSuccess}</code> — no real money is charged.</div>
    </div>` : ''}

    <div class="choice-grid mt-4">
      <label class="choice"><input type="radio" name="method" value="mpesa" ${paymentMethod === 'mpesa' ? 'checked' : ''}>
        <span style="font-size:1.6rem;flex:none" aria-hidden="true">📱</span>
        <span><span class="choice__title">M-Pesa</span><span class="choice__desc">Get an STK push on your phone. Enter your PIN to pay instantly.</span></span></label>
      <label class="choice"><input type="radio" name="method" value="card" ${paymentMethod === 'card' ? 'checked' : ''}>
        <span style="font-size:1.6rem;flex:none" aria-hidden="true">💳</span>
        <span><span class="choice__title">Card</span><span class="choice__desc">Visa / Mastercard on Paystack's secure checkout.</span></span></label>
    </div>

    <div id="mpesaBox" class="field mt-5">
      <label for="mpesaPhone">M-Pesa number <span class="req">*</span></label>
      <input class="input" id="mpesaPhone" name="mpesaPhone" type="tel"
        value="${escapeHtml(mpesaPhone || delivery?.phone || '')}" placeholder="0712345678">
      <p class="hint">You'll receive a payment prompt on this number.</p>
    </div>

    <div class="form-actions">
      <button class="btn btn--outline" type="button" id="backBtn">Back</button>
      <button class="btn btn--primary" type="submit">Review order</button>
    </div>
  </form>`;

  const form = qs('#paymentForm');
  const sync = () => {
    paymentMethod = form.elements.method.value;
    qs('#mpesaBox').style.display = paymentMethod === 'mpesa' ? '' : 'none';
  };
  form.addEventListener('change', sync);
  sync();

  qs('#backBtn').addEventListener('click', () => { step = 1; render(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (paymentMethod === 'mpesa') {
      const { valid } = validateForm(form, { mpesaPhone: [rules.required, rules.phone] });
      if (!valid) return;
      mpesaPhone = form.elements.mpesaPhone.value;
    }
    step = 3; render();
  });
}

/* ==================================================== STEP 3: REVIEW */
function reviewStep() {
  const items = cart.items();
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const dc = calculateDelivery(deliveryOpts);
  const total = subtotal + dc.totalFee;
  const labels = { mpesa: '📱 M-Pesa STK Push', card: '💳 Card' };

  stepEl.innerHTML = `
  <div class="card card--pad">
    <h2 style="font-size:var(--fs-md)" class="mb-4">📋 Review your order</h2>
    ${items.map((i) => `<div class="list-row">
      <img class="list-row__img" src="${i.image}" alt="" loading="lazy" data-emoji="${i.emoji}" data-label="${escapeHtml(i.name)}">
      <div class="list-row__main"><strong>${escapeHtml(i.name)}</strong><small>${i.qty} × ${formatKES(i.price)} · ${escapeHtml(i.seller)}</small></div>
      <strong>${formatKES(i.qty * i.price)}</strong></div>`).join('')}

    <div class="divider"></div>
    <div class="grid-2">
      <div><h3 style="font-size:var(--fs-base)">📍 Deliver to</h3>
        <p class="small muted mt-2">${escapeHtml(delivery.name)}<br>${escapeHtml(delivery.phone)}<br>
        ${escapeHtml(delivery.line)}, ${escapeHtml(delivery.town)}, ${escapeHtml(delivery.county)}</p>
        <button class="btn btn--ghost btn--sm mt-2" id="editDelivery">Edit</button></div>
      <div><h3 style="font-size:var(--fs-base)">🚛 Delivery</h3>
        <p class="small muted mt-2">${deliveryOpts.vehicle} · ${deliveryOpts.distanceKm}km · ${deliveryOpts.weightKg}kg<br>
        Fee: <strong>${formatKES(dc.totalFee)}</strong></p></div>
    </div>

    <div class="divider"></div>
    <div class="summary__row"><span>Products subtotal</span><strong>${formatKES(subtotal)}</strong></div>
    <div class="summary__row"><span>Delivery fee</span><strong>${formatKES(dc.totalFee)}</strong></div>
    <div class="summary__row total"><span>Total (you pay)</span><strong>${formatKES(total)}</strong></div>

    <div class="alert alert--info mt-4">
      <span aria-hidden="true">💳</span>
      <div><strong>Paying with:</strong> ${labels[paymentMethod] || paymentMethod}
      ${paymentMethod === 'mpesa' ? `<br>Prompt goes to <strong>${escapeHtml(mpesaPhone || delivery.phone)}</strong>` : ''}</div>
    </div>

    <label class="filter-option"><input type="checkbox" id="confirmTerms"> I confirm the order details and accept SokoShamba's terms.</label>

    <div class="form-actions">
      <button class="btn btn--outline" type="button" id="backBtn2">Back</button>
      <button class="btn btn--primary btn--lg" type="button" id="placeOrder">🎯 Place order · ${formatKES(total)}</button>
    </div>
  </div>`;

  qs('#editDelivery').addEventListener('click', () => { step = 1; render(); });
  qs('#backBtn2').addEventListener('click', () => { step = 2; render(); });
  qs('#placeOrder').addEventListener('click', placeOrder);
}

/* ---------------------------------------------------- place the order */
async function placeOrder(e) {
  if (!qs('#confirmTerms').checked) {
    toast('Please confirm the order details before placing the order.', 'warn');
    qs('#confirmTerms').focus();
    return;
  }
  const btn = e.currentTarget;
  setButtonLoading(btn, true, 'Placing order…');

  const items = cart.items();
  const dc = calculateDelivery(deliveryOpts);

  const { data: order, error } = await orders.create({ items, address: delivery, paymentMethod });
  if (error) { setButtonLoading(btn, false); return toast(error.message, 'error'); }
  placedOrder = order;

  if (!isDemo()) {
    try {
      const sb = await getSupabase();
      const sellerCounty = items[0]?.county || '';
      await sb.from('delivery_jobs').insert({
        order_id: order.dbId,
        status: 'available',
        vehicle_type: dc.vehicleRequired,
        distance_km: deliveryOpts.distanceKm,
        weight_kg: deliveryOpts.weightKg,
        extras: deliveryOpts.extras,
        fee_total: dc.totalFee,
        rider_earns: dc.riderEarns,
        platform_earns: dc.platformFee,
        pickup_county: sellerCounty,
        pickup_location: sellerCounty ? sellerCounty + ' area' : '',
        dropoff_county: delivery.county,
        dropoff_location: delivery.line
      });
    } catch (err) {
      console.warn('[checkout] Could not create delivery job:', err);
    }
  }

  setButtonLoading(btn, false);
  cart.clear();
  refreshHeaderBadges();
  store.pushNotification({
    type: 'order', title: `Order ${order.id} placed`,
    body: `${items.length} item(s) · ${formatKES(order.total)}. Complete payment to confirm.`
  });
  automation.sendEvent('SELLER_NEW_ORDER', { orderId: order.id, sellerId: order.sellerId });

  step = 4;
  render();
}

/* ============================================== STEP 4: CONFIRMATION */
function confirmationStep() {
  const o = placedOrder;
  if (!o) { stepEl.innerHTML = '<div class="card card--pad"><p>No order to show.</p></div>'; return; }

  stepEl.innerHTML = `
  <div class="card card--pad text-center">
    <div style="font-size:3rem" aria-hidden="true">🎉</div>
    <h2 class="mt-3">Order placed!</h2>
    <p class="lead mt-2">Reference: <strong>${escapeHtml(o.id)}</strong></p>

    <div id="paymentZone" class="mt-5"></div>

    <div class="alert alert--success mt-4" style="text-align:left">
      <span aria-hidden="true">🚛</span>
      <div><strong>Delivery job created!</strong> Riders in ${escapeHtml(delivery.county)} can now see your order.</div>
    </div>

    <div class="form-actions" style="justify-content:center">
      <a class="btn btn--outline" href="order-details.html?id=${encodeURIComponent(o.id)}">Track my order</a>
      <a class="btn btn--ghost" href="marketplace.html">Continue shopping</a>
    </div>
  </div>`;

  const zone = qs('#paymentZone');

  if (isDemo() || !PAYSTACK.publicKey) {
    zone.innerHTML = `
      <div class="alert alert--warn" style="text-align:left">
        <span aria-hidden="true">🧪</span>
        <div>Payments are not connected in this environment. Your order was recorded successfully.</div>
      </div>`;
    return;
  }

  zone.innerHTML = `
    <button class="btn btn--primary btn--lg btn--block" id="payNowBtn">
      ${paymentMethod === 'mpesa' ? '📱' : '💳'} Pay ${formatKES(o.total)} ${paymentMethod === 'mpesa' ? 'with M-Pesa' : 'by card'}
    </button>
    ${paymentMethod === 'mpesa' ? `<p class="small muted mt-2">Prompt goes to ${escapeHtml(mpesaPhone || delivery.phone)}</p>` : ''}`;

  qs('#payNowBtn').addEventListener('click', () => triggerPayment(zone));
}

/* ---------------------------------------------------- payment trigger */
async function triggerPayment(zone) {
  const o = placedOrder;
  zone.innerHTML = `<div class="state" style="padding:24px">
    <div class="spinner"></div><p>Sending payment request…</p></div>`;

  const { data, error } = await payments.createPayment({
    orderId: o.id,
    amount: o.total,
    email: store.getUser()?.email,
    method: paymentMethod,
    phone: mpesaPhone || delivery.phone
  });

  if (error) {
    zone.innerHTML = `
      <div class="alert alert--error" style="text-align:left">
        <span aria-hidden="true">⛔</span>
        <div><strong>Payment could not start.</strong><br>${escapeHtml(error.message)}</div>
      </div>
      <button class="btn btn--outline btn--block mt-3" id="retryPayBtn">Try again</button>`;
    qs('#retryPayBtn')?.addEventListener('click', () => triggerPayment(zone));
    return;
  }

  if (paymentMethod === 'card' && data.authorization_url) {
    zone.innerHTML = `<div class="alert alert--info"><span aria-hidden="true">💳</span>
      <div>Opening secure card checkout…</div></div>`;
    window.location.href = data.authorization_url;
    return;
  }

  startPaymentPolling(zone, data);
}

/* --------------------------------------------------- payment polling */
async function startPaymentPolling(zone, pay) {
  const o = placedOrder;

  zone.innerHTML = `
    <div class="card card--pad" style="background:var(--green-50);border-color:var(--green-300);text-align:left">
      <div style="text-align:center">
        <div style="font-size:2.5rem" aria-hidden="true">📱</div>
        <h3 class="mt-2" style="font-size:var(--fs-md)">Check your phone</h3>
        <p class="small mt-2">${escapeHtml(pay.message || 'Enter your M-Pesa PIN to complete the payment.')}</p>
        <p class="mt-3"><strong style="font-size:1.4rem">${formatKES(o.total)}</strong></p>
      </div>
      <div class="progress mt-4"><span id="payProgress" style="width:0%"></span></div>
      <p class="small muted mt-2" style="text-align:center" id="payTimer">Waiting for confirmation…</p>
    </div>`;

  const bar = qs('#payProgress');
  const timer = qs('#payTimer');

  const { data: result } = await payments.waitForPayment(pay.reference, {
    maxSeconds: 120,
    onTick: ({ elapsed, remaining }) => {
      if (bar) bar.style.width = `${(elapsed / 120) * 100}%`;
      if (timer) timer.textContent = `Waiting for confirmation… ${remaining}s remaining`;
    }
  });

  if (result?.status === 'success') {
    zone.innerHTML = `
      <div class="alert alert--success" style="text-align:left">
        <span aria-hidden="true">✅</span>
        <div><strong>Payment confirmed!</strong> ${formatKES(o.total)} received.
        Your money is held safely in escrow until you confirm delivery.</div>
      </div>`;
    toast('Payment successful! 🎉', 'success');
    store.pushNotification({
      type: 'payment', title: `Payment confirmed for ${o.id}`,
      body: `${formatKES(o.total)} paid. Seller notified.`
    });
  } else if (result?.status === 'failed') {
    zone.innerHTML = `
      <div class="alert alert--error" style="text-align:left">
        <span aria-hidden="true">⛔</span>
        <div><strong>Payment failed.</strong> No money was deducted. You can try again.</div>
      </div>
      <button class="btn btn--primary btn--block mt-3" id="retryPayBtn">Try payment again</button>`;
    qs('#retryPayBtn')?.addEventListener('click', () => triggerPayment(zone));
    toast('Payment failed. Please try again.', 'error');
  } else {
    zone.innerHTML = `
      <div class="alert alert--warn" style="text-align:left">
        <span aria-hidden="true">⏳</span>
        <div><strong>Still waiting.</strong> If you completed the payment it may take a moment to reflect.
        Check your order page shortly, or contact us on WhatsApp.</div>
      </div>
      <div class="grid gap-2 mt-3">
        <a class="btn btn--outline btn--block" href="order-details.html?id=${encodeURIComponent(o.id)}">Check order status</a>
        <button class="btn btn--ghost btn--block" id="retryPayBtn">Try payment again</button>
      </div>`;
    qs('#retryPayBtn')?.addEventListener('click', () => triggerPayment(zone));
  }
}

/* ================================================== MAIN RENDER LOOP */
function render() {
  renderStepper();

  if (step === 4) {
    renderSummary();
    confirmationStep();
    return;
  }

  if (!cart.items().length) {
    stepEl.innerHTML = `<div class="card card--pad">${emptyState('Nothing to check out',
      'Your cart is empty. Add items from the marketplace to place an order.',
      { href: 'marketplace.html', label: 'Browse marketplace' })}</div>`;
    renderSummary();
    return;
  }

  renderSummary();
  if (step === 1) deliveryStep();
  else if (step === 2) paymentStep();
  else reviewStep();
}

render();
