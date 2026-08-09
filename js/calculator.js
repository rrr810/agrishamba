/**
 * calculator.js — SokoShamba Farm Cost & Profit Calculator
 *
 * Real economics: region-adjusted yields, management multipliers,
 * three-scenario projection, break-even analysis and a sensitivity grid.
 */
import { rules, validateForm } from './validation.js';
import { qs, formatKES, formatNumber, escapeHtml, toast, page } from './ui.js';
import { read, write, KEYS } from './storage.js';
import { CROP_PROFILES, MANAGEMENT_LEVELS, REGION_YIELD } from './farm-data.js';
import { COUNTIES } from './config.js';
import { zoneFor } from './advisor-engine.js';

const form = qs('#calcForm');
const resultMount = qs('#resultCard');

const COST_FIELDS = ['seed', 'fertilizer', 'chemicals', 'labour', 'land', 'irrigation', 'transport', 'other'];
const LABELS = {
  seed: 'Seed / planting material', fertilizer: 'Fertilizer', chemicals: 'Chemicals & sprays',
  labour: 'Labour', land: 'Land preparation', irrigation: 'Irrigation',
  transport: 'Transport & marketing', other: 'Other costs'
};

/* ============================================================ SETUP UI */
function buildSelects() {
  qs('#cropSelect').innerHTML = `<option value="">Choose a crop…</option>` +
    Object.entries(CROP_PROFILES)
      .map(([id, c]) => `<option value="${id}">${c.emoji} ${escapeHtml(c.name)}</option>`).join('') +
    `<option value="custom">✏️ Something else (enter manually)</option>`;

  qs('#county').innerHTML = `<option value="">Select county…</option>` +
    COUNTIES.map((c) => `<option>${c}</option>`).join('');

  qs('#management').innerHTML = MANAGEMENT_LEVELS
    .map((m) => `<option value="${m.id}" ${m.id === 'standard' ? 'selected' : ''}>${m.label} — ${m.desc}</option>`)
    .join('');
}

/** Autofill costs, yield and price when a known crop is picked. */
function applyCropDefaults(cropId) {
  const c = CROP_PROFILES[cropId];
  const hint = qs('#cropHint');
  if (!c) { hint.innerHTML = ''; return; }

  const county = qs('#county').value;
  const zone = county ? zoneFor(county) : null;
  const regionMult = zone ? (REGION_YIELD[zone.rain] ?? 1) : 1;
  const mgmtId = qs('#management').value;
  const mgmt = MANAGEMENT_LEVELS.find((m) => m.id === mgmtId) || MANAGEMENT_LEVELS[1];

  COST_FIELDS.forEach((f) => {
    if (form.elements[f]) form.elements[f].value = c.costs[f] ?? 0;
  });

  form.elements.unit.value = c.unit;
  form.elements.yield.value = Math.round(c.yieldRange[1] * regionMult * mgmt.mult * 10) / 10;
  form.elements.price.value = c.priceRange[1];

  hint.innerHTML = `
    <div class="alert alert--info">
      <span aria-hidden="true">${c.emoji}</span>
      <div><strong>${escapeHtml(c.name)}</strong> — ${escapeHtml(c.note)}<br>
      <span class="small">Typical yield ${c.yieldRange[0]}–${c.yieldRange[2]} ${escapeHtml(c.unit)}/acre ·
      farmgate ${formatKES(c.priceRange[0])}–${formatKES(c.priceRange[2])}
      ${zone ? `· adjusted for ${escapeHtml(county)} (${escapeHtml(zone.rain)} rainfall)` : ''}
      · ${escapeHtml(mgmt.label)} management</span></div>
    </div>`;
}

/* =========================================================== COMPUTE */
function compute(v) {
  const acres = Number(v.size) || 0;
  const mgmt = MANAGEMENT_LEVELS.find((m) => m.id === v.management) || MANAGEMENT_LEVELS[1];
  const zone = v.county ? zoneFor(v.county) : null;
  const regionMult = zone ? (REGION_YIELD[zone.rain] ?? 1) : 1;

  const perAcre = COST_FIELDS.reduce((s, f) => s + (Number(v[f]) || 0), 0);
  const totalCost = perAcre * acres;

  const baseYieldPerAcre = Number(v.yield) || 0;
  const price = Number(v.price) || 0;

  const scenarios = {
    poor:   { label: 'Poor season',    yieldMult: 0.65, priceMult: 0.82 },
    likely: { label: 'Likely outcome', yieldMult: 1.00, priceMult: 1.00 },
    good:   { label: 'Good season',    yieldMult: 1.30, priceMult: 1.18 }
  };

  const results = {};
  for (const [key, s] of Object.entries(scenarios)) {
    const y = baseYieldPerAcre * acres * s.yieldMult;
    const p = price * s.priceMult;
    const revenue = y * p;
    results[key] = {
      label: s.label,
      yield: Math.round(y * 10) / 10,
      price: Math.round(p),
      revenue: Math.round(revenue),
      profit: Math.round(revenue - totalCost),
      margin: revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0
    };
  }

  const totalYield = baseYieldPerAcre * acres;
  const costPerUnit = totalYield > 0 ? totalCost / totalYield : 0;
  const breakEvenYield = price > 0 ? totalCost / price : 0;
  const breakEvenAcres = (baseYieldPerAcre * price) > 0 ? totalCost / (baseYieldPerAcre * price) : 0;

  const breakdown = COST_FIELDS
    .map((f) => ({ key: f, label: LABELS[f], perAcre: Number(v[f]) || 0, total: (Number(v[f]) || 0) * acres }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);

  const sens = [];
  for (const yd of [-20, -10, 0, 10, 20]) {
    const row = { yieldDelta: yd, cells: [] };
    for (const pd of [-20, -10, 0, 10, 20]) {
      const y = totalYield * (1 + yd / 100);
      const p = price * (1 + pd / 100);
      row.cells.push({ priceDelta: pd, profit: Math.round(y * p - totalCost) });
    }
    sens.push(row);
  }

  return {
    acres, perAcre, totalCost, totalYield, price,
    unit: v.unit || 'unit',
    mgmt, zone, regionMult,
    results, breakdown, sens,
    costPerUnit, breakEvenYield, breakEvenAcres,
    roi: totalCost > 0 ? (results.likely.profit / totalCost) * 100 : 0,
    perAcreProfit: acres > 0 ? results.likely.profit / acres : 0
  };
}

/* ============================================================ RENDER */
function render(v, r) {
  const L = r.results.likely;
  const loss = L.profit < 0;
  const heroClass = loss ? 'result-hero loss' : 'result-hero';
  const sensColor = (val) => val > 0
    ? 'background:rgba(31,157,85,.12);color:var(--green-700)'
    : 'background:rgba(214,69,69,.12);color:var(--danger-600)';

  resultMount.innerHTML = `
  <div class="card">
    <div class="card__head">
      <h2>Results</h2>
      <span class="badge">${escapeHtml(v.crop || 'Crop')} · ${r.acres} acre(s)</span>
    </div>
    <div class="card__body">

      <div class="${heroClass}">
        <p class="small" style="color:#dff0e6">${loss ? 'Projected loss' : 'Projected profit'} (likely season)</p>
        <p class="num">${formatKES(Math.abs(L.profit))}</p>
        <p class="small" style="color:#dff0e6">
          ${L.margin.toFixed(1)}% margin · ${r.roi.toFixed(0)}% return on cost
          · ${formatKES(Math.abs(r.perAcreProfit))} per acre
        </p>
      </div>

      <h3 style="font-size:var(--fs-base)" class="mt-5 mb-2">📊 Three scenarios</h3>
      <div class="table-wrap">
        <table class="data" style="min-width:auto">
          <thead><tr><th>Scenario</th><th>Yield</th><th>Price</th><th>Revenue</th><th>Profit</th></tr></thead>
          <tbody>
            ${['poor', 'likely', 'good'].map((k) => {
              const s = r.results[k];
              const hl = k === 'likely' ? 'style="background:var(--green-50);font-weight:600"' : '';
              return `<tr ${hl}>
                <td>${escapeHtml(s.label)}</td>
                <td>${formatNumber(s.yield)}</td>
                <td>${formatKES(s.price)}</td>
                <td>${formatKES(s.revenue)}</td>
                <td style="color:${s.profit < 0 ? 'var(--danger-600)' : 'var(--green-700)'};font-weight:700">
                  ${formatKES(s.profit)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <p class="small muted mt-2">Poor = 65% yield at 82% price. Good = 130% yield at 118% price.
        These reflect real season-to-season variation in Kenya.</p>

      <h3 style="font-size:var(--fs-base)" class="mt-5 mb-2">🔑 Key numbers</h3>
      <div class="result-row"><span>Total production cost</span><strong>${formatKES(r.totalCost)}</strong></div>
      <div class="result-row"><span>Cost per acre</span><strong>${formatKES(r.perAcre)}</strong></div>
      <div class="result-row"><span>Expected total yield</span><strong>${formatNumber(r.totalYield)} ${escapeHtml(r.unit)}</strong></div>
      <div class="result-row"><span>Cost to produce one ${escapeHtml(r.unit)}</span><strong>${formatKES(r.costPerUnit)}</strong></div>
      <div class="result-row"><span>Break-even price</span><strong>${formatKES(r.costPerUnit)} per ${escapeHtml(r.unit)}</strong></div>
      <div class="result-row"><span>Break-even yield</span><strong>${formatNumber(Math.round(r.breakEvenYield))} ${escapeHtml(r.unit)}</strong></div>
      <div class="result-row"><span>Break-even area</span><strong>${r.breakEvenAcres.toFixed(2)} acres</strong></div>

      <div class="alert ${loss ? 'alert--warn' : 'alert--success'} mt-4">
        <span aria-hidden="true">${loss ? '⚠️' : '✅'}</span>
        <div>${loss
          ? `At ${formatKES(r.price)} per ${escapeHtml(r.unit)} this does not cover costs.
             You need at least <strong>${formatKES(r.costPerUnit)}</strong> per ${escapeHtml(r.unit)},
             or a yield above <strong>${formatNumber(Math.round(r.breakEvenYield))} ${escapeHtml(r.unit)}</strong>.`
          : `Every ${escapeHtml(r.unit)} above <strong>${formatKES(r.costPerUnit)}</strong> is profit.
             Selling at ${formatKES(r.price)} gives you
             <strong>${formatKES(r.price - r.costPerUnit)}</strong> margin per ${escapeHtml(r.unit)}.`}
          ${r.results.poor.profit < 0 && !loss
            ? `<br><br>⚠️ <strong>Watch out:</strong> in a poor season you would lose
               ${formatKES(Math.abs(r.results.poor.profit))}. Make sure you can absorb that.` : ''}
        </div>
      </div>

      <h3 style="font-size:var(--fs-base)" class="mt-5 mb-3">💰 Where your money goes</h3>
      ${r.breakdown.map((b) => `
        <div class="mb-3">
          <div class="flex justify-between small">
            <span>${escapeHtml(b.label)}</span>
            <strong>${formatKES(b.total)}
              <span class="muted">(${((b.total / r.totalCost) * 100).toFixed(0)}%)</span></strong>
          </div>
          <div class="progress mt-1"><span style="width:${(b.total / r.totalCost) * 100}%"></span></div>
        </div>`).join('')}

      <h3 style="font-size:var(--fs-base)" class="mt-5 mb-2">🎲 What if things change?</h3>
      <p class="small muted mb-3">Profit (in thousands KES) if yield and price move. Green = profit, red = loss.</p>
      <div class="table-wrap">
        <table class="data" style="min-width:auto;font-size:12px">
          <thead><tr><th>Yield ↓ / Price →</th>
            ${[-20, -10, 0, 10, 20].map((p) => `<th>${p > 0 ? '+' : ''}${p}%</th>`).join('')}</tr></thead>
          <tbody>
            ${r.sens.map((row) => `<tr>
              <td><strong>${row.yieldDelta > 0 ? '+' : ''}${row.yieldDelta}%</strong></td>
              ${row.cells.map((c) => `<td style="${sensColor(c.profit)};text-align:center;font-weight:600">
                ${(c.profit / 1000).toFixed(0)}k</td>`).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      ${r.zone ? `
        <div class="alert alert--info mt-4">
          <span aria-hidden="true">📍</span>
          <div><strong>${escapeHtml(v.county)}</strong> — ${escapeHtml(r.zone.zone)},
            ${escapeHtml(r.zone.rain)} rainfall. Yields adjusted by
            ${Math.round(r.regionMult * 100)}% for this zone.<br>
            Management: <strong>${escapeHtml(r.mgmt.label)}</strong> — ${escapeHtml(r.mgmt.desc)}.</div>
        </div>` : ''}

      <div class="flex gap-2 mt-5 wrap">
        <a class="btn btn--primary btn--sm" href="${page('marketplace.html')}?category=seeds">🛒 Buy seed</a>
        <a class="btn btn--primary btn--sm" href="${page('marketplace.html')}?category=fertilizer">🧪 Buy fertilizer</a>
        <a class="btn btn--outline btn--sm" href="${page('market-prices.html')}">📈 Market prices</a>
        <a class="btn btn--outline btn--sm" href="${page('start-farming.html')}">🌱 Not sure what to grow?</a>
      </div>

      <p class="small muted mt-5">Calculated ${new Date().toLocaleString('en-KE')}.
        Figures exclude land rent and unpaid family labour unless you entered them.
        Use 🖨 Export to save a PDF for your records or a loan application.</p>
    </div>
  </div>`;
}

function placeholder() {
  return `<div class="card card--pad">
    <div class="state" style="padding:32px 8px">
      <div class="state__icon" aria-hidden="true">🧮</div>
      <h3>Your results appear here</h3>
      <p>Pick a crop, enter your county and land size, then press <strong>Calculate</strong>.
        You'll get three scenarios, your break-even price and a sensitivity table.</p>
    </div></div>`;
}

/* ============================================================ EVENTS */
const schema = {
  crop: [rules.required],
  size: [rules.required, rules.positive],
  yield: [rules.required, rules.positive],
  price: [rules.required, rules.positive]
};

buildSelects();

qs('#cropSelect').addEventListener('change', (e) => {
  const id = e.target.value;
  if (id && id !== 'custom') {
    form.elements.crop.value = CROP_PROFILES[id].name;
    applyCropDefaults(id);
  } else if (id === 'custom') {
    form.elements.crop.value = '';
    form.elements.crop.focus();
    qs('#cropHint').innerHTML = '';
  }
});

qs('#county').addEventListener('change', () => {
  const id = qs('#cropSelect').value;
  if (id && id !== 'custom') applyCropDefaults(id);
});

qs('#management').addEventListener('change', () => {
  const id = qs('#cropSelect').value;
  if (id && id !== 'custom') applyCropDefaults(id);
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const { valid, values } = validateForm(form, schema);
  if (!valid) return toast('Check the highlighted fields before calculating.', 'error');
  const negative = COST_FIELDS.find((f) => Number(values[f]) < 0);
  if (negative) return toast('Costs cannot be negative.', 'error');

  const r = compute(values);
  render(values, r);
  write(KEYS.calculator, values);
  toast('Calculation complete.', 'success');
  if (window.matchMedia('(max-width: 1080px)').matches) {
    resultMount.scrollIntoView({ behavior: 'smooth' });
  }
});

qs('#resetCalc').addEventListener('click', () => {
  form.reset();
  qs('#cropHint').innerHTML = '';
  resultMount.innerHTML = placeholder();
  toast('Calculator reset.', 'info');
});

qs('#printCalc').addEventListener('click', () => {
  if (!resultMount.querySelector('.result-hero')) return toast('Run a calculation first, then export.', 'warn');
  window.print();
});

/* restore last calculation */
const saved = read(KEYS.calculator, null);
if (saved && saved.crop) {
  Object.entries(saved).forEach(([k, v]) => { if (form.elements[k]) form.elements[k].value = v; });
  render(saved, compute(saved));
} else {
  resultMount.innerHTML = placeholder();
}