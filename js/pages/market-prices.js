/** market-prices.js — demo market price table with filters and trend indicators. */
import { marketPrices } from '../api.js';
import { demoMarketPrices } from '../../data/demo-data.js';
import { qs, formatKES, formatDate, escapeHtml, loadingState, emptyState } from '../ui.js';

const cropSel = qs('#cropFilter');
const countySel = qs('#countyFilter');
const mount = qs('#pricesCard');

[...new Set(demoMarketPrices.map((r) => r.crop))].forEach((c) => cropSel.insertAdjacentHTML('beforeend', `<option>${c}</option>`));
[...new Set(demoMarketPrices.map((r) => r.county))].forEach((c) => countySel.insertAdjacentHTML('beforeend', `<option>${c}</option>`));

const trend = (t) => {
  if (t > 0) return `<span class="trend-up">▲ ${t.toFixed(1)}%</span>`;
  if (t < 0) return `<span class="trend-down">▼ ${Math.abs(t).toFixed(1)}%</span>`;
  return '<span class="trend-flat">— 0.0%</span>';
};

async function load() {
  mount.innerHTML = loadingState('Loading market prices…');
  const { data } = await marketPrices.list({ crop: cropSel.value, county: countySel.value });
  if (!data.length) {
    mount.innerHTML = emptyState('No prices for this selection', 'Try another crop or county.');
    return;
  }
  mount.innerHTML = `
    <div class="card__head"><h2>Reference prices</h2><span class="badge badge--demo">Demo dataset · ${data.length} rows</span></div>
    <div class="table-wrap"><table class="data">
      <caption class="sr-only">Reference crop prices by market</caption>
      <thead><tr><th scope="col">Crop</th><th scope="col">Market</th><th scope="col">County</th>
        <th scope="col">Price</th><th scope="col">Unit</th><th scope="col">Date</th><th scope="col">Weekly trend</th></tr></thead>
      <tbody>${data.map((r) => `<tr>
        <td><strong>${escapeHtml(r.crop)}</strong></td>
        <td>${escapeHtml(r.market)}</td>
        <td>${escapeHtml(r.county)}</td>
        <td>${formatKES(r.price)}</td>
        <td>${escapeHtml(r.unit)}</td>
        <td>${formatDate(r.date)}</td>
        <td>${trend(r.trend)}</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="card__foot small muted">Prices are indicative and exclude transport, levies and grading differences.</div>`;
}

cropSel.addEventListener('change', load);
countySel.addEventListener('change', load);
load();
