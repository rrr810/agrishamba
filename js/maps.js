/**
 * map.js — Interactive Kenyan Delivery Route & County Mapping
 * Uses Leaflet + OpenStreetMap tiles with Kenya coordinates dictionary.
 */

export const KENYA_COORDS = {
  'Nairobi': [-1.286389, 36.817223],
  'Uasin Gishu': [0.514277, 35.26978],
  'Eldoret': [0.514277, 35.26978],
  'Moiben': [0.8167, 35.3833],
  'Nakuru': [-0.303099, 36.080025],
  'Naivasha': [-0.7172, 36.4310],
  'Njoro': [-0.3396, 35.9416],
  'Kiambu': [-1.1714, 36.8356],
  'Ruaka': [-1.2056, 36.7778],
  'Thika': [-1.0333, 37.0694],
  'Machakos': [-1.5177, 37.2634],
  'Mombasa': [-4.0435, 39.6682],
  'Kisumu': [-0.0917, 34.768],
  'Meru': [0.0463, 37.6559],
  'Nyeri': [-0.4197, 36.9501],
  'Kakamega': [0.2827, 34.7519],
  'Bungoma': [0.5696, 34.5584],
  'Trans Nzoia': [1.0157, 35.0062],
  'Kitale': [1.0157, 35.0062],
  'Nyandarua': [-0.1804, 36.3688],
  'Kirinyaga': [-0.4989, 37.2803],
  'Embu': [-0.5388, 37.4596],
  'Kilifi': [-3.6305, 39.8499],
  'Kwale': [-4.1738, 39.4521],
  'Kajiado': [-1.8519, 36.7820],
  'Muranga': [-0.7210, 37.1526],
  'Bomet': [-0.7813, 35.3416],
  'Kericho': [-0.3689, 35.2863],
  'Nandi': [0.1836, 35.1056],
  'Elgeyo-Marakwet': [0.8037, 35.4782],
  'Baringo': [0.4907, 35.7416],
  'Laikipia': [0.0167, 37.0728],
  'Nanyuki': [0.0167, 37.0728],
  'Narok': [-1.0833, 35.8667],
  'Homa Bay': [-0.5273, 34.4571],
  'Migori': [-1.0634, 34.4731],
  'Kisii': [-0.6817, 34.7667],
  'Nyamira': [-0.5633, 34.9358],
  'Siaya': [0.0607, 34.2881],
  'Busia': [0.4608, 34.1115],
  'Vihiga': [0.0767, 34.7222],
  'Tharaka-Nithi': [-0.2974, 37.8687],
  'Kitui': [-1.3670, 38.0106],
  'Makueni': [-1.8041, 37.6203],
  'Taita-Taveta': [-3.3161, 38.3574],
  'Garissa': [-0.4532, 39.6460],
  'Wajir': [1.7471, 40.0573],
  'Mandera': [3.9373, 41.8569],
  'Marsabit': [2.3284, 37.9899],
  'Isiolo': [0.3546, 37.5822],
  'Samburu': [1.2155, 36.9385],
  'Turkana': [3.1199, 35.5966],
  'Lodwar': [3.1199, 35.5966],
  'West Pokot': [1.2389, 35.1119],
  'Lamu': [-2.2717, 40.9020],
  'Tana River': [-1.4997, 40.0334]
};

export function getCoordinates(name, fallback = [-1.286389, 36.817223]) {
  if (!name) return fallback;
  const clean = String(name).trim();
  for (const [key, coords] of Object.entries(KENYA_COORDS)) {
    if (clean.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(clean.toLowerCase())) {
      return coords;
    }
  }
  return fallback;
}

export function calculateDistanceKm(c1, c2) {
  const [lat1, lon1] = c1;
  const [lat2, lon2] = c2;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

let leafletPromise = null;
export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve(window.L);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return leafletPromise;
}

export async function renderRouteMap(container, {
  pickupCounty = 'Uasin Gishu',
  pickupLocation = 'Moiben Depot',
  dropoffCounty = 'Nairobi',
  dropoffLocation = 'Embakasi',
  status = 'In Transit'
} = {}) {
  if (!container) return;

  const pCoords = getCoordinates(pickupLocation || pickupCounty, [0.514277, 35.26978]);
  const dCoords = getCoordinates(dropoffLocation || dropoffCounty, [-1.286389, 36.817223]);
  const distance = calculateDistanceKm(pCoords, dCoords) || 280;
  const estHours = Math.max(1, Math.round(distance / 50));

  container.style.position = 'relative';
  container.style.height = '280px';
  container.style.borderRadius = 'var(--radius-md, 8px)';
  container.style.overflow = 'hidden';
  container.style.border = '1px solid var(--border, #e2e8f0)';

  const mapDivId = 'map-' + Math.random().toString(36).substr(2, 9);
  container.innerHTML = `
    <div id="${mapDivId}" style="width:100%;height:100%;min-height:280px;background:#f0fdf4"></div>
    <div style="position:absolute;bottom:10px;left:10px;right:10px;background:rgba(255,255,255,0.95);backdrop-filter:blur(4px);padding:8px 12px;border-radius:6px;font-size:12px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:1000">
      <div><strong>🛣️ ${distance} km</strong> · Approx ${estHours}h delivery</div>
      <span class="badge badge--green" style="font-size:11px">${status}</span>
    </div>
  `;

  const L = await loadLeaflet();
  if (L && document.getElementById(mapDivId)) {
    try {
      const map = L.map(mapDivId, { zoomControl: true, attributionControl: false });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

      const createIcon = (emoji, color) => L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background:${color};color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 3px 8px rgba(0,0,0,0.3);border:2px solid #fff">${emoji}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      L.marker(pCoords, { icon: createIcon('🧑‍🌾', '#0f5132') }).addTo(map).bindPopup(`<strong>Pickup:</strong> ${pickupLocation || pickupCounty}`);
      L.marker(dCoords, { icon: createIcon('🏁', '#2563eb') }).addTo(map).bindPopup(`<strong>Drop-off:</strong> ${dropoffLocation || dropoffCounty}`);

      const polyline = L.polyline([pCoords, dCoords], { color: '#0f5132', weight: 4, opacity: 0.8, dashArray: '8, 8' }).addTo(map);
      map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
      return map;
    } catch (_) {}
  }
}