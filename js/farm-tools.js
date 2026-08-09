/**
 * farm-tools.js — Four practical calculators for Kenyan farmers.
 *   1. Fertilizer calculator
 *   2. Livestock feed planner
 *   3. Yield estimator
 *   4. Planting calendar
 */
import { qs, qsa, formatKES, formatNumber, escapeHtml, toast, page } from './ui.js';
import { COUNTIES } from './config.js';
import { zoneFor } from './advisor-engine.js';
import {
  CROP_PROFILES, FERTILIZERS, LIVESTOCK_FEED,
  REGION_YIELD, PLANTING_WINDOWS, MONTHS
} from './farm-data.js';

/* ================================================================== TABS */
const TOOLS = [
  { id: 'fertilizer', icon: '🧪', label: 'Fertilizer' },
  { id: 'feed',       icon: '🐄', label: 'Livestock feed' },
  { id: 'yield',      icon: '📊', label: 'Yield estimator' },
  { id: 'calendar',   icon: '📅', label: 'Planting calendar' }
];

function renderTabs(active) {
  qs('#toolTabs').innerHTML = TOOLS.map((t) => `
    <button class="chip ${t.id === active ? 'active' : ''}" data-tool="${t.id}">
      ${t.icon} ${t.label}</button>`).join('');
}

function emptyBox(icon, title, msg) {
  return `<div class="card card--pad">
    <div class="state" style="padding:32px 8px">
      <div class="state__icon" aria-hidden="true">${icon}</div>
      <h3>${escapeHtml(title)}</h3><p>${escapeHtml(msg)}</p>
    </div></div>`;
}

