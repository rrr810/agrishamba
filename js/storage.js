/**
 * storage.js — Safe localStorage wrapper.
 * Only non-sensitive client state is persisted (cart, UI prefs, demo session).
 * NEVER store passwords, tokens with long life, or payment card data here.
 */

const PREFIX = 'sokoshamba:';

export const KEYS = Object.freeze({
  session: PREFIX + 'session',
  users: PREFIX + 'users',
  cart: PREFIX + 'cart',
  orders: PREFIX + 'orders',
  products: PREFIX + 'products',
  favorites: PREFIX + 'favorites',
  savedArticles: PREFIX + 'saved-articles',
  notifications: PREFIX + 'notifications',
  settings: PREFIX + 'settings',
  drafts: PREFIX + 'listing-drafts',
  calculator: PREFIX + 'calculator',
  theme: PREFIX + 'theme',
  services: PREFIX + 'services'
});

export function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[storage] read failed for', key, err);
    return fallback;
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('[storage] write failed for', key, err);
    return false;
  }
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch (_) {}
}

export function clearAll() {
  Object.values(KEYS).forEach(remove);
}

/** Seed a key once (used to hydrate demo data on first run). */
export function seed(key, value) {
  if (localStorage.getItem(key) === null) write(key, value);
  return read(key, value);
}
