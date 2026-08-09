/**
 * state.js — Single source of truth for client state.
 * Persists to localStorage; the same shape is what the Supabase services
 * hydrate in production mode.
 */
import { KEYS, read, write, remove, seed } from './storage.js';
import { isDemo } from './config.js';
import { demoProducts, demoOrders, demoNotifications, demoServices } from '../data/demo-data.js';

const listeners = new Set();

function emit(event, payload) {
  listeners.forEach((fn) => { try { fn(event, payload); } catch (e) { console.error(e); } });
}

/** Bootstrap local caches. In demo mode, seed with rich sample data.
 *  In production, wipe stale demo caches once so real Supabase data owns the UI. */
const PROD_INIT_FLAG = 'sokoshamba:prod-initialised';
function bootstrap() {
  if (isDemo()) {
    seed(KEYS.products, demoProducts);
    seed(KEYS.orders, demoOrders);
    seed(KEYS.notifications, demoNotifications);
    seed(KEYS.services, demoServices);
  } else {
    // One-time cleanup when a browser flips from demo → production.
    if (!read(PROD_INIT_FLAG, false)) {
      [KEYS.products, KEYS.orders, KEYS.notifications, KEYS.services,
       KEYS.session, KEYS.cart, KEYS.favorites, KEYS.drafts, KEYS.savedArticles].forEach(remove);
      write(PROD_INIT_FLAG, true);
    }
    seed(KEYS.products, []);
    seed(KEYS.orders, []);
    seed(KEYS.notifications, []);
    seed(KEYS.services, []);
  }
  seed(KEYS.cart, []);
  seed(KEYS.favorites, []);
  seed(KEYS.savedArticles, []);
  seed(KEYS.settings, {
    emailOrders: true, emailMarketing: false, smsAlerts: true,
    priceAlerts: true, language: 'en', currency: 'KES', compactCards: false
  });
}
bootstrap();

export const store = {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit,

  /* -------------------------------------------------------- session */
  getUser() { return read(KEYS.session, null); },
  setUser(user) { write(KEYS.session, user); emit('user', user); },
  clearUser() { write(KEYS.session, null); emit('user', null); },

  /* ------------------------------------------------------- products */
  getProducts() { return read(KEYS.products, []); },
  setProducts(list) { write(KEYS.products, list); emit('products', list); },
  getProduct(id) { return this.getProducts().find((p) => p.id === id) || null; },
  addProduct(product) {
    const list = this.getProducts();
    list.unshift(product);
    this.setProducts(list);
    return product;
  },
  /** Insert or update-in-place a product by id (used by Supabase-backed fetch). */
  upsertProduct(product) {
    const list = this.getProducts();
    const idx = list.findIndex((p) => p.id === product.id);
    if (idx === -1) list.unshift(product); else list[idx] = { ...list[idx], ...product };
    this.setProducts(list);
    return product;
  },
  updateProduct(id, patch) {
    const list = this.getProducts().map((p) => (p.id === id ? { ...p, ...patch } : p));
    this.setProducts(list);
    return list.find((p) => p.id === id);
  },
  deleteProduct(id) { this.setProducts(this.getProducts().filter((p) => p.id !== id)); },

  /* ----------------------------------------------------------- cart */
  getCart() { return read(KEYS.cart, []); },
  setCart(items) { write(KEYS.cart, items); emit('cart', items); },
  cartCount() { return this.getCart().reduce((n, i) => n + i.qty, 0); },

  /* ------------------------------------------------------- favorites */
  getFavorites() { return read(KEYS.favorites, []); },
  isFavorite(id) { return this.getFavorites().includes(id); },
  toggleFavorite(id) {
    const favs = this.getFavorites();
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
    write(KEYS.favorites, next);
    emit('favorites', next);
    return next.includes(id);
  },

  /* -------------------------------------------------- saved articles */
  getSavedArticles() { return read(KEYS.savedArticles, []); },
  toggleSavedArticle(id) {
    const list = this.getSavedArticles();
    const next = list.includes(id) ? list.filter((a) => a !== id) : [...list, id];
    write(KEYS.savedArticles, next);
    emit('saved-articles', next);
    return next.includes(id);
  },

  /* --------------------------------------------------------- orders */
  getOrders() { return read(KEYS.orders, []); },
  setOrders(list) { write(KEYS.orders, list); emit('orders', list); },
  addOrder(order) { const l = this.getOrders(); l.unshift(order); this.setOrders(l); return order; },
  getOrder(id) { return this.getOrders().find((o) => o.id === id) || null; },
  updateOrder(id, patch) {
    this.setOrders(this.getOrders().map((o) => (o.id === id ? { ...o, ...patch } : o)));
    return this.getOrder(id);
  },

  /* ------------------------------------------------------- services */
  getServices() { return read(KEYS.services, []); },
  addService(svc) { const l = this.getServices(); l.unshift(svc); write(KEYS.services, l); emit('services', l); return svc; },

  /* -------------------------------------------------- notifications */
  getNotifications() { return read(KEYS.notifications, []); },
  setNotifications(list) { write(KEYS.notifications, list); emit('notifications', list); },
  unreadCount() { return this.getNotifications().filter((n) => !n.read).length; },
  pushNotification(n) {
    const list = this.getNotifications();
    list.unshift({
      id: 'ntf-' + Date.now(), read: false,
      at: new Date().toISOString().slice(0, 16).replace('T', ' '),
      ...n
    });
    this.setNotifications(list);
  },
  markRead(id) { this.setNotifications(this.getNotifications().map((n) => (n.id === id ? { ...n, read: true } : n))); },
  markAllRead() { this.setNotifications(this.getNotifications().map((n) => ({ ...n, read: true }))); },

  /* ------------------------------------------------------- settings */
  getSettings() { return read(KEYS.settings, {}); },
  updateSettings(patch) {
    const next = { ...this.getSettings(), ...patch };
    write(KEYS.settings, next); emit('settings', next); return next;
  },

  /* --------------------------------------------------------- drafts */
  getDrafts() { return read(KEYS.drafts, []); },
  saveDraft(draft) {
    const list = this.getDrafts().filter((d) => d.id !== draft.id);
    list.unshift(draft); write(KEYS.drafts, list); emit('drafts', list); return draft;
  },
  deleteDraft(id) { write(KEYS.drafts, this.getDrafts().filter((d) => d.id !== id)); emit('drafts', null); }
};

/** Keep tabs in sync. */
window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('sokoshamba:')) emit('external', e.key);
});