/* ========================================================== 1. FERTILIZER */
function fertilizerTool() {
  qs('#toolPanel').innerHTML = `
  <div class="calc-layout">
    <form class="card card--pad" id="fertForm" novalidate>
      <h2 style="font-size:var(--fs-md)" class="mb-2">🧪 Fertilizer calculator</h2>
      <p class="small muted mb-4">Work out exactly how many bags you need and what it will cost.</p>

      <div class="grid-2">
        <div class="field"><label for="fCrop">Crop</label>
          <select class="select" id="fCrop">
            ${Object.entries(CROP_PROFILES).map(([id, c]) =>
              `<option value="${id}">${c.emoji} ${escapeHtml(c.name)}</option>`).join('')}
          </select></div>
        <div class="field"><label for="fAcres">Area (acres)</label>
          <input class="input" id="fAcres" type="number" min="0.05" step="0.05" value="1"></div>
      </div>

      <div class="field"><label for="fSoil">Soil fertility</label>
        <select class="select" id="fSoil">
          <option value="1.25">Poor — never fertilised, thin topsoil</option>
          <option value="1" selected>Average — typical smallholder soil</option>
          <option value="0.8">Good — regularly manured, dark soil</option>
        </select></div>

      <div class="field"><label for="fManure">Manure applied (tonnes per acre)</label>
        <input class="input" id="fManure" type="number" min="0" step="0.5" value="0">
        <p class="hint">Manure supplies nutrients too — this reduces what you must buy.</p></div>

      <button class="btn btn--primary btn--block btn--lg mt-4" type="submit">Calculate my fertilizer</button>
    </form>
    <aside class="calc-result"><div id="fertResult"></div></aside>
  </div>`;

  const out = qs('#fertResult');
  out.innerHTML = emptyBox('🧪', 'Your fertilizer plan appears here',
    'Choose your crop and area, then press Calculate.');

  qs('#fertForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const crop = CROP_PROFILES[qs('#fCrop').value];
    const acres = Number(qs('#fAcres').value) || 1;
    const soilMult = Number(qs('#fSoil').value) || 1;
    const manureT = Number(qs('#fManure').value) || 0;

    let needN = crop.npkPerAcre.N * acres * soilMult;
    let needP = crop.npkPerAcre.P * acres * soilMult;
    let needK = crop.npkPerAcre.K * acres * soilMult;

    const manureN = manureT * acres * 5;
    const manureP = manureT * acres * 3;
    const manureK = manureT * acres * 5;
    needN = Math.max(0, needN - manureN);
    needP = Math.max(0, needP - manureP);
    needK = Math.max(0, needK - manureK);

    const dap = FERTILIZERS.find((f) => f.id === 'dap');
    const can = FERTILIZERS.find((f) => f.id === 'can');
    const mop = FERTILIZERS.find((f) => f.id === 'mop');

    const dapKg = needP > 0 ? (needP / (dap.P / 100)) : 0;
    const nFromDap = dapKg * (dap.N / 100);
    const remainingN = Math.max(0, needN - nFromDap);
    const canKg = remainingN > 0 ? (remainingN / (can.N / 100)) : 0;
    const mopKg = needK > 0 ? (needK / (mop.K / 100)) : 0;

    const rows = [
      { f: dap, kg: dapKg, when: 'At planting — place in the furrow with the seed' },
      { f: can, kg: canKg, when: 'Top dressing — 4-6 weeks after emergence' },
      { f: mop, kg: mopKg, when: 'At planting or first top dress' }
    ].filter((p) => p.kg > 1).map((p) => {
      const bags = p.kg / 50;
      return { ...p, bags, cost: bags * p.f.pricePer50kg };
    });

    const total = rows.reduce((s, r) => s + r.cost, 0);

    out.innerHTML = `
    <div class="card">
      <div class="card__head"><h2>Your fertilizer plan</h2>
        <span class="badge">${crop.emoji} ${escapeHtml(crop.name)} · ${acres} acre(s)</span></div>
      <div class="card__body">
        <div class="result-hero">
          <p class="small" style="color:#dff0e6">Total fertilizer cost</p>
          <p class="num">${formatKES(total)}</p>
          <p class="small" style="color:#dff0e6">${formatKES(total / acres)} per acre</p>
        </div>

        <h3 style="font-size:var(--fs-base)" class="mt-5 mb-3">📦 What to buy</h3>
        ${rows.map((r) => `
          <div class="card card--pad mb-3" style="background:var(--ink-50)">
            <div class="flex justify-between items-center wrap gap-2">
              <div><strong>${escapeHtml(r.f.name)}</strong>
                <p class="small muted">${escapeHtml(r.when)}</p></div>
              <div style="text-align:right">
                <p style="font-family:var(--font-display);font-weight:800;font-size:1.2rem">
                  ${Math.ceil(r.bags)} bag${Math.ceil(r.bags) === 1 ? '' : 's'}</p>
                <p class="small muted">${Math.round(r.kg)} kg · ${formatKES(r.cost)}</p></div>
            </div>
          </div>`).join('')}

        <h3 style="font-size:var(--fs-base)" class="mt-5 mb-2">🧬 Nutrients supplied</h3>
        <div class="result-row"><span>Nitrogen (N)</span><strong>${Math.round(needN)} kg</strong></div>
        <div class="result-row"><span>Phosphorus (P)</span><strong>${Math.round(needP)} kg</strong></div>
        <div class="result-row"><span>Potassium (K)</span><strong>${Math.round(needK)} kg</strong></div>
        ${manureT > 0 ? `<p class="small muted mt-2">Your ${manureT} t/acre of manure already supplies about
          ${Math.round(manureN)} kg N, ${Math.round(manureP)} kg P and ${Math.round(manureK)} kg K — money saved.</p>` : ''}

        <div class="alert alert--info mt-4"><span aria-hidden="true">💡</span>
          <div><strong>Get a soil test first.</strong> KES 1,500–3,500 at KALRO or a private lab.
          Most Kenyan smallholder soils are acidic below pH 5.5, which locks up the phosphorus
          you just paid for. Lime fixes it.</div></div>

        <div class="flex gap-2 mt-4 wrap">
          <a class="btn btn--primary btn--sm" href="${page('marketplace.html')}?category=fertilizer">🛒 Buy fertilizer</a>
          <button class="btn btn--outline btn--sm" onclick="window.print()">🖨 Print list</button>
        </div>
      </div>
    </div>`;
  });
}

