/**
 * api.js — Backend service abstraction.
 *   Demo mode  → localStorage simulation
 *   Production → Supabase (Postgres + Storage) + Paystack Edge Functions
 */
import { SUPABASE, PAYSTACK, AUTOMATION, isDemo, DELIVERY_FEE_BASE, PLATFORM_FEE_RATE } from './config.js';
import { store } from './state.js';
import { demoArticles, demoMarketPrices, demoUsers } from '../data/demo-data.js';
import { getSupabase } from './supabase-client.js';

const latency = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const ok = (data) => ({ data, error: null });
const fail = (message) => ({ data: null, error: { message } });

const isUuid = (v) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));

/** Race a promise against a timeout so the UI never hangs forever. */
const withTimeout = (promise, ms = 15000, label = 'Request') =>
  Promise.race([
    promise,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timed out. Check your connection.`)), ms))
  ]);

/* --------------------------------------------------------------- MAPPERS */
function mapProfile(row) {
  return {
    id: row.id, fullName: row.full_name, email: row.email,
    phone: row.phone || '', accountType: row.account_type,
    county: row.county || '', location: row.location || '',
    bio: row.bio || '', avatar: row.avatar_url || '',
    verified: !!row.verified, rating: Number(row.rating || 0),
    joined: (row.created_at || '').slice(0, 10)
  };
}

function mapProduct(row) {
  const imgs = (row.images || []).slice()
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((i) => i.url).filter(Boolean);
  const seller = Array.isArray(row.seller) ? row.seller[0] : row.seller;
  return {
    id: row.id,
    sellerId: row.seller_id,
    seller: seller?.full_name || 'Seller',
    verifiedSeller: !!seller?.verified,
    category: row.category_id,
    name: row.name,
    description: row.description || '',
    price: Number(row.price),
    unit: row.unit,
    quantity: Number(row.quantity),
    county: row.county || '',
    subCounty: row.sub_county || '',
    location: row.location || '',
    delivery: row.delivery_option || '',
    contactPreference: row.contact_preference || '',
    availability: row.availability || 'In Stock',
    emoji: row.emoji || '🌿',
    createdAt: (row.created_at || '').slice(0, 10),
    images: imgs.length ? imgs : [''],
    rating: Number(row.rating || 0),
    reviews: row.reviews_count || 0
  };
}

function mapOrder(row) {
  const items = (row.items || []).map((i) => ({
    productId: i.product_id, name: i.name_snapshot,
    price: Number(i.price_snapshot), unit: i.unit,
    qty: Number(i.qty), image: i.image_url || ''
  }));
  return {
    id: row.reference || row.id,
    dbId: row.id,
    userId: row.buyer_id, sellerId: row.seller_id,
    date: (row.created_at || new Date().toISOString()).slice(0, 10),
    subtotal: Number(row.subtotal || 0),
    delivery: Number(row.delivery_fee || 0),
    total: Number(row.total || 0),
    paymentMethod: row.payment_method || '',
    paymentStatus: row.payment_status || 'Pending',
    status: row.status || 'Pending',
    address: row.address || {},
    timeline: row.timeline || [],
    items
  };
}

function mapService(row) {
  const p = Array.isArray(row.provider) ? row.provider[0] : row.provider;
  return {
    id: row.id, providerId: row.provider_id,
    provider: p?.full_name || 'Provider',
    verified: !!row.verified,
    type: row.type, name: row.name,
    description: row.description || '',
    price: Number(row.price), unit: row.unit,
    county: row.county || '', location: row.location || '',
    rating: Number(row.rating || 0),
    emoji: row.emoji || '🧰'
  };
}

function mapArticle(row) {
  return {
    id: row.id, category: row.category, title: row.title,
    author: row.author || 'SokoShamba Advisory',
    date: (row.published_at || '').slice(0, 10),
    read: row.read_minutes || 5,
    image: row.image_url || '',
    excerpt: row.excerpt || '',
    body: row.body || ''
  };
}

function mapNotification(row) {
  return {
    id: row.id, type: row.type,
    title: row.title, body: row.body || '',
    read: !!row.read,
    at: (row.created_at || '').slice(0, 16).replace('T', ' ')
  };
}

/* ------------------------------------------------------------ HELPERS */
function dataUrlToBlob(dataUrl) {
  const [meta, b64] = String(dataUrl).split(',');
  const mime = meta.match(/data:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64 || '');
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function uploadImage(sb, bucket, path, src) {
  let blob;
  if (src.startsWith('data:')) blob = dataUrlToBlob(src);
  else blob = await fetch(src).then((r) => r.blob());
  const { error } = await sb.storage.from(bucket)
    .upload(path, blob, { contentType: blob.type, upsert: true });
  if (error) throw error;
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/* ============================================================ PRODUCTS */
const PRODUCT_SELECT = `
  id, seller_id, category_id, name, description, price, unit, quantity,
  county, sub_county, location, delivery_option, contact_preference,
  availability, emoji, status, rating, reviews_count, created_at,
  seller:profiles!products_seller_id_fkey(full_name, verified),
  images:product_images(url, position)
`;

/* ============================================================ PROFILES */
export const profiles = {
  async get(userId) {
    if (isDemo()) {
      await latency(200);
      const current = store.getUser();
      if (current && current.id === userId) return ok(current);
      const demo = demoUsers.find((u) => u.id === userId);
      return demo ? ok(demo) : fail('Profile not found.');
    }
    const sb = await getSupabase();
    const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) return fail(error.message);
    return data ? ok(mapProfile(data)) : fail('Profile not found.');
  },

  /** Public profile: info + published listings + stats */
  async getPublicProfile(userId) {
    if (isDemo()) {
      await latency(300);
      const demo = demoUsers.find((u) => u.id === userId);
      if (!demo) return fail('Profile not found.');
      const listings = store.getProducts().filter((p) => p.sellerId === userId);
      return ok({ profile: demo, listings,
        stats: { totalListings: listings.length, memberSince: demo.joined || '', totalSales: 0, rating: demo.rating || 0 } });
    }
    const sb = await getSupabase();
    const { data: profile, error: pErr } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (pErr) return fail(pErr.message);
    if (!profile) return fail('Profile not found.');

    const { data: prodRows } = await sb.from('products')
      .select(PRODUCT_SELECT).eq('seller_id', userId)
      .eq('status', 'published').order('created_at', { ascending: false });

    const { count: salesCount } = await sb.from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', userId).eq('payment_status', 'Paid');

    return ok({
      profile: mapProfile(profile),
      listings: (prodRows || []).map(mapProduct),
      stats: {
        totalListings: (prodRows || []).length,
        memberSince: (profile.created_at || '').slice(0, 10),
        totalSales: salesCount || 0,
        rating: Number(profile.rating || 0)
      }
    });
  },

  async update(patch) {
    const user = store.getUser();
    if (!user) return fail('You must be signed in.');
    if (isDemo()) {
      await latency(400);
      const next = { ...user, ...patch };
      store.setUser(next);
      return ok(next);
    }
    const sb = await getSupabase();
    const dbPatch = {
      full_name: patch.fullName, phone: patch.phone,
      account_type: patch.accountType, county: patch.county,
      location: patch.location, bio: patch.bio, avatar_url: patch.avatar
    };
    Object.keys(dbPatch).forEach((k) => dbPatch[k] === undefined && delete dbPatch[k]);
    const { data, error } = await sb.from('profiles').update(dbPatch)
      .eq('id', user.id).select('*').single();
    if (error) return fail(error.message);
    const next = mapProfile(data);
    store.setUser(next);
    return ok(next);
  },

  async uploadAvatar(file) {
    if (isDemo()) {
      await latency(500);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(ok({ url: reader.result }));
        reader.onerror = () => resolve(fail('Could not read the selected image.'));
        reader.readAsDataURL(file);
      });
    }
    const sb = await getSupabase();
    const user = store.getUser();
    if (!user) return fail('Sign in to upload an avatar.');
    try {
      const safe = (file.name || 'avatar').replace(/[^\w.\-]/g, '_');
      const path = `${user.id}/${Date.now()}-${safe}`;
      const { error } = await sb.storage.from(SUPABASE.buckets.avatars)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) return fail(error.message);
      const { data } = sb.storage.from(SUPABASE.buckets.avatars).getPublicUrl(path);
      return ok({ url: data.publicUrl });
    } catch (e) { return fail(e.message); }
  }
};

export const products = {
  async list({ search = '', categories = [], counties = [], min = null, max = null,
               sort = 'newest', page = 1, perPage = 12 } = {}) {
    if (isDemo()) {
      await latency(320);
      let rows = store.getProducts();
      const q = search.trim().toLowerCase();
      if (q) rows = rows.filter((p) => [p.name, p.seller, p.county, p.location, p.description]
        .join(' ').toLowerCase().includes(q));
      if (categories.length) rows = rows.filter((p) => categories.includes(p.category));
      if (counties.length) rows = rows.filter((p) => counties.includes(p.county));
      if (min !== null && min !== '') rows = rows.filter((p) => p.price >= Number(min));
      if (max !== null && max !== '') rows = rows.filter((p) => p.price <= Number(max));
      const sorters = {
        newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
        'price-asc': (a, b) => a.price - b.price,
        'price-desc': (a, b) => b.price - a.price,
        rating: (a, b) => (b.rating || 0) - (a.rating || 0),
        name: (a, b) => a.name.localeCompare(b.name)
      };
      rows = [...rows].sort(sorters[sort] || sorters.newest);
      const total = rows.length;
      const start = (page - 1) * perPage;
      return ok({ rows: rows.slice(start, start + perPage), total, page, perPage,
        pages: Math.max(1, Math.ceil(total / perPage)) });
    }

    const sb = await getSupabase();
    let q = sb.from('products').select(PRODUCT_SELECT, { count: 'exact' }).eq('status', 'published');
    if (search.trim()) {
      const t = `%${search.trim().replace(/[%_]/g, '\\$&')}%`;
      q = q.or(`name.ilike.${t},description.ilike.${t}`);
    }
    if (categories.length) q = q.in('category_id', categories);
    if (counties.length) q = q.in('county', counties);
    if (min !== null && min !== '') q = q.gte('price', Number(min));
    if (max !== null && max !== '') q = q.lte('price', Number(max));

    const orderMap = {
      newest: ['created_at', false], 'price-asc': ['price', true],
      'price-desc': ['price', false], rating: ['rating', false], name: ['name', true]
    };
    const [col, asc] = orderMap[sort] || orderMap.newest;
    q = q.order(col, { ascending: asc });
    const from = (page - 1) * perPage;
    q = q.range(from, from + perPage - 1);

    const { data, error, count } = await q;
    if (error) return fail(error.message);
    const rows = (data || []).map(mapProduct);
    rows.forEach((r) => store.upsertProduct(r));
    const total = count || 0;
    return ok({ rows, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) });
  },

  async get(id) {
    if (isDemo()) {
      await latency(220);
      const p = store.getProduct(id);
      return p ? ok(p) : fail('This product is no longer available.');
    }
    const sb = await getSupabase();
    const { data, error } = await sb.from('products').select(PRODUCT_SELECT).eq('id', id).maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail('This product is no longer available.');
    const product = mapProduct(data);
    store.upsertProduct(product);
    return ok(product);
  },

  async related(product, limit = 4) {
    if (isDemo()) {
      await latency(150);
      return ok(store.getProducts()
        .filter((p) => p.category === product.category && p.id !== product.id).slice(0, limit));
    }
    const sb = await getSupabase();
    const { data, error } = await sb.from('products').select(PRODUCT_SELECT)
      .eq('category_id', product.category).eq('status', 'published')
      .neq('id', product.id).limit(limit);
    if (error) return fail(error.message);
    return ok((data || []).map(mapProduct));
  },

  async create(payload) {
    if (isDemo()) {
      await latency(600);
      const user = store.getUser();
      const product = {
        id: 'prd-' + Date.now(),
        sellerId: user?.id || 'demo',
        seller: user?.fullName || 'Demo Seller',
        verifiedSeller: !!user?.verified,
        rating: 0, reviews: 0,
        createdAt: new Date().toISOString().slice(0, 10),
        availability: 'In Stock',
        ...payload
      };
      store.addProduct(product);
      return ok(product);
    }

    const sb = await getSupabase();
    const user = store.getUser();
    if (!user) return fail('Sign in to publish a listing.');
    const insertRow = {
      seller_id: user.id, category_id: payload.category,
      name: payload.name, description: payload.description,
      price: payload.price, unit: payload.unit, quantity: payload.quantity,
      county: payload.county, sub_county: payload.subCounty,
      location: payload.location, delivery_option: payload.delivery,
      contact_preference: payload.contactPreference,
      emoji: payload.emoji, status: 'published'
    };
    const { data: created, error } = await sb.from('products').insert(insertRow).select('id').single();
    if (error) return fail(error.message);

    const imgs = (payload.images || []).filter((i) => i && i !== '');
    if (imgs.length) {
      try {
        const uploaded = await Promise.all(imgs.map((img, idx) =>
          uploadImage(sb, SUPABASE.buckets.productImages,
            `${user.id}/${created.id}/${idx}-${Date.now()}.jpg`, img)));
        const rows = uploaded.map((url, position) => ({ product_id: created.id, url, position }));
        const { error: e2 } = await sb.from('product_images').insert(rows);
        if (e2) console.warn('[products.create] images:', e2.message);
      } catch (e) { console.warn('[products.create] upload:', e); }
    }

    const { data: full } = await sb.from('products').select(PRODUCT_SELECT).eq('id', created.id).single();
    const product = mapProduct(full || { id: created.id, ...insertRow, seller: null, images: [] });
    store.upsertProduct(product);
    return ok(product);
  },

  async update(id, patch) {
    if (isDemo()) { await latency(400); return ok(store.updateProduct(id, patch)); }
    const sb = await getSupabase();
    const user = store.getUser();
    const dbPatch = {
      name: patch.name, description: patch.description,
      price: patch.price, unit: patch.unit, quantity: patch.quantity,
      county: patch.county, sub_county: patch.subCounty,
      location: patch.location, delivery_option: patch.delivery,
      contact_preference: patch.contactPreference,
      category_id: patch.category, emoji: patch.emoji
    };
    Object.keys(dbPatch).forEach((k) => dbPatch[k] === undefined && delete dbPatch[k]);
    if (Object.keys(dbPatch).length) {
      const { error } = await sb.from('products').update(dbPatch).eq('id', id);
      if (error) return fail(error.message);
    }
    if (patch.images && user) {
      const imgs = patch.images.filter((i) => i && i !== '');
      await sb.from('product_images').delete().eq('product_id', id);
      if (imgs.length) {
        try {
          const uploaded = await Promise.all(imgs.map(async (img, idx) => {
            if (!img.startsWith('data:') && img.startsWith('http')) return img;
            return uploadImage(sb, SUPABASE.buckets.productImages,
              `${user.id}/${id}/${idx}-${Date.now()}.jpg`, img);
          }));
          const rows = uploaded.map((url, position) => ({ product_id: id, url, position }));
          await sb.from('product_images').insert(rows);
        } catch (e) { console.warn(e); }
      }
    }
    const { data: full } = await sb.from('products').select(PRODUCT_SELECT).eq('id', id).single();
    const product = full ? mapProduct(full) : store.getProduct(id);
    if (product) store.upsertProduct(product);
    return ok(product);
  },

  async remove(id) {
    if (isDemo()) { await latency(350); store.deleteProduct(id); return ok(true); }
    const sb = await getSupabase();
    const { error } = await sb.from('products').delete().eq('id', id);
    if (error) return fail(error.message);
    store.deleteProduct(id);
    return ok(true);
  },

  async mine() {
    const user = store.getUser();
    if (!user) return ok([]);
    if (isDemo()) {
      await latency(200);
      return ok(store.getProducts().filter((p) => p.sellerId === user.id));
    }
    const sb = await getSupabase();
    const { data, error } = await sb.from('products').select(PRODUCT_SELECT)
      .eq('seller_id', user.id).order('created_at', { ascending: false });
    if (error) return fail(error.message);
    const rows = (data || []).map(mapProduct);
    rows.forEach((r) => store.upsertProduct(r));
    return ok(rows);
  }
};

/* --------------------------------------------------------- CART SERVICE */
export const cartService = {
  async sync() { await latency(120); return ok(store.getCart()); }
};

/* =============================================================== ORDERS */
const ORDER_SELECT = `
  id, reference, buyer_id, seller_id, subtotal, delivery_fee, total,
  status, payment_status, payment_method, address, timeline, created_at,
  items:order_items(id, product_id, name_snapshot, price_snapshot, unit, qty, image_url)
`;

export const orders = {
  async list() {
    if (isDemo()) {
      await latency(300);
      const user = store.getUser();
      const rows = store.getOrders();
      if (!user) return ok(rows);
      if (user.accountType === 'admin') return ok(rows);
      const own = rows.filter((o) => o.sellerId === user.id || o.userId === user.id);
      return ok(own.length ? own : rows);
    }
    const sb = await getSupabase();
    const { data, error } = await sb.from('orders').select(ORDER_SELECT)
      .order('created_at', { ascending: false });
    if (error) return fail(error.message);
    return ok((data || []).map(mapOrder));
  },

  async get(id) {
    if (isDemo()) {
      await latency(200);
      const o = store.getOrder(id);
      return o ? ok(o) : fail('Order not found.');
    }
    const sb = await getSupabase();
    let { data } = await sb.from('orders').select(ORDER_SELECT).eq('reference', id).maybeSingle();
    if (!data && isUuid(id)) {
      ({ data } = await sb.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle());
    }
    return data ? ok(mapOrder(data)) : fail('Order not found.');
  },

  async create({ items, address, paymentMethod }) {
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const delivery = calcDelivery(items, address.county);

    if (isDemo()) {
      await latency(700);
      const order = {
        id: 'SS-' + Math.floor(10000 + Math.random() * 89999),
        userId: store.getUser()?.id || 'guest',
        sellerId: items[0]?.sellerId || 'usr-001',
        date: new Date().toISOString().slice(0, 10),
        items, subtotal, delivery,
        total: subtotal + delivery,
        paymentMethod, paymentStatus: 'Pending', status: 'Pending',
        address,
        timeline: [{ label: 'Order placed', at: new Date().toISOString().slice(0, 16).replace('T', ' ') }]
      };
      store.addOrder(order);
      automation.sendEvent('ORDER_CREATED', { orderId: order.id, total: order.total });
      return ok(order);
    }

    const sb = await getSupabase();
    const user = store.getUser();
    if (!user) return fail('Sign in to place an order.');

    const sellerId = items[0]?.sellerId;
    const orderRow = {
      buyer_id: user.id,
      seller_id: isUuid(sellerId) ? sellerId : null,
      subtotal,
      delivery_fee: delivery,
      total: subtotal + delivery,
      status: 'Pending',
      payment_status: 'Pending',
      payment_method: paymentMethod,
      address,
      timeline: [{ label: 'Order placed', at: new Date().toISOString().slice(0, 16).replace('T', ' ') }]
    };

    let created;
    try {
      const res = await withTimeout(
        sb.from('orders').insert(orderRow).select('id, reference').single(),
        15000, 'Creating order'
      );
      if (res.error) {
        console.error('[orders.create] insert failed:', res.error);
        return fail(res.error.message || 'Could not create the order.');
      }
      created = res.data;
    } catch (e) {
      console.error('[orders.create]', e);
      return fail(e.message || 'Could not reach the server.');
    }

    const itemRows = items.map((i) => ({
      order_id: created.id,
      product_id: isUuid(i.productId) ? i.productId : null,
      name_snapshot: i.name,
      price_snapshot: i.price,
      unit: i.unit,
      qty: i.qty,
      image_url: i.image || null
    }));

    try {
      const itemsRes = await withTimeout(
        sb.from('order_items').insert(itemRows), 15000, 'Saving order items'
      );
      if (itemsRes.error) console.warn('[orders.create] items:', itemsRes.error.message);
    } catch (e) {
      console.warn('[orders.create] items timeout:', e.message);
    }

    let full = null;
    try {
      const fullRes = await withTimeout(
        sb.from('orders').select(ORDER_SELECT).eq('id', created.id).single(), 10000, 'Loading order'
      );
      full = fullRes.data;
    } catch (e) {
      console.warn('[orders.create] fetch full failed:', e.message);
    }

    const order = mapOrder(full || {
      ...orderRow, id: created.id, reference: created.reference,
      created_at: new Date().toISOString(), items: itemRows
    });

    automation.sendEvent('ORDER_CREATED', { orderId: order.id, total: order.total });
    return ok(order);
  },

  async updateStatus(id, status) {
    if (isDemo()) {
      await latency(300);
      const order = store.getOrder(id);
      if (!order) return fail('Order not found.');
      const timeline = [...(order.timeline || []),
        { label: status, at: new Date().toISOString().slice(0, 16).replace('T', ' ') }];
      return ok(store.updateOrder(id, { status, timeline }));
    }
    const sb = await getSupabase();
    let { data: existing } = await sb.from('orders').select('id, timeline').eq('reference', id).maybeSingle();
    if (!existing && isUuid(id)) {
      ({ data: existing } = await sb.from('orders').select('id, timeline').eq('id', id).maybeSingle());
    }
    if (!existing) return fail('Order not found.');
    const timeline = [...(existing.timeline || []),
      { label: status, at: new Date().toISOString().slice(0, 16).replace('T', ' ') }];
    const { error } = await sb.from('orders').update({ status, timeline }).eq('id', existing.id);
    if (error) return fail(error.message);
    const { data: full } = await sb.from('orders').select(ORDER_SELECT).eq('id', existing.id).single();
    return ok(mapOrder(full));
  }
};

export function calcDelivery(items, county = '') {
  const units = items.reduce((n, i) => n + i.qty, 0);
  const far = ['Mombasa', 'Turkana', 'Mandera', 'Wajir', 'Garissa', 'Marsabit', 'Lamu'].includes(county);
  return Math.round(DELIVERY_FEE_BASE + units * 45 + (far ? 900 : 0));
}
export const platformFee = (subtotal) => Math.round(subtotal * PLATFORM_FEE_RATE);

/* ============================================================= PAYMENTS */
export const payments = {
  async createPayment({ orderId, amount, email, method, phone }) {
    if (isDemo()) {
      await latency(1400);
      return ok({ reference: 'DEMO-' + orderId, status: 'pending', demo: true,
        message: 'Demo mode: no real payment was processed.' });
    }
    if (!PAYSTACK.publicKey) return fail('Payments are not configured yet.');

    try {
      const sb = await getSupabase();
      const { data: { session } } = await sb.auth.getSession();

      const res = await withTimeout(fetch(PAYSTACK.initializeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || SUPABASE.anonKey}`,
          'apikey': SUPABASE.anonKey
        },
        body: JSON.stringify({ orderId, email, phone, channel: method === 'mpesa' ? 'mpesa' : method })
      }), 30000, 'Payment request');

      const data = await res.json();
      if (!res.ok || data.error) return fail(data.error || 'Could not start the payment.');
      return ok(data);
    } catch (e) {
      console.error('[payments.createPayment]', e);
      return fail(e.message || 'Network error. Check your connection.');
    }
  },

  async checkPaymentStatus(reference) {
    if (isDemo()) { await latency(1200); return ok({ reference, status: 'pending', demo: true }); }
    try {
      const sb = await getSupabase();
      const { data, error } = await sb.from('payments')
        .select('status, amount, paid_at, order_id').eq('reference', reference).maybeSingle();
      if (error) return fail(error.message);
      if (!data) return ok({ reference, status: 'pending' });
      return ok({ reference, status: data.status, amount: data.amount, paidAt: data.paid_at });
    } catch (e) { return fail(e.message); }
  },

  async waitForPayment(reference, { maxSeconds = 120, intervalMs = 3000, onTick } = {}) {
    const started = Date.now();
    while (Date.now() - started < maxSeconds * 1000) {
      const { data } = await this.checkPaymentStatus(reference);
      const elapsed = Math.round((Date.now() - started) / 1000);
      if (onTick) onTick({ elapsed, remaining: maxSeconds - elapsed, status: data?.status });
      if (data?.status === 'success') return ok({ status: 'success', ...data });
      if (data?.status === 'failed') return ok({ status: 'failed', ...data });
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return ok({ status: 'timeout' });
  },

  async handleSuccess(orderId, reference) {
    automation.sendEvent('PAYMENT_COMPLETED', { orderId, reference });
    return ok(true);
  },
  async handleFailure(orderId, reason = 'Payment failed') { return ok({ reason }); },
  publicKeyConfigured: () => Boolean(PAYSTACK.publicKey)
};

/* --------------------------------------------------------------- WALLET */
export const wallet = {
  async balance() {
    const user = store.getUser();
    if (isDemo()) {
      await latency(200);
      const sales = store.getOrders()
        .filter((o) => o.sellerId === user?.id && o.paymentStatus === 'Paid')
        .reduce((s, o) => s + o.subtotal, 0);
      return ok({ available: Math.round(sales * 0.85), pending: Math.round(sales * 0.15), currency: 'KES' });
    }
    if (!user) return ok({ available: 0, pending: 0, currency: 'KES' });
    const sb = await getSupabase();
    const { data } = await sb.from('orders').select('subtotal, payment_status').eq('seller_id', user.id);
    const sales = (data || []).filter((o) => o.payment_status === 'Paid')
      .reduce((s, o) => s + Number(o.subtotal || 0), 0);
    return ok({ available: Math.round(sales * 0.85), pending: Math.round(sales * 0.15), currency: 'KES' });
  },
  async requestWithdrawal() { return fail('Withdrawals require the payouts backend. Coming soon.'); }
};

/* -------------------------------------------------------------- ADVISORY */
export const advisory = {
  async list({ search = '', category = 'All' } = {}) {
    if (isDemo()) {
      await latency(260);
      let rows = demoArticles;
      if (category && category !== 'All') rows = rows.filter((a) => a.category === category);
      const q = search.trim().toLowerCase();
      if (q) rows = rows.filter((a) => (a.title + a.excerpt + a.category).toLowerCase().includes(q));
      return ok(rows);
    }
    const sb = await getSupabase();
    let q = sb.from('advisory_articles').select('*').eq('is_published', true)
      .order('published_at', { ascending: false });
    if (category && category !== 'All') q = q.eq('category', category);
    if (search.trim()) {
      const t = `%${search.trim().replace(/[%_]/g, '\\$&')}%`;
      q = q.or(`title.ilike.${t},excerpt.ilike.${t}`);
    }
    const { data, error } = await q;
    if (error) return fail(error.message);
    const rows = (data || []).map(mapArticle);
    return ok(rows.length ? rows : demoArticles);
  },
  async get(id) {
    if (isDemo()) {
      await latency(180);
      const a = demoArticles.find((x) => x.id === id);
      return a ? ok(a) : fail('Article not found.');
    }
    const sb = await getSupabase();
    const { data } = await sb.from('advisory_articles').select('*').eq('id', id).maybeSingle();
    if (data) return ok(mapArticle(data));
    const a = demoArticles.find((x) => x.id === id);
    return a ? ok(a) : fail('Article not found.');
  }
};

/* -------------------------------------------------------------- SERVICES */
const SERVICE_SELECT = `
  id, provider_id, type, name, description, price, unit, county, location, verified, rating, emoji,
  provider:profiles!services_provider_id_fkey(full_name)
`;

export const services = {
  async list({ type = 'all', county = 'all', search = '' } = {}) {
    if (isDemo()) {
      await latency(240);
      let rows = store.getServices();
      if (type !== 'all') rows = rows.filter((s) => s.type === type);
      if (county !== 'all') rows = rows.filter((s) => s.county === county);
      const q = search.trim().toLowerCase();
      if (q) rows = rows.filter((s) => (s.name + s.provider + s.description).toLowerCase().includes(q));
      return ok(rows);
    }
    const sb = await getSupabase();
    let q = sb.from('services').select(SERVICE_SELECT);
    if (type !== 'all') q = q.eq('type', type);
    if (county !== 'all') q = q.eq('county', county);
    if (search.trim()) {
      const t = `%${search.trim().replace(/[%_]/g, '\\$&')}%`;
      q = q.or(`name.ilike.${t},description.ilike.${t}`);
    }
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok((data || []).map(mapService));
  },

  async get(id) {
    if (isDemo()) {
      await latency(160);
      const s = store.getServices().find((x) => x.id === id);
      return s ? ok(s) : fail('Service not found.');
    }
    const sb = await getSupabase();
    const { data, error } = await sb.from('services').select(SERVICE_SELECT).eq('id', id).maybeSingle();
    if (error) return fail(error.message);
    return data ? ok(mapService(data)) : fail('Service not found.');
  },

  async create(payload) {
    if (isDemo()) {
      const user = store.getUser();
      const svc = { id: 'svc-' + Date.now(), ...payload,
        provider: user?.fullName || 'Demo Provider', providerId: user?.id || 'demo',
        rating: 0, verified: !!user?.verified, emoji: payload.emoji || '🧰' };
      store.addService(svc);
      return ok(svc);
    }
    const sb = await getSupabase();
    const user = store.getUser();
    if (!user) return fail('Sign in to publish a service.');
    const row = {
      provider_id: user.id, type: payload.type, name: payload.name,
      description: payload.description, price: Number(payload.price),
      unit: payload.unit, county: payload.county, location: payload.location,
      emoji: payload.emoji || '🧰'
    };
    const { data, error } = await sb.from('services').insert(row).select(SERVICE_SELECT).single();
    if (error) return fail(error.message);
    return ok(mapService(data));
  },

  async book(serviceId, details) {
    if (isDemo()) {
      await latency(600);
      automation.sendEvent('SERVICE_BOOKING_REQUESTED', { serviceId, ...details });
      store.pushNotification({ type: 'order', title: 'Service booking requested',
        body: `Booking recorded. Reference ${String(serviceId).toUpperCase()}.` });
      return ok({ reference: 'BK-' + Date.now().toString().slice(-6) });
    }
    const sb = await getSupabase();
    const user = store.getUser();
    if (!user) return fail('Sign in to book a service.');
    const { data, error } = await sb.from('service_bookings').insert({
      service_id: serviceId, user_id: user.id, date: details.date,
      qty: Number(details.qty || 1), notes: details.notes || ''
    }).select('id').single();
    if (error) return fail(error.message);
    automation.sendEvent('SERVICE_BOOKING_REQUESTED', { serviceId, ...details });
    return ok({ reference: 'BK-' + data.id.slice(0, 6).toUpperCase() });
  }
};

