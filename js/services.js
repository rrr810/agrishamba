/** services.js — services directory, provider listing form and service detail. */
import { services } from './api.js';
import { store } from './state.js';
import { COUNTIES } from './config.js';
import { rules, validateForm, liveValidate } from './validation.js';
import {
  qs, getParam, formatKES, escapeHtml, loadingState, emptyState, errorState,
  toast, debounce, setButtonLoading, modal
} from './ui.js';

const TYPES = [
  ['transport', 'Transport & Logistics'], ['storage', 'Storage & Warehousing'], ['machinery', 'Machinery & Tractors'],
  ['labour', 'Farm Labour'], ['veterinary', 'Veterinary Services'], ['consulting', 'Agronomy & Consulting'],
  ['irrigation', 'Irrigation'], ['equipment', 'Equipment Rental']
];

const card = (s) => `
  <article class="service-card">
    <div class="service-card__icon" aria-hidden="true">${s.emoji || '🧰'}</div>
    <h3 style="font-size:var(--fs-base)">${escapeHtml(s.name)}</h3>
    <p class="small muted">${escapeHtml(s.provider)} · 📍 ${escapeHtml(s.location)}, ${escapeHtml(s.county)}</p>
    <p class="small" style="color:var(--ink-700)">${escapeHtml(s.description.slice(0, 110))}…</p>
    <div class="flex items-center justify-between wrap gap-2 mt-2">
      <span class="price" style="font-size:var(--fs-md)">${formatKES(s.price)} <small>/ ${escapeHtml(s.unit)}</small></span>
      ${s.verified ? '<span class="badge badge--green badge--verified">Verified</span>' : '<span class="badge badge--warn">Unverified</span>'}
    </div>
    <div class="flex gap-2 mt-3">
      <a class="btn btn--primary btn--sm" href="service-detail.html?id=${encodeURIComponent(s.id)}" style="flex:1">View &amp; book</a>
    </div>
  </article>`;

/* ---------------------------------------------------------- DIRECTORY */
const grid = qs('#serviceGrid');
if (grid) {
  const typeSel = qs('#typeFilter'), countySel = qs('#countyFilter'), search = qs('#svcSearch');
  typeSel.insertAdjacentHTML('beforeend', TYPES.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''));
  countySel.insertAdjacentHTML('beforeend', COUNTIES.map((c) => `<option>${c}</option>`).join(''));

  const load = async () => {
    grid.innerHTML = loadingState('Loading services…');
    const { data, error } = await services.list({ type: typeSel.value, county: countySel.value, search: search.value });
    if (error) return (grid.innerHTML = errorState(error.message));
    grid.innerHTML = data.length ? data.map(card).join('')
      : emptyState('No services found', 'Try another service type or county, or list your own service below.');
  };
  load();
  typeSel.addEventListener('change', load);
  countySel.addEventListener('change', load);
  search.addEventListener('input', debounce(load, 300));

  /* provider form */
  const form = qs('#serviceForm');
  qs('#svcType').insertAdjacentHTML('beforeend', TYPES.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''));
  qs('#svcCounty').insertAdjacentHTML('beforeend', COUNTIES.map((c) => `<option>${c}</option>`).join(''));
  const schema = {
    name: [rules.required, rules.minLen(4)], type: [rules.required], county: [rules.required],
    location: [rules.required], price: [rules.required, rules.positive], unit: [rules.required],
    description: [rules.required, rules.minLen(30)]
  };
  liveValidate(form, schema);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { valid, values } = validateForm(form, schema);
    if (!valid) return toast('Please complete the highlighted fields.', 'error');
    const user = store.getUser();
    const btn = form.querySelector('button[type="submit"]');
    setButtonLoading(btn, true, 'Publishing…');
    await new Promise((r) => setTimeout(r, 500));
    store.addService({
      id: 'svc-' + Date.now(), ...values, price: Number(values.price),
      provider: user?.fullName || 'Demo Provider', providerId: user?.id || 'demo',
      rating: 0, verified: !!user?.verified, emoji: '🧰'
    });
    setButtonLoading(btn, false);
    form.reset();
    toast('Service published to the directory.', 'success');
    load();
  });
}

/* ------------------------------------------------------------- DETAIL */
const detail = qs('#serviceContainer');
if (detail) {
  const id = getParam('id');
  (async () => {
    if (!id) return (detail.innerHTML = errorState('No service was specified.'));
    detail.innerHTML = loadingState('Loading service…');
    const { data: s, error } = await services.get(id);
    if (error) return (detail.innerHTML = errorState(error.message));
    document.title = `${s.name} — SokoShamba`;
    qs('#crumbName').textContent = s.name;
    detail.innerHTML = `
    <div class="cart-layout mt-4">
      <div class="card card--pad">
        <div class="flex gap-3 items-center mb-4">
          <div class="service-card__icon" aria-hidden="true">${s.emoji}</div>
          <div><h1 style="font-size:var(--fs-xl)">${escapeHtml(s.name)}</h1>
            <p class="small muted">${escapeHtml(TYPES.find((t) => t[0] === s.type)?.[1] || s.type)} · 📍 ${escapeHtml(s.location)}, ${escapeHtml(s.county)}</p></div>
        </div>
        <p style="color:var(--ink-700)">${escapeHtml(s.description)}</p>
        <div class="divider"></div>
        <dl class="spec-list">
          <div><dt>Provider</dt><dd>${escapeHtml(s.provider)}</dd></div>
          <div><dt>Rate</dt><dd>${formatKES(s.price)} per ${escapeHtml(s.unit)}</dd></div>
          <div><dt>Rating</dt><dd>${s.rating ? '⭐ ' + s.rating : 'New provider'}</dd></div>
          <div><dt>Verification</dt><dd>${s.verified ? '✅ Verified provider' : '⚠️ Verification pending'}</dd></div>
        </dl>
        <p class="small muted mt-4">Demo listing. Agree scope and payment terms directly with the provider before work begins.</p>
      </div>
      <aside class="card card--pad">
        <h2 style="font-size:var(--fs-md)" class="mb-3">Request a booking</h2>
        <form id="bookForm" novalidate>
          <div class="field"><label for="bDate">Preferred date <span class="req">*</span></label>
            <input class="input" id="bDate" name="date" type="date" required></div>
          <div class="field"><label for="bQty">Quantity (${escapeHtml(s.unit)}s) <span class="req">*</span></label>
            <input class="input" id="bQty" name="qty" type="number" min="1" value="1" required></div>
          <div class="field"><label for="bNotes">Notes</label>
            <textarea class="textarea" id="bNotes" name="notes" placeholder="Location details, crop, access…"></textarea></div>
          <div class="summary__row total"><span>Estimated cost</span><strong id="bTotal">${formatKES(s.price)}</strong></div>
          <button class="btn btn--primary btn--block mt-3" type="submit">Send booking request</button>
        </form>
        <div id="bookResult" class="mt-3"></div>
      </aside>
    </div>`;

    const form = qs('#bookForm');
    const qty = qs('#bQty');
    qty.addEventListener('input', () => { qs('#bTotal').textContent = formatKES(Math.max(1, Number(qty.value) || 1) * s.price); });
    const schema = { date: [rules.required], qty: [rules.required, rules.positive] };
    liveValidate(form, schema);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { valid, values } = validateForm(form, schema);
      if (!valid) return;
      const btn = form.querySelector('button[type="submit"]');
      setButtonLoading(btn, true, 'Sending…');
      const { data } = await services.book(s.id, values);
      setButtonLoading(btn, false);
      qs('#bookResult').innerHTML = `<div class="alert alert--success"><span>✅</span><div>
        <strong>Booking request recorded.</strong> Reference ${escapeHtml(data.reference)}.
        The provider is notified once the backend is connected.</div></div>`;
      toast('Booking request sent (demo).', 'success');
    });
  })();
}