/* ================================================================ 2. FEED */
function feedTool() {
  qs('#toolPanel').innerHTML = `
  <div class="calc-layout">
    <form class="card card--pad" id="feedForm" novalidate>
      <h2 style="font-size:var(--fs-md)" class="mb-2">🐄 Livestock feed planner</h2>
      <p class="small muted mb-4">Daily ration and monthly feed budget for your animals.</p>

      <div class="field"><label for="animal">Animal type</label>
        <select class="select" id="animal">
          ${Object.entries(LIVESTOCK_FEED).map(([id, a]) =>
            `<option value="${id}">${a.emoji} ${escapeHtml(a.name)}</option>`).join('')}
        </select></div>

      <div class="grid-2">
        <div class="field"><label for="count">How many animals?</label>
          <input class="input" id="count" type="number" min="1" value="1"></div>
        <div class="field" id="outputWrap"><label for="output">Milk per animal per day (litres)</label>
          <input class="input" id="output" type="number" min="0" step="0.5" value="15"></div>
      </div>

      <button class="btn btn--primary btn--block btn--lg mt-4" type="submit">Calculate feed</button>
    </form>
    <aside class="calc-result"><div id="feedResult"></div></aside>
  </div>`;

  const out = qs('#feedResult');
  out.innerHTML = emptyBox('🐄', 'Your feed plan appears here', 'Pick your animal and how many you keep.');

  const toggleOutput = () => {
    const id = qs('#animal').value;
    qs('#outputWrap').style.display = (id === 'dairy' || id === 'goat') ? '' : 'none';
  };
  qs('#animal').addEventListener('change', toggleOutput);
  toggleOutput();

  qs('#feedForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = qs('#animal').value;
    const a = LIVESTOCK_FEED[id];
    const n = Number(qs('#count').value) || 1;
    const litres = Number(qs('#output').value) || 0;

    let lines = [];
    const notes = [];

    if (id === 'dairy' || id === 'goat') {
      const dmNeeded = a.bodyWeightKg * a.dmIntakePct;
      const forageDm = dmNeeded * 0.65;
      const concDm = dmNeeded * 0.35;
      const napier = a.feeds.find((f) => f.id === 'napier');
      const dairymeal = a.feeds.find((f) => f.id === 'dairymeal');
      const napierKg = forageDm / napier.dmPct;
      let mealKg = concDm / dairymeal.dmPct;

      if (id === 'dairy' && litres > a.maintenanceLitres) {
        mealKg = Math.max(mealKg, (litres - a.maintenanceLitres) * a.concentratePerLitre);
      }

      lines = [
        { name: napier.name, kg: napierKg * n, cost: napierKg * n * napier.pricePerKg },
        { name: dairymeal.name, kg: mealKg * n, cost: mealKg * n * dairymeal.pricePerKg }
      ];
      notes.push(`Each animal needs about ${dmNeeded.toFixed(1)} kg of dry matter per day.`);
      if (id === 'dairy') {
        notes.push(`Water: about ${Math.round(litres * a.waterPerLitreMilk + 30)} litres per cow per day. Restricted water is the #1 hidden cause of low milk.`);
        notes.push('Never feed more than 4 kg of dairy meal in one sitting — split it across milkings.');
      }
    } else if (id === 'broilers') {
      const f1 = a.feeds[0], f2 = a.feeds[1];
      const starterKg = a.feedPerBirdTotal * 0.35 * n;
      const finisherKg = a.feedPerBirdTotal * 0.65 * n;
      lines = [
        { name: f1.name, kg: starterKg, cost: starterKg * f1.pricePerKg, cycle: true },
        { name: f2.name, kg: finisherKg, cost: finisherKg * f2.pricePerKg, cycle: true }
      ];
      notes.push(`Total for one ${a.daysToMarket}-day cycle, not per day.`);
      notes.push(`About ${a.feedPerBirdTotal} kg of feed per bird to market weight.`);
    } else {
      const f = a.feeds[0];
      const perDay = a.feedPerBirdPerDay * n;
      lines = [{ name: f.name, kg: perDay, cost: perDay * f.pricePerKg }];
      if (id === 'layers') {
        notes.push(`Expect about ${a.eggsPerBirdPerYear} eggs per bird per year at good management.`);
        const traysPerDay = (n * (a.eggsPerBirdPerYear / 365)) / 30;
        notes.push(`That's roughly ${traysPerDay.toFixed(1)} trays per day from ${n} birds.`);
      }
      if (id === 'kienyeji') notes.push(`About ${a.daysToMarket} days to market weight.`);
    }

    const dailyCost = lines.reduce((s, l) => s + l.cost, 0);
    const isCycle = lines.some((l) => l.cycle);
    const monthly = isCycle ? dailyCost : dailyCost * 30;

    out.innerHTML = `
    <div class="card">
      <div class="card__head"><h2>Feed plan</h2>
        <span class="badge">${a.emoji} ${n} × ${escapeHtml(a.name)}</span></div>
      <div class="card__body">
        <div class="result-hero">
          <p class="small" style="color:#dff0e6">${isCycle ? 'Cost per cycle' : 'Feed cost per month'}</p>
          <p class="num">${formatKES(monthly)}</p>
          <p class="small" style="color:#dff0e6">
            ${isCycle ? `${formatKES(monthly / n)} per bird` : `${formatKES(dailyCost)} per day`}</p>
        </div>

        <h3 style="font-size:var(--fs-base)" class="mt-5 mb-3">🥣 ${isCycle ? 'Total feed needed' : 'Daily ration'}</h3>
        ${lines.map((l) => `<div class="result-row">
          <span>${escapeHtml(l.name)}</span>
          <strong>${l.kg.toFixed(1)} kg · ${formatKES(l.cost)}</strong></div>`).join('')}
        ${!isCycle ? `<div class="result-row" style="border-top:2px solid var(--ink-900);margin-top:6px">
          <strong>Per month (×30)</strong><strong>${formatKES(monthly)}</strong></div>` : ''}

        ${notes.length ? `<div class="alert alert--info mt-4" style="text-align:left">
          <span aria-hidden="true">💡</span>
          <div>${notes.map((t) => `<div style="margin-bottom:6px">${escapeHtml(t)}</div>`).join('')}</div>
        </div>` : ''}

        <div class="flex gap-2 mt-4 wrap">
          <a class="btn btn--primary btn--sm" href="${page('marketplace.html')}?category=animal-feed">🛒 Buy feed</a>
          <a class="btn btn--outline btn--sm" href="${page('services.html')}">🩺 Find a vet</a>
        </div>
      </div>
    </div>`;
  });
}