/* --------------------------------------------------------- MARKET PRICES */
export const marketPrices = {
  async list({ crop = 'all', county = 'all' } = {}) {
    if (isDemo()) {
      await latency(220);
      let rows = demoMarketPrices;
      if (crop !== 'all') rows = rows.filter((r) => r.crop === crop);
      if (county !== 'all') rows = rows.filter((r) => r.county === county);
      return ok(rows);
    }
    const sb = await getSupabase();
    let q = sb.from('market_prices').select('*').order('recorded_on', { ascending: false });
    if (crop !== 'all') q = q.eq('crop', crop);
    if (county !== 'all') q = q.eq('county', county);
    const { data, error } = await q;
    if (error) return fail(error.message);
    const rows = (data || []).map((r) => ({
      crop: r.crop, market: r.market, county: r.county,
      price: Number(r.price), unit: r.unit, date: r.recorded_on, trend: Number(r.trend || 0)
    }));
    return ok(rows.length ? rows : demoMarketPrices);
  }
};

/* ---------------------------------------------------------- NOTIFICATIONS */
export const notificationsService = {
  async list() {
    if (isDemo()) { await latency(150); return ok(store.getNotifications()); }
    const sb = await getSupabase();
    const user = store.getUser();
    if (!user) return ok([]);
    const { data, error } = await sb.from('notifications').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (error) return fail(error.message);
    const rows = (data || []).map(mapNotification);
    store.setNotifications(rows);
    return ok(rows);
  },
  async markRead(id) {
    if (!isDemo()) {
      const sb = await getSupabase();
      await sb.from('notifications').update({ read: true }).eq('id', id);
    }
    store.markRead(id);
    return ok(true);
  },
  async markAllRead() {
    if (!isDemo()) {
      const sb = await getSupabase();
      const user = store.getUser();
      if (user) await sb.from('notifications').update({ read: true })
        .eq('user_id', user.id).eq('read', false);
    }
    store.markAllRead();
    return ok(true);
  }
};

