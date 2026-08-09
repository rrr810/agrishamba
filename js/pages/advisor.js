/** advisor.js — Beginner Farm Advisor wizard UI. */
import { COUNTIES } from '../config.js';
import { qs, escapeHtml, formatKES, formatNumber, toast, page } from '../ui.js';
import { recommend, buildCalendar, buildActionPlan, zoneFor } from '../advisor-engine.js';
import { read, write } from '../storage.js';

const KEY = 'sokoshamba:advisor-answers';
const wiz = qs('#wiz');

const answers = read(KEY, {}) || {};
let step = 0;

/* ---------------------------------------------------------- questions */
const QUESTIONS = [
  {
    id: 'county',
    q: 'Where is your land?',
    sub: 'Your county decides which crops will actually thrive. This is the single most important answer.',
    type: 'select',
    placeholder: 'Choose your county',
    options: COUNTIES
  },
  {
    id: 'landSize',
    q: 'How much land will you farm?',
    sub: 'Be realistic — the land you can actually work this season, not everything you own.',
    type: 'choice',
    options: [
      { v: '0.125', icon: '🪴', t: 'A small plot', d: 'Kitchen garden, about 1/8 acre' },
      { v: '0.25',  icon: '🌱', t: 'Quarter acre', d: 'Typical urban / peri-urban plot' },
      { v: '0.5',   icon: '🌾', t: 'Half acre',    d: 'Small but serious' },
      { v: '1',     icon: '🚜', t: '1 acre',       d: 'Standard smallholder plot' },
      { v: '2',     icon: '🏞️', t: '2-3 acres',    d: 'Family farm scale' },
      { v: '5',     icon: '🌍', t: '5+ acres',     d: 'Commercial scale' }
    ]
  },
  {
    id: 'budget',
    q: 'How much can you invest this season?',
    sub: 'Money you can genuinely afford to put in — not money you hope to borrow.',
    type: 'choice',
    options: [
      { v: '10000',  icon: '💵', t: 'Under KES 15,000', d: 'Very tight start' },
      { v: '30000',  icon: '💰', t: 'KES 15,000 – 50,000', d: 'Small but workable' },
      { v: '80000',  icon: '💸', t: 'KES 50,000 – 120,000', d: 'Comfortable smallholder budget' },
      { v: '200000', icon: '🏦', t: 'KES 120,000 – 300,000', d: 'Serious investment' },
      { v: '500000', icon: '🏛️', t: 'Over KES 300,000', d: 'Commercial capital' }
    ]
  },
  {
    id: 'water',
    q: 'Do you have water for irrigation?',
    sub: 'River, borehole, tank, piped water — anything you can use in a dry spell.',
    type: 'choice',
    options: [
      { v: 'yes',       icon: '💧', t: 'Yes, reliable',   d: 'I can irrigate whenever needed' },
      { v: 'sometimes', icon: '🌧️', t: 'Only sometimes',  d: 'Seasonal river or a small tank' },
      { v: 'no',        icon: '☀️', t: 'No, rain only',    d: 'I depend entirely on rainfall' }
    ]
  },
  {
    id: 'experience',
    q: 'How much farming experience do you have?',
    sub: 'Be honest — this changes what we recommend. There is no wrong answer.',
    type: 'choice',
    options: [
      { v: 'none',        icon: '🆕', t: 'Complete beginner', d: 'This is my first time farming' },
      { v: 'some',        icon: '🌿', t: 'Some experience',   d: 'I have helped or grown a little' },
      { v: 'experienced', icon: '🎓', t: 'Experienced',       d: 'I have farmed several seasons' }
    ]
  },
  {
    id: 'goal',
    q: 'What matters most to you?',
    sub: 'Different goals need completely different crops.',
    type: 'choice',
    options: [
      { v: 'quick',  icon: '⚡', t: 'Money quickly',    d: 'I need income within 2-3 months' },
      { v: 'profit', icon: '📈', t: 'Highest profit',   d: 'I can wait for the biggest return' },
      { v: 'steady', icon: '🔄', t: 'Steady income',    d: 'Something that pays every week or month' },
      { v: 'food',   icon: '🍲', t: 'Feed my family',   d: 'Food security first, sell the surplus' }
    ]
  }
];

/* ------------------------------------------------------------- render */
function progressBar() {
  return `<div class="wiz-progress" aria-hidden="true">
    ${QUESTIONS.map((_, i) => `<span class="${i < step ? 'done' : ''}"></span>`).join('')}
    <span class="${step >= QUESTIONS.length ? 'done' : ''}"></span>
  </div>`;
}

function renderIntro() {
  wiz.innerHTML = `
    <div class="card card--pad text-center">
      <div style="font-size:3.5rem" aria-hidden="true">🌱</div>
      <h2 class="mt-3" style="font-size:1.9rem">Let's build your farm plan</h2>
      <p class="lead mt-3">Six quick questions. Then you get a complete plan showing exactly what to grow,
        what it costs, what you could earn, and a week-by-week calendar.</p>

      <div class="grid gap-3 mt-6" style="text-align:left">
        <div class="flex gap-3 items-center"><span style="font-size:1.5rem">🎯</span>
          <div><strong>Matched to your county</strong><div class="small muted">Real altitude and rainfall data for all 47 counties</div></div></div>
        <div class="flex gap-3 items-center"><span style="font-size:1.5rem">💰</span>
          <div><strong>Honest costings</strong><div class="small muted">Every shilling: seed, fertilizer, labour, transport</div></div></div>
        <div class="flex gap-3 items-center"><span style="font-size:1.5rem">📅</span>
          <div><strong>A calendar you can follow</strong><div class="small muted">From land prep to selling day</div></div></div>
        <div class="flex gap-3 items-center"><span style="font-size:1.5rem">🛒</span>
          <div><strong>Buy your inputs right here</strong><div class="small muted">Direct links to seed and fertilizer on the marketplace</div></div></div>
      </div>

      <button class="btn btn--primary btn--lg btn--block mt-6" id="startBtn">Start — it's free</button>
      <p class="small muted mt-3">Takes about 60 seconds. No sign-up needed.</p>
    </div>`;
  qs('#startBtn').addEventListener('click', () => { step = 0; renderQuestion(); });
}