/* ============================================================== 3. YIELD */
function yieldTool() {
  const PRACTICES = [
    ['certSeed',   'I use certified seed every season',         0.18],
    ['soilTest',   'I have done a soil test and follow it',     0.12],
    ['timelyPlant','I plant with the first rains, not late',    0.15],
    ['weeding',    'I keep it weed-free for the first 6 weeks', 0.20],
    ['topDress',   'I top dress on time',                       0.10],
    ['scouting',   'I scout weekly and spray when needed',      0.14],
    ['spacing',    'I use the recommended spacing',             0.08],
    ['manure',     'I apply manure or compost',                 0.10]
  ];

  qs('#toolPanel').innerHTML = `
  <div class="calc-layout">
    <form class="card card--pad" id="yieldForm" novalidate>
      <h2 style="font-size:var(--fs-md)" class="mb-2">📊 Yield estimator</h2>
      <p class="small muted mb-4">A realistic estimate based on what you actually do — not brochure numbers.</p>

      <div class="grid-2">
        <div class="field"><label for="yCrop">Crop</label>
          <select class="select" id="yCrop">
            ${Object.entries(CROP_PROFILES).map(([id, c]) =>
              `<option value="${id}">${c.emoji} ${escapeHtml(c.name)}</option>`).join('')}
          </select></div>
        <div class="field"><label for="yCounty">County</label>
          <select class="select" id="yCounty"><option value="">Select…</option>
            ${COUNTIES.map((c) => `<option>${c}</option>`).join('')}</select></div>
      </div>

      <div class="field"><label for="yAcres">Area (acres)</label>
        <input class="input" id="yAcres" type="number" min="0.05" step="0.05" value="1"></div>

      <h3 style="font-size:var(--fs-base)" class="mt-5 mb-3">What do you actually do?</h3>
      <div class="grid gap-2">
        ${PRACTICES.map(([id, label, boost]) => `
          <label class="filter-option" style="padding:10px;border:1px solid var(--border);border-radius:8px">
            <input type="checkbox" id="${id}" data-boost="${boost}" data-label="${escapeHtml(label)}">
            <span style="flex:1">${escapeHtml(label)}</span>
            <span style="background:var(--green-50);color:var(--green-700);border:1px solid var(--green-100);
              padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">
              +${Math.round(boost * 100)}%</span>
          </label>`).join('')}
      </div>

      <button class="btn btn--primary btn--block btn--lg mt-4" type="submit">Estimate my yield</button>
    </form>
    <aside class="calc-result"><div id="yieldResult"></div></aside>
  </div>`;

  const out = qs('#yieldResult');
  out.innerHTML = emptyBox('📊', 'Your yield estimate appears here',
    'Tick the practices you genuinely follow for an honest estimate.');

  qs('#yieldForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const crop = CROP_PROFILES[qs('#yCrop').value];
    const county = qs('#yCounty').value;
    const acres = Number(qs('#yAcres').value) || 1;
    const zone = county ? zoneFor(county) : null;
    const regionMult = zone ? (REGION_YIELD[zone.rain] ?? 1) : 1;

    const checks = qsa('#yieldForm input[type="checkbox"]');
    const ticked = checks.filter((c) => c.checked);
    const missed = checks.filter((c) => !c.checked);
    const boost = ticked.reduce((s, c) => s + Number(c.dataset.boost), 0);
    const potentialGain = missed.reduce((s, c) => s + Number(c.dataset.boost), 0);

    const base = crop.yieldRange[0];
    const ceiling = crop.yieldRange[2];
    const perAcre = Math.min(ceiling, base * (1 + boost)) * regionMult;
    const total = perAcre * acres;
    const potentialPerAcre = Math.min(ceiling, base * (1 + boost + potentialGain)) * regionMult;
    const extraUnits = (potentialPerAcre - perAcre) * acres;
    const extraValue = extraUnits * crop.priceRange[1];
    const pctOfBest = (perAcre / (ceiling * regionMult)) * 100;

    out.innerHTML = `
    <div class="card">
      <div class="card__head"><h2>Yield estimate</h2>
        <span class="badge">${crop.emoji} ${escapeHtml(crop.name)}</span></div>
      <div class="card__body">
        <div class="result-hero">
          <p class="small" style="color:#dff0e6">Realistic yield estimate</p>
          <p class="num">${formatNumber(Math.round(total))}</p>
          <p class="small" style="color:#dff0e6">${escapeHtml(crop.unit)}
            · ${perAcre.toFixed(1)} per acre · ${Math.round(pctOfBest)}% of what's possible here</p>
        </div>

        <div class="mt-4">
          <div class="flex justify-between small mb-1">
            <span>Your practices score</span><strong>${ticked.length} of ${checks.length}</strong></div>
          <div class="progress"><span style="width:${(ticked.length / checks.length) * 100}%"></span></div>
        </div>

        <div class="result-row mt-4">
          <span>Value at ${formatKES(crop.priceRange[1])}/${escapeHtml(crop.unit)}</span>
          <strong>${formatKES(total * crop.priceRange[1])}</strong></div>

        ${missed.length ? `
          <h3 style="font-size:var(--fs-base)" class="mt-5 mb-2">🚀 How to get more</h3>
          <p class="small muted mb-3">Doing these could add about
            <strong>${formatNumber(Math.round(extraUnits))} ${escapeHtml(crop.unit)}</strong>
            worth <strong>${formatKES(extraValue)}</strong>:</p>
          <ul class="small" style="display:grid;gap:8px;color:var(--ink-700)">
            ${missed.map((c) => `<li>⬜ ${escapeHtml(c.dataset.label)}
              <span class="muted">(+${Math.round(Number(c.dataset.boost) * 100)}%)</span></li>`).join('')}
          </ul>` : `
          <div class="alert alert--success mt-4"><span>🏆</span>
            <div>You're doing everything right. Your remaining limit is rainfall and soil, not management.</div></div>`}

        <div class="alert alert--info mt-4"><span aria-hidden="true">📍</span>
          <div>${county
            ? `<strong>${escapeHtml(county)}</strong> — ${escapeHtml(zone.zone)}, ${escapeHtml(zone.rain)} rainfall.
               Yields adjusted ${Math.round(regionMult * 100)}% for this zone.`
            : 'Select your county for a region-adjusted estimate.'}<br>
            ${escapeHtml(crop.note)}</div></div>

        <div class="flex gap-2 mt-4 wrap">
          <a class="btn btn--primary btn--sm" href="${page('calculator.html')}">🧮 Now calculate profit</a>
          <a class="btn btn--outline btn--sm" href="${page('advisory.html')}">📚 Read the guides</a>
        </div>
      </div>
    </div>`;
  });
}

/* =========================================================== 4. CALENDAR */
function buildStages(crop, startMonth) {
  const c = crop.cycleDays;
  const monthAt = (days) => MONTHS[(((startMonth - 1) + Math.floor(days / 30)) % 12 + 12) % 12];
  return [
    { what: 'Prepare land',    when: monthAt(-30) },
    { what: 'Buy inputs',      when: monthAt(-14) },
    { what: 'Plant',           when: monthAt(0) },
    { what: 'First weeding',   when: monthAt(c * 0.2) },
    { what: 'Top dress',       when: monthAt(c * 0.3) },
    { what: 'Second weeding',  when: monthAt(c * 0.45) },
    { what: 'Find your buyer', when: monthAt(c * 0.7) },
    { what: 'Harvest',         when: monthAt(c) }
  ];
}

function calendarTool() {
  qs('#toolPanel').innerHTML = `
  <div class="calc-layout">
    <form class="card card--pad" id="calForm" novalidate>
      <h2 style="font-size:var(--fs-md)" class="mb-2">📅 Planting calendar</h2>
      <p class="small muted mb-4">When to plant in your region, and what to do each stage.</p>

      <div class="field"><label for="cCounty">County</label>
        <select class="select" id="cCounty"><option value="">Select…</option>
          ${COUNTIES.map((c) => `<option>${c}</option>`).join('')}</select></div>

      <div class="field"><label for="cCrop">Crop</label>
        <select class="select" id="cCrop">
          ${Object.entries(CROP_PROFILES).map(([id, c]) =>
            `<option value="${id}">${c.emoji} ${escapeHtml(c.name)}</option>`).join('')}
        </select></div>

      <button class="btn btn--primary btn--block btn--lg mt-4" type="submit">Show my calendar</button>
    </form>
    <aside class="calc-result"><div id="calResult"></div></aside>
  </div>`;

  const out = qs('#calResult');
  out.innerHTML = emptyBox('📅', 'Your planting calendar appears here', 'Pick your county and crop.');

  qs('#calForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const county = qs('#cCounty').value;
    if (!county) return toast('Please select your county.', 'warn');
    const crop = CROP_PROFILES[qs('#cCrop').value];
    const zone = zoneFor(county);
    const win = PLANTING_WINDOWS[zone.zone] || PLANTING_WINDOWS.default;
    const nowMonth = new Date().getMonth() + 1;

    const relBadge = (r) => ({
      high: '<span class="badge badge--green">Reliable</span>',
      medium: '<span class="badge badge--warn">Moderate</span>',
      low: '<span class="badge badge--danger">Risky</span>'
    }[r] || '');

    const seasonCard = (s, title) => s ? `
      <div class="card card--pad mb-3" style="border-color:var(--green-300)">
        <div class="flex justify-between items-center wrap gap-2">
          <div><strong>${title}</strong><p class="small muted">Plant in ${escapeHtml(s.label)}</p></div>
          ${relBadge(s.reliability)}
        </div>
        <div class="mt-3">
          ${buildStages(crop, s.start).map((st) => `
            <div class="result-row"><span>${escapeHtml(st.what)}</span>
              <strong>${escapeHtml(st.when)}</strong></div>`).join('')}
        </div>
      </div>` : '';

    const inLong = win.long && nowMonth >= win.long.start && nowMonth <= win.long.end;
    const inShort = win.short && nowMonth >= win.short.start && nowMonth <= win.short.end;
    const nextWin = (!inLong && !inShort)
      ? [win.long, win.short].filter(Boolean)
          .map((s) => ({ s, gap: (s.start - nowMonth + 12) % 12 }))
          .sort((a, b) => a.gap - b.gap)[0]
      : null;

    out.innerHTML = `
    <div class="card">
      <div class="card__head"><h2>Planting calendar</h2>
        <span class="badge">${crop.emoji} ${escapeHtml(county)}</span></div>
      <div class="card__body">
        <div class="alert ${(inLong || inShort) ? 'alert--success' : 'alert--warn'}">
          <span aria-hidden="true">${(inLong || inShort) ? '✅' : '⏳'}</span>
          <div>${(inLong || inShort)
            ? `<strong>Now is planting season in ${escapeHtml(county)}.</strong>
               If the rains have started, plant as soon as the soil is workable.`
            : `<strong>Not planting season yet.</strong> The next window opens in
               ${escapeHtml(MONTHS[(nextWin?.s.start || 3) - 1])} — about ${nextWin?.gap || 0} month(s) away.
               Use this time to prepare land and buy inputs early.`}</div>
        </div>

        ${seasonCard(win.long, '🌧️ Long rains')}
        ${seasonCard(win.short, '🌦️ Short rains')}

        <div class="alert alert--info mt-3"><span aria-hidden="true">📍</span>
          <div><strong>${escapeHtml(zone.zone)}</strong> — ${escapeHtml(win.note)}</div></div>

        <div class="alert alert--warn mt-3"><span aria-hidden="true">⚠️</span>
          <div>These are typical patterns. Rainfall is shifting — always confirm with neighbours,
            your county extension officer, or the Kenya Met forecast before committing seed.</div></div>

        <div class="flex gap-2 mt-4 wrap">
          <a class="btn btn--primary btn--sm" href="${page('marketplace.html')}?category=seeds">🛒 Buy seed early</a>
          <button class="btn btn--outline btn--sm" onclick="window.print()">🖨 Print calendar</button>
        </div>
      </div>
    </div>`;
  });
}

/* ================================================================= BOOT */
const RENDERERS = {
  fertilizer: fertilizerTool,
  feed: feedTool,
  yield: yieldTool,
  calendar: calendarTool
};

function show(toolId) {
  renderTabs(toolId);
  RENDERERS[toolId]();
  history.replaceState(null, '', `?tool=${toolId}`);
}

qs('#toolTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tool]');
  if (btn) show(btn.dataset.tool);
});

const startTool = new URLSearchParams(location.search).get('tool');
show(RENDERERS[startTool] ? startTool : 'fertilizer');