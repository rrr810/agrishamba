/**
 * maps.js — Delivery route maps for SokoShamba.
 * Leaflet + OpenStreetMap tiles + OSRM road routing. Free, no API key.
 * County/town coordinates are bundled so maps work instantly offline.
 */
import { getSupabase } from './supabase-client.js';

/* ==================================================== KENYA PLACES DB */
/** [lat, lon] for all 47 county headquarters + major market towns. */
const PLACES = {
  'baringo': [0.4919, 35.7436], 'bomet': [-0.7800, 35.3500], 'bungoma': [0.5695, 34.5583],
  'busia': [0.4607, 34.1117], 'elgeyo-marakwet': [0.6700, 35.5080], 'embu': [-0.5399, 37.4574],
  'garissa': [-0.4532, 39.6461], 'homa bay': [-0.5273, 34.4571], 'isiolo': [0.3546, 37.5822],
  'kajiado': [-1.8528, 36.7825], 'kakamega': [0.2827, 34.7520], 'kericho': [-0.3677, 35.2833],
  'kiambu': [-1.0314, 36.8356], 'kilifi': [-3.6305, 39.8499], 'kirinyaga': [-0.4989, 37.2805],
  'kisii': [-0.6817, 34.7680], 'kisumu': [-0.0917, 34.7680], 'kitui': [-1.3669, 38.0106],
  'kwale': [-4.1817, 39.4568], 'laikipia': [0.0069, 37.0729], 'lamu': [-2.2717, 40.9020],
  'machakos': [-1.5177, 37.2634], 'makueni': [-1.7857, 37.6290], 'mandera': [3.9373, 41.8670],
  'marsabit': [2.3344, 37.9875], 'meru': [0.0469, 37.6489], 'migori': [-1.0634, 34.4731],
  'mombasa': [-4.0435, 39.6682], 'murang’a': [-0.7200, 37.1500], 'muranga': [-0.7200, 37.1500],
  'nairobi': [-1.2864, 36.8172], 'nakuru': [-0.3031, 36.0800], 'nandi': [0.2069, 35.1100],
  'narok': [-1.0833, 35.8667], 'nyamira': [-0.5667, 34.9333], 'nyandarua': [-0.2653, 36.3778],
  'nyeri': [-0.4167, 36.9500], 'samburu': [1.0968, 36.6986], 'siaya': [0.0619, 34.2881],
  'taita-taveta': [-3.3961, 38.5561], 'tana river': [-1.5000, 40.0333],
  'tharaka-nithi': [-0.3333, 37.6500], 'trans nzoia': [1.0157, 35.0062],
  'turkana': [3.1199, 35.5973], 'uasin gishu': [0.5143, 35.2698], 'vihiga': [0.0766, 34.7197],
  'wajir': [1.7471, 40.0573], 'west pokot': [1.2469, 35.1100],
  // major towns & markets
  'eldoret': [0.5143, 35.2698], 'kitale': [1.0157, 35.0062], 'nanyuki': [0.0069, 37.0729],
  'naivasha': [-0.7167, 36.4333], 'gilgil': [-0.4833, 36.2833], 'molo': [-0.1333, 35.7333],
  'rongai': [-0.1333, 35.9167], 'eldama ravine': [0.1833, 35.7500], 'kabarnet': [0.4919, 35.7436],
  'iten': [0.6700, 35.5080], 'kapsabet': [0.2069, 35.1100], 'kerugoya': [-0.4989, 37.2805],
  'thika': [-1.0333, 37.0833], 'limuru': [-1.1167, 36.6500], 'muranga': [-0.7200, 37.1500],
  'nyahururu': [0.0333, 36.3667], 'ol kalou': [-0.2653, 36.3778], 'wote': [-1.7857, 37.6290],
  'voi': [-3.3961, 38.5561], 'malindi': [-3.2167, 40.1167], 'busia': [0.4607, 34.1117],
  'narok town': [-1.0833, 35.8667], 'lodwar': [3.1199, 35.5973], 'kapenguria': [1.2469, 35.1100],
  'maralal': [1.0968, 36.6986], 'chuka': [-0.3333, 37.6500], 'sotik': [-0.7000, 35.2000],
  'mwea': [-0.7167, 37.3833], 'kangema': [-0.7167, 37.0333], 'embakasi': [-1.3167, 36.8833],
  'athi river': [-1.4500, 36.9667], 'ruiru': [-1.1500, 36.9500]
};

function resolvePlace(...names) {
  for (const raw of names) {
    if (!raw) continue;
    const key = String(raw).trim().toLowerCase();
    if (PLACES[key]) return { coords: PLACES[key], label: raw };
    // try matching a county name embedded in a longer string
    for (const [k, v] of Object.entries(PLACES)) {
      if (key.includes(k)) return { coords: v, label: raw };
    }
  }
  return null;
}

function haversineKm(a, b) {
  const R = 6371, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b[0] - a[0]), dLon = toR(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/* ============================================================ STYLING */
function injectMapStyles() {
  if (document.getElementById('soko-map-styles')) return;
  const s = document.createElement('style');
  s.id = 'soko-map-styles';
  s.textContent = `
    .soko-map { height: 340px; border-radius: 14px; overflow: hidden; z-index: 1; }
    .soko-pin { display:grid; place-items:center; width:38px; height:38px; border-radius:50% 50% 50% 0;
      transform: rotate(-45deg); box-shadow:0 4px 12px rgba(0,0,0,.3); border:2px solid #fff; }
    .soko-pin span { transform: rotate(45deg); font-size:17px; }
    .soko-pin--pickup { background: var(--green-600, #157347); }
    .soko-pin--drop   { background: #c2410c; }
    @keyframes sokoPulse { 0%{box-shadow:0 0 0 0 rgba(29,111,165,.5)} 70%{box-shadow:0 0 0 16px rgba(29,111,165,0)} 100%{box-shadow:0 0 0 0 rgba(29,111,165,0)} }
    .soko-you { width:16px; height:16px; background:#1d6fa5; border:3px solid #fff;
      border-radius:50%; box-shadow:0 0 0 0 rgba(29,111,165,.5); animation:sokoPulse 1.8s infinite; }
    .soko-dist { position:absolute; top:12px; left:12px; z-index:500; background:#fff;
      padding:7px 14px; border-radius:999px; font-weight:700; font-size:13px;
      box-shadow:0 4px 14px rgba(0,0,0,.18); font-family:'Plus Jakarta Sans',Inter,sans-serif; }
    .soko-legend { position:absolute; bottom:12px; left:12px; z-index:500; background:#fff;
      padding:8px 12px; border-radius:10px; font-size:12px; box-shadow:0 4px 14px rgba(0,0,0,.15);
      display:grid; gap:4px; }
    .soko-legend i { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:6px; }
  `;
  document.head.appendChild(s);
}

const pin = (type, emoji) => L.divIcon({
  className: '',
  html: `<div class="soko-pin soko-pin--${type}"><span>${emoji}</span></div>`,
  iconSize: [38, 38], iconAnchor: [19, 36], popupAnchor: [0, -34]
});

/* ============================================================ MAIN MAP */
export async function mountRouteMap(container, { pickupNames = [], dropNames = [], rider = false } = {}) {
  if (!window.L) { console.warn('[maps] Leaflet not loaded'); return; }
  injectMapStyles();

  const from = resolvePlace(...pickupNames);
  const to = resolvePlace(...dropNames);
  if (!from || !to) {
    container.innerHTML = `<div class="alert alert--warn"><span aria-hidden="true">🗺️</span>
      <div>We couldn't place both locations on the map yet — add a town name to the order for a precise pin.</div></div>`;
    container.hidden = false;
    return;
  }

  container.hidden = false;
  container.innerHTML = `
    <div style="position:relative">
      <div class="soko-map" id="sokoMapEl"></div>
      <div class="soko-dist" id="sokoDist">…</div>
      <div class="soko-legend">
        <div><i style="background:#157347"></i>Pickup — ${escape(from.label)}</div>
        <div><i style="background:#c2410c"></i>Delivery — ${escape(to.label)}</div>
        ${rider ? '<div><i style="background:#1d6fa5"></i>You (live)</div>' : ''}
      </div>
    </div>
    ${rider ? `<button class="btn btn--outline btn--sm mt-3" id="sokoLocate">📍 Show my live position</button>` : ''}`;

  const map = L.map(container.querySelector('#sokoMapEl'), { scrollWheelZoom: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  const mFrom = L.marker(from.coords, { icon: pin('pickup', '📦') }).addTo(map)
    .bindPopup(`<strong>Pickup</strong><br>${escape(from.label)}`);
  const mTo = L.marker(to.coords, { icon: pin('drop', '🏠') }).addTo(map)
    .bindPopup(`<strong>Delivery</strong><br>${escape(to.label)}`);

  map.fitBounds([from.coords, to.coords], { padding: [50, 50] });

  // Real road route via OSRM (free). Falls back to a straight line.
  const distEl = container.querySelector('#sokoDist');
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/` +
      `${from.coords[1]},${from.coords[0]};${to.coords[1]},${to.coords[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.length) {
      const route = data.routes[0];
      L.geoJSON(route.geometry, {
        style: { color: '#157347', weight: 5, opacity: 0.85 }
      }).addTo(map);
      distEl.textContent = `🚛 ${(route.distance / 1000).toFixed(0)} km by road · ~${Math.round(route.duration / 60)} min`;
      return;
    }
    throw new Error('no route');
  } catch {
    L.polyline([from.coords, to.coords], { color: '#157347', weight: 4, dashArray: '8 8', opacity: 0.8 }).addTo(map);
    distEl.textContent = `🚛 ~${haversineKm(from.coords, to.coords)} km (straight line)`;
  }

  // Rider live position
  if (rider) {
    container.querySelector('#sokoLocate')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      btn.disabled = true; btn.textContent = '📡 Locating…';
      if (!navigator.geolocation) { btn.textContent = 'Not supported'; return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const here = [pos.coords.latitude, pos.coords.longitude];
          L.marker(here, { icon: L.divIcon({ className: '', html: '<div class="soko-you"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }) })
            .addTo(map).bindPopup('You are here').openPopup();
          map.panTo(here);
          btn.textContent = '✅ Position shown';
        },
        () => { btn.disabled = false; btn.textContent = '📍 Location unavailable'; },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  function escape(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
}

/* ==================================================== RIDER PAGE WIRING */
/** Listens for [data-route] buttons on active delivery job cards. */
export function initRiderRouteButtons() {
  if (!window.L) return;
  let slot = document.getElementById('routeMapSlot');
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-route]');
    if (!btn) return;
    e.stopPropagation();

    if (!slot) {
      slot = document.createElement('section');
      slot.id = 'routeMapSlot';
      slot.className = 'card card--pad mt-4';
      const anchor = document.getElementById('activeDeliveriesCard');
      if (anchor) anchor.before(slot);
    }
    slot.innerHTML = `<div class="flex justify-between items-center wrap gap-2 mb-3">
      <h2 style="font-size:var(--fs-md)">🗺️ Delivery route</h2>
      <button class="btn btn--ghost btn--sm" id="closeMap">✕ Close</button></div>
      <div id="routeMapBody"><div class="state" style="padding:24px"><div class="spinner"></div><p>Drawing route…</p></div></div>`;
    slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
    slot.querySelector('#closeMap').addEventListener('click', () => slot.remove());

    await mountRouteMap(slot.querySelector('#routeMapBody'), {
      pickupNames: [btn.dataset.pickupLoc, btn.dataset.pickup],
      dropNames: [btn.dataset.dropoffLoc, btn.dataset.dropoff],
      rider: true
    });
  });
}

/* ================================================ ORDER PAGE ROUTE MAP */
/** Renders a route map into #orderRouteMap using data attributes + seller lookup. */
export async function initOrderRouteMap() {
  const el = document.getElementById('orderRouteMap');
  if (!el || !window.L) return;
  const { pickup, pickupLoc, dropoff, dropoffLoc, sellerId } = el.dataset;

  let pickupNames = [pickupLoc, pickup];
  if ((!pickup && sellerId)) {
    try {
      const sb = await getSupabase();
      const { data } = await sb.from('profiles')
        .select('county, location').eq('id', sellerId).maybeSingle();
      if (data) pickupNames = [data.location, data.county];
    } catch { /* stay with whatever we have */ }
  }

  await mountRouteMap(el, {
    pickupNames,
    dropNames: [dropoffLoc, dropoff]
  });
}

