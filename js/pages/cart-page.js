/** cart-page.js — cart rendering and quantity controls. */
import { cart } from '../cart.js';
import { COUNTIES } from '../config.js';
import { qs, formatKES, escapeHtml, emptyState, toast, confirmDialog, refreshHeaderBadges, page } from '../ui.js';
import { read, write, KEYS } from '../storage.js';

const itemsEl = qs('#cartItems');
const countySelect = qs('#deliveryCounty');
countySelect.insertAdjacentHTML('beforeend', COUNTIES.map((c) => `<option>${c}</option>`).join(''));

const prefs = read(KEYS.settings, {});
if (prefs.deliveryCounty) countySelect.value = prefs.deliveryCounty;

function render() {
  const items = cart.items();
  qs('#itemCount').textContent = items.length;

  if (!items.length) {
    itemsEl.innerHTML = emptyState('Your cart is empty',
      'Browse the marketplace and add produce, inputs or equipment to get started.',
      { href: 'marketplace.html', label: 'Browse marketplace' });
    qs('#checkoutBtn').classList.add('hide');
    updateTotals();
    return;
  }
  qs('#checkoutBtn').classList.remove('hide');

  itemsEl.innerHTML = items.map((i) => `
    <div class="cart-item">
      <img src="${i.image}" alt="${escapeHtml(i.name)}" loading="lazy" data-emoji="${i.emoji || '🌿'}" data-label="${escapeHtml(i.name)}">
      <div class="list-row__main">
        <a href="product.html?id=${encodeURIComponent(i.productId)}"><strong>${escapeHtml(i.name)}</strong></a>
        <small>${escapeHtml(i.seller)} · ${escapeHtml(i.county)}</small>
        <p class="small mt-1">${formatKES(i.price)} / ${escapeHtml(i.unit)}</p>
        <div class="flex items-center gap-3 mt-2">
          <div class="qty">
            <button type="button" data-dec="${i.productId}" aria-label="Decrease quantity of ${escapeHtml(i.name)}">−</button>
            <input type="number" min="1" value="${i.qty}" data-qty="${i.productId}" aria-label="Quantity of ${escapeHtml(i.name)}">
            <button type="button" data-inc="${i.productId}" aria-label="Increase quantity of ${escapeHtml(i.name)}">+</button>
          </div>
          <button class="btn btn--ghost btn--sm" data-remove="${i.productId}" style="color:var(--danger-600)">Remove</button>
        </div>
      </div>
      <div style="text-align:right"><strong>${formatKES(i.price * i.qty)}</strong></div>
    </div>`).join('');

  updateTotals();
}

function updateTotals() {
  const t = cart.totals(countySelect.value);
  qs('#sumSubtotal').textContent = formatKES(t.subtotal);
  qs('#sumDelivery').textContent = t.delivery ? formatKES(t.delivery) : '—';
  qs('#sumFee').textContent = formatKES(t.fee);
  qs('#sumTotal').textContent = formatKES(t.total);
  refreshHeaderBadges();
}

itemsEl.addEventListener('click', async (e) => {
  const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]'), rem = e.target.closest('[data-remove]');
  if (inc) { const r = cart.increment(inc.dataset.inc); if (!r.ok) toast(r.message, 'warn'); render(); }
  if (dec) { cart.decrement(dec.dataset.dec); render(); }
  if (rem) {
    const yes = await confirmDialog({ title: 'Remove item', message: 'Remove this item from your cart?', confirmLabel: 'Remove', danger: true });
    if (yes) { cart.remove(rem.dataset.remove); toast('Item removed from cart.', 'success'); render(); }
  }
});

itemsEl.addEventListener('change', (e) => {
  const input = e.target.closest('[data-qty]');
  if (!input) return;
  const r = cart.setQty(input.dataset.qty, Number(input.value));
  if (!r.ok) toast(r.message, 'warn');
  render();
});

countySelect.addEventListener('change', () => {
  write(KEYS.settings, { ...read(KEYS.settings, {}), deliveryCounty: countySelect.value });
  updateTotals();
});

qs('#clearCart').addEventListener('click', async () => {
  if (!cart.items().length) return toast('Your cart is already empty.', 'info');
  const yes = await confirmDialog({ title: 'Clear cart', message: 'This removes every item from your cart. Continue?', confirmLabel: 'Clear cart', danger: true });
  if (yes) { cart.clear(); toast('Cart cleared.', 'success'); render(); }
});

render();