function renderQuestion() {
  const q = QUESTIONS[step];
  const current = answers[q.id];

  let body = '';
  if (q.type === 'select') {
    body = `
      <div class="field mt-5">
        <label class="sr-only" for="selInput">${escapeHtml(q.q)}</label>
        <select class="select" id="selInput" style="font-size:1.05rem;padding:14px">
          <option value="">${escapeHtml(q.placeholder)}</option>
          ${q.options.map((o) => `<option ${current === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
        </select>
      </div>
      <div id="zoneHint" class="mt-3"></div>`;
  } else {
    body = `<div class="opt-grid">
      ${q.options.map((o) => `
        <button class="opt ${current === o.v ? 'sel' : ''}" data-val="${o.v}">
          <span class="opt__ico" aria-hidden="true">${o.icon}</span>
          <span><span class="opt__t">${escapeHtml(o.t)}</span><span class="opt__d">${escapeHtml(o.d)}</span></span>
        </button>`).join('')}
    </div>`;
  }

  wiz.innerHTML = `
    ${progressBar()}
    <p class="small muted mb-2">Question ${step + 1} of ${QUESTIONS.length}</p>
    <div class="card card--pad">
      <p class="wiz-q">${escapeHtml(q.q)}</p>
      <p class="wiz-sub">${escapeHtml(q.sub)}</p>
      ${body}
      <div class="form-actions">
        ${step > 0 ? `<button class="btn btn--outline" id="backBtn">← Back</button>` : `<a class="btn btn--outline" href="${page('calculator.html')}">Farm tools</a>`}
        <button class="btn btn--primary" id="nextBtn" ${current ? '' : 'disabled'}>
          ${step === QUESTIONS.length - 1 ? '🌾 Build my plan' : 'Next →'}
        </button>
      </div>
    </div>`;

  // Select input
  const sel = qs('#selInput');
  if (sel) {
    const updateHint = () => {
      const v = sel.value;
      answers[q.id] = v;
      qs('#nextBtn').disabled = !v;
      const hint = qs('#zoneHint');
      if (v) {
        const z = zoneFor(v);
        hint.innerHTML = `<div class="alert alert--info"><span aria-hidden="true">📍</span>
          <div><strong>${escapeHtml(v)}</strong> — ${escapeHtml(z.zone)}.
          ${z.altitude} altitude, ${z.rain} rainfall.</div></div>`;
      } else { hint.innerHTML = ''; }
    };
    sel.addEventListener('change', updateHint);
    if (sel.value) updateHint();
  }

  // Choice buttons
  wiz.querySelectorAll('[data-val]').forEach((btn) => {
    btn.addEventListener('click', () => {
      answers[q.id] = btn.dataset.val;
      write(KEY, answers);
      wiz.querySelectorAll('.opt').forEach((o) => o.classList.remove('sel'));
      btn.classList.add('sel');
      qs('#nextBtn').disabled = false;
      setTimeout(next, 220); // auto-advance for speed
    });
  });

  qs('#backBtn')?.addEventListener('click', () => { step--; renderQuestion(); });
  qs('#nextBtn').addEventListener('click', next);
}

function next() {
  const q = QUESTIONS[step];
  if (!answers[q.id]) return toast('Please choose an option to continue.', 'warn');
  write(KEY, answers);
  step++;
  if (step >= QUESTIONS.length) renderResults();
  else renderQuestion();
}

/* ------------------------------------------------------------ results */
function renderResults() {
  wiz.innerHTML = `${progressBar()}
    <div class="state" style="padding:var(--sp-8)">
      <div class="spinner"></div>
      <p>Analysing your county, land, budget and goals…</p>
    </div>`;

  setTimeout(() => {
    const recs = recommend(answers);
    if (!recs.length) {
      wiz.innerHTML = `<div class="card card--pad">
        <div class="state state--error"><div class="state__icon">🤔</div>
        <h3>We couldn't find a good match</h3>
        <p>Try increasing your budget or land size, then run it again.</p>
        <button class="btn btn--primary mt-3" id="againBtn">Start over</button></div></div>`;
      qs('#againBtn').addEventListener('click', () => { step = 0; renderQuestion(); });
      return;
    }
    paintResults(recs);
  }, 900);
}

function paintResults(recs) {
  const z = zoneFor(answers.county);
  const acres = Number(answers.landSize);

  wiz.innerHTML = `
    <div class="card card--pad" style="background:linear-gradient(135deg,var(--green-50),#fff);border-color:var(--green-300)">
      <div style="font-size:2.5rem" aria-hidden="true">🎉</div>
      <h2 class="mt-2" style="font-size:1.6rem">Your farm plan is ready</h2>
      <p class="lead mt-2">Based on <strong>${acres} acre(s)</strong> in <strong>${escapeHtml(answers.county)}</strong>
        (${escapeHtml(z.zone)}), a budget of <strong>${formatKES(answers.budget)}</strong>,
        ${answers.water === 'yes' ? 'reliable irrigation' : answers.water === 'sometimes' ? 'seasonal water' : 'rain-fed only'}.</p>
      <div class="flex gap-2 mt-4 wrap">
        <button class="btn btn--outline btn--sm" id="redoBtn">↻ Change my answers</button>
        <button class="btn btn--outline btn--sm" id="printBtn">🖨 Print / save PDF</button>
      </div>
    </div>

    <div class="grid gap-5 mt-5">${recs.map(renderRec).join('')}</div>

    <div class="cta-band mt-6">
      <h2>Ready to start?</h2>
      <p>Buy your seed, fertilizer and equipment from verified sellers across Kenya — or ask us anything on WhatsApp.</p>
      <div class="hero__cta" style="justify-content:center">
        <a class="btn btn--light btn--lg" href="${page('marketplace.html')}">🛒 Shop inputs</a>
        <a class="btn btn--outline btn--lg" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.4)"
           href="https://wa.me/254740793959?text=${encodeURIComponent('Hi SokoShamba! I just made a farm plan for ' + answers.county + ' and I have a question:')}"
           target="_blank" rel="noopener">💬 Ask a question</a>
      </div>
    </div>`;

  qs('#redoBtn').addEventListener('click', () => { step = 0; renderQuestion(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  qs('#printBtn').addEventListener('click', () => window.print());

  // Wire up the calendar toggles
  wiz.querySelectorAll('[data-cal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const box = qs('#cal-' + btn.dataset.cal);
      const open = box.hidden;
      box.hidden = !open;
      btn.textContent = open ? '▲ Hide the calendar' : '📅 Show week-by-week calendar';
    });
  });
}

function renderRec(rec) {
  const e = rec.enterprise;
  const p = rec.profit;
  const cal = buildCalendar(e);
  const plan = buildActionPlan(rec, answers);
  const loss = p.profitMid < 0;

  return `
  <article class="rec ${rec.rank === 1 ? 'top' : ''}">
    <div class="rec__head">
      ${rec.rank === 1 ? '<span class="rec__badge">⭐ BEST MATCH FOR YOU</span>' : `<span class="rec__badge">Option ${rec.rank}</span>`}
      <div class="flex items-center gap-3">
        <span style="font-size:2.4rem" aria-hidden="true">${e.emoji}</span>
        <div>
          <h3>${escapeHtml(e.name)}</h3>
          <p class="small" style="color:#cfe6d9;margin-top:4px">
            ${rec.confidence}% match · ${Math.round(e.cycleDays / 30)} month cycle · difficulty ${e.difficulty}/5
          </p>
        </div>
      </div>
      <p class="mt-3" style="color:#e5f4ec">${escapeHtml(e.why)}</p>
    </div>

    <div class="card__body">
      <!-- Why this crop -->
      ${rec.reasons.length ? `
        <div class="flex gap-2 wrap mb-4">
          ${rec.reasons.slice(0, 4).map((r) => `<span class="pill">✓ ${escapeHtml(r)}</span>`).join('')}
        </div>` : ''}

      <!-- Money -->
      <div class="money">
        <div><div class="lbl">You invest</div><div class="val" style="color:var(--danger-600)">${formatKES(p.cost)}</div></div>
        <div><div class="lbl">Likely revenue</div><div class="val" style="color:var(--ink-800)">${formatKES(p.revMid)}</div></div>
        <div><div class="lbl">${loss ? 'Likely loss' : 'Likely profit'}</div>
          <div class="val" style="color:${loss ? 'var(--danger-600)' : 'var(--green-700)'}">${formatKES(Math.abs(p.profitMid))}</div></div>
      </div>
      <p class="small muted" style="text-align:center">
        Range: ${formatKES(p.profitLow)} (bad season) to ${formatKES(p.profitHigh)} (good season)
        · Break-even price ${formatKES(p.breakEvenPrice)} per ${escapeHtml(p.unit)}
        · Expected yield ${formatNumber(p.totalYield)} ${escapeHtml(p.unit)}
      </p>

      <!-- Cost breakdown -->
      <h4 class="mt-5 mb-2" style="font-size:var(--fs-base)">💰 Where your money goes</h4>
      ${rec.costing.lines.map((l) => `
        <div class="cost-row"><span>${escapeHtml(l.label)}</span><strong>${formatKES(l.total)}</strong></div>`).join('')}
      <div class="cost-row" style="border-bottom:0;border-top:2px solid var(--ink-900);margin-top:6px">
        <strong>Total</strong><strong style="font-size:1.1rem">${formatKES(rec.costing.total)}</strong></div>

      <!-- Action plan -->
      <h4 class="mt-5 mb-3" style="font-size:var(--fs-base)">✅ Do these things first</h4>
      <div class="grid gap-3">
        ${plan.map((a) => `
          <div class="flex gap-3" style="align-items:flex-start">
            <span style="font-size:1.3rem;flex:none" aria-hidden="true">${a.icon}</span>
            <div><strong style="font-size:var(--fs-sm)">${escapeHtml(a.title)}</strong>
              <p class="small muted" style="margin-top:2px">${escapeHtml(a.body)}</p></div>
          </div>`).join('')}
      </div>

      <!-- Tips -->
      <h4 class="mt-5 mb-2" style="font-size:var(--fs-base)">🎓 Tips from experienced farmers</h4>
      <ul class="small" style="display:grid;gap:8px;color:var(--ink-700)">
        ${e.tips.map((t) => `<li>💡 ${escapeHtml(t)}</li>`).join('')}
      </ul>

      <!-- Risks -->
      <div class="alert alert--warn mt-4" style="text-align:left">
        <span aria-hidden="true">⚠️</span>
        <div><strong>Know the risks:</strong> ${e.risks.map(escapeHtml).join(' · ')}</div>
      </div>

      <!-- Calendar -->
      <button class="btn btn--outline btn--block mt-4" data-cal="${e.id}">📅 Show week-by-week calendar</button>
      <div id="cal-${e.id}" hidden class="mt-4">
        <ul class="cal">
          ${cal.map((s) => `
            <li>
              <div class="flex items-center gap-2 wrap">
                <strong style="font-size:var(--fs-sm)">${escapeHtml(s.title)}</strong>
                <span class="pill">${escapeHtml(s.label)}</span>
              </div>
              <p class="small muted" style="margin-top:3px">${escapeHtml(s.detail)}</p>
            </li>`).join('')}
        </ul>
      </div>

      <!-- Buy inputs -->
      <div class="flex gap-2 mt-5 wrap">
        ${e.inputs.map((cat) => `
          <a class="btn btn--primary btn--sm" href="${page('marketplace.html')}?category=${encodeURIComponent(cat)}">
            🛒 Buy ${escapeHtml(cat.replace('-', ' '))}
          </a>`).join('')}
        <a class="btn btn--outline btn--sm" href="${page('calculator.html')}">🧮 Fine-tune in the calculator</a>
      </div>
    </div>
  </article>`;
}

/* --------------------------------------------------------------- boot */
renderIntro();