/* ------------------------------------------------------------- AUTOMATION */
export const automation = {
  async sendEvent(eventName, payload = {}) {
    const entry = { event: eventName, payload, at: new Date().toISOString() };
    if (!AUTOMATION.enabled) {
      console.info('[automation:queued]', entry);
      return ok(entry);
    }
    try {
      await fetch(AUTOMATION.proxyEndpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry)
      });
      return ok(entry);
    } catch (e) { return fail(e.message); }
  }
};

/* ---------------------------------------------------------------- ADMIN */
export const adminService = {
  async metrics() {
    if (isDemo()) {
      await latency(300);
      const prods = store.getProducts();
      const ords = store.getOrders();
      const revenue = ords.filter((o) => o.paymentStatus === 'Paid').reduce((s, o) => s + o.total, 0);
      return ok({ users: demoUsers.length, farmers: 0, buyers: 0, suppliers: 0, serviceProviders: 0,
        products: prods.length, orders: ords.length, revenue, pendingReports: 0 });
    }
    const sb = await getSupabase();
    const [profs, prods, ords] = await Promise.all([
      sb.from('profiles').select('account_type'),
      sb.from('products').select('id', { count: 'exact', head: true }),
      sb.from('orders').select('total, payment_status')
    ]);
    const list = profs.data || [];
    const byType = (t) => list.filter((p) => p.account_type === t).length;
    const revenue = (ords.data || []).filter((o) => o.payment_status === 'Paid')
      .reduce((s, o) => s + Number(o.total), 0);
    return ok({
      users: list.length, farmers: byType('farmer'), buyers: byType('buyer'),
      suppliers: byType('supplier'), serviceProviders: byType('service') + byType('rider'),
      products: prods.count || 0, orders: (ords.data || []).length, revenue, pendingReports: 0
    });
  }
};

