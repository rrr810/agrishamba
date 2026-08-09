/**
 * cart.js — Cart logic (demo mode persists to localStorage).
 * The shape matches the future `cart_items` Supabase table so the service
 * layer can sync it to an authenticated user without UI changes.
 */
import { store } from './state.js';
import { calcDelivery, platformFee } from './api.js';

export const cart = {
  items() { return store.getCart(); },
  count() { return store.cartCount(); },

  add(product, qty = 1) {
    if (!product) return { ok: false, message: 'Product unavailable.' };
    if (product.quantity <= 0) return { ok: false, message: 'This product is out of stock.' };
    const items = store.getCart();
    const existing = items.find((i) => i.productId === product.id);
    const nextQty = (existing?.qty || 0) + qty;
    if (nextQty > product.quantity) {
      return { ok: false, message: `Only ${product.quantity} ${product.unit} available from this seller.` };
    }
    if (existing) existing.qty = nextQty;
    else items.push({
      productId: product.id, name: product.name, price: product.price, unit: product.unit,
      qty, image: product.images?.[0] || '', seller: product.seller, sellerId: product.sellerId,
      county: product.county, emoji: product.emoji || '🌿', max: product.quantity
    });
    store.setCart(items);
    return { ok: true, message: `${product.name} added to cart.` };
  },

  setQty(productId, qty) {
    const items = store.getCart();
    const item = items.find((i) => i.productId === productId);
    if (!item) return { ok: false, message: 'Item not in cart.' };
    const max = item.max || 9999;
    if (qty < 1) return this.remove(productId);
    if (qty > max) return { ok: false, message: `Only ${max} ${item.unit} available.` };
    item.qty = qty;
    store.setCart(items);
    return { ok: true };
  },

  increment(productId) {
    const item = store.getCart().find((i) => i.productId === productId);
    return this.setQty(productId, (item?.qty || 0) + 1);
  },
  decrement(productId) {
    const item = store.getCart().find((i) => i.productId === productId);
    return this.setQty(productId, (item?.qty || 1) - 1);
  },
  remove(productId) {
    store.setCart(store.getCart().filter((i) => i.productId !== productId));
    return { ok: true, message: 'Item removed from cart.' };
  },
  clear() { store.setCart([]); },

  totals(county = '') {
    const items = store.getCart();
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const delivery = items.length ? calcDelivery(items, county) : 0;
    const fee = platformFee(subtotal);
    return { subtotal, delivery, fee, total: subtotal + delivery, itemCount: items.reduce((n, i) => n + i.qty, 0) };
  }
};

export default cart;