/* ==================================================== DELIVERY JOBS API */
export const deliveries = {
  async available() {
    if (isDemo()) { await latency(); return ok([]); }
    const sb = await getSupabase();
    const user = store.getUser();
    if (!user) return fail('Sign in to see available jobs.');

    const { data: rider } = await sb.from('rider_profiles')
      .select('active_county').eq('id', user.id).maybeSingle();
    const county = rider?.active_county || user.county || null;

    const { data, error } = await sb.from('delivery_jobs')
      .select(`
        id, order_id, status, vehicle_type, distance_km, weight_kg,
        fee_total, rider_earns, pickup_county, pickup_location,
        dropoff_county, dropoff_location, created_at,
        orders!inner(reference, total, address, buyer_id,
          buyer:profiles!orders_buyer_id_fkey(full_name, phone),
          items:order_items(name_snapshot, qty, unit))
      `)
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) return fail(error.message);
    const jobs = (data || []).map((j) => ({ ...j, isNearby: county && j.pickup_county === county }))
      .sort((a, b) => Number(b.isNearby) - Number(a.isNearby));
    return ok(jobs);
  },

  async myActive() {
    if (isDemo()) { await latency(); return ok([]); }
    const sb = await getSupabase();
    const user = store.getUser();
    if (!user) return ok([]);
    const { data, error } = await sb.from('delivery_jobs')
      .select(`
        id, order_id, status, vehicle_type, distance_km, weight_kg,
        fee_total, rider_earns, pickup_county, pickup_location,
        dropoff_county, dropoff_location, pickup_at, delivered_at, created_at,
        orders!inner(reference, address,
          buyer:profiles!orders_buyer_id_fkey(full_name, phone),
          seller:profiles!orders_seller_id_fkey(full_name, phone),
          items:order_items(name_snapshot, qty, unit))
      `)
      .eq('rider_id', user.id)
      .in('status', ['accepted', 'picked_up', 'delivered'])
      .order('created_at', { ascending: false });
    if (error) return fail(error.message);
    return ok(data || []);
  },

  async myCompleted() {
    if (isDemo()) { await latency(); return ok([]); }
    const sb = await getSupabase();
    const user = store.getUser();
    if (!user) return ok([]);
    const { data, error } = await sb.from('delivery_jobs')
      .select('id, order_id, fee_total, rider_earns, delivered_at, confirmed_at, orders!inner(reference)')
      .eq('rider_id', user.id).eq('status', 'confirmed')
      .order('confirmed_at', { ascending: false }).limit(50);
    if (error) return fail(error.message);
    return ok(data || []);
  },

  async accept(jobId) {
    if (isDemo()) return ok({ id: jobId });
    const sb = await getSupabase();
    const user = store.getUser();
    if (!user) return fail('Sign in first.');
    const { data, error } = await sb.from('delivery_jobs')
      .update({ rider_id: user.id, status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', jobId).eq('status', 'available').select().single();
    if (error) return fail(error.message);
    if (!data) return fail('Sorry, another rider grabbed this job first.');
    await sb.from('orders').update({ status: 'Rider Assigned' }).eq('id', data.order_id);
    return ok(data);
  },

  async markPickedUp(jobId) {
    if (isDemo()) return ok(true);
    const sb = await getSupabase();
    const { data, error } = await sb.from('delivery_jobs')
      .update({ status: 'picked_up', pickup_at: new Date().toISOString() })
      .eq('id', jobId).select().single();
    if (error) return fail(error.message);
    await sb.from('orders').update({ status: 'Out for Delivery' }).eq('id', data.order_id);
    return ok(data);
  },

  async markDelivered(jobId) {
    if (isDemo()) return ok(true);
    const sb = await getSupabase();
    const { data, error } = await sb.from('delivery_jobs')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', jobId).select().single();
    if (error) return fail(error.message);
    await sb.from('orders').update({ status: 'Delivered' }).eq('id', data.order_id);
    return ok(data);
  },

  async confirmReceived(jobId) {
    if (isDemo()) return ok(true);
    const sb = await getSupabase();
    const { data, error } = await sb.from('delivery_jobs')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', jobId).select().single();
    if (error) return fail(error.message);
    await sb.from('orders').update({ status: 'Confirmed by Buyer' }).eq('id', data.order_id);
    return ok(data);
  },

  async earnings() {
    if (isDemo()) return ok({ pending: 0, released: 0, total: 0, jobs: 0 });
    const sb = await getSupabase();
    const user = store.getUser();
    if (!user) return ok({ pending: 0, released: 0, total: 0, jobs: 0 });
    const { data } = await sb.from('delivery_jobs').select('rider_earns, status').eq('rider_id', user.id);
    const jobs = data || [];
    const released = jobs.filter((j) => j.status === 'confirmed')
      .reduce((s, j) => s + Number(j.rider_earns || 0), 0);
    const pending = jobs.filter((j) => ['accepted', 'picked_up', 'delivered'].includes(j.status))
      .reduce((s, j) => s + Number(j.rider_earns || 0), 0);
    return ok({ pending, released, total: released + pending, jobs: jobs.length });
  }
};

/* ==================================================== WHATSAPP HELPERS */
export function whatsappLink(phone, message) {
  const cleanPhone = String(phone || '').replace(/[^\d]/g, '');
  if (!cleanPhone) return null;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export const orderMessages = {
  paymentReceived: (o) => `✅ *SokoShamba* – Payment received for order *${o.reference || o.id}*.`,
  riderAssigned: (o, r) => `🚛 *SokoShamba* – Rider ${r.fullName} (${r.phone}) assigned to *${o.reference || o.id}*.`,
  pickedUp: (o) => `📦 *SokoShamba* – Order *${o.reference || o.id}* picked up and on the way!`,
  delivered: (o) => `🎯 *SokoShamba* – Order *${o.reference || o.id}* delivered. Please confirm in the app.`,
  confirmed: (o) => `✅ *SokoShamba* – Buyer confirmed *${o.reference || o.id}*. Payout within 24 hours.`
};

/* ==================================================== REVIEWS API */
export const reviews = {
  async listFor({ subjectId = null, productId = null, limit = 20 } = {}) {
    if (isDemo()) return ok([]);
    const sb = await getSupabase();
    let q = sb.from('reviews')
      .select(`id, rating, comment, review_type, created_at,
               reviewer:profiles!reviews_reviewer_id_fkey(full_name, county)`)
      .order('created_at', { ascending: false }).limit(limit);
    if (subjectId) q = q.eq('subject_id', subjectId);
    if (productId) q = q.eq('product_id', productId);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok((data || []).map((r) => {
      const rev = Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer;
      return {
        id: r.id, rating: Number(r.rating), comment: r.comment || '',
        type: r.review_type, date: (r.created_at || '').slice(0, 10),
        reviewerName: rev?.full_name || 'Anonymous', reviewerCounty: rev?.county || ''
      };
    }));
  },

  async submit({ orderId, subjectId, productId, rating, comment, reviewType = 'seller' }) {
    if (isDemo()) return ok(true);
    const sb = await getSupabase();
    const user = store.getUser();
    if (!user) return fail('Sign in to leave a review.');

    let orderUuid = orderId;
    if (orderId && typeof orderId === 'string' && !isUuid(orderId)) {
      const { data } = await sb.from('orders').select('id').eq('reference', orderId).maybeSingle();
      orderUuid = data?.id || null;
    }

    const { data, error } = await sb.from('reviews').insert({
      order_id: orderUuid,
      reviewer_id: user.id,
      subject_id: isUuid(subjectId) ? subjectId : null,
      product_id: isUuid(productId) ? productId : null,
      review_type: reviewType,
      rating: Math.round(rating),
      comment: comment || ''
    }).select().single();

    if (error) {
      if (String(error.message).includes('reviews_no_dup')) {
        return fail('You have already reviewed this order.');
      }
      return fail(error.message);
    }
    return ok(data);
  },

  async alreadyReviewed(orderId) {
    if (isDemo()) return false;
    const sb = await getSupabase();
    const user = store.getUser();
    if (!user) return false;
    let orderUuid = orderId;
    if (typeof orderId === 'string' && !isUuid(orderId)) {
      const { data } = await sb.from('orders').select('id').eq('reference', orderId).maybeSingle();
      orderUuid = data?.id || null;
    }
    if (!orderUuid) return false;
    const { data } = await sb.from('reviews').select('id')
      .eq('order_id', orderUuid).eq('reviewer_id', user.id).maybeSingle();
    return !!data;
  }
};
