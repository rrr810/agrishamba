/**
 * loan-calculator.js — Kenyan agricultural loan comparison.
 *
 * Shows the REAL cost of borrowing: interest, fees, insurance,
 * total repayment, and whether the farm can actually service it.
 */
import { qs, qsa, formatKES, formatNumber, escapeHtml, toast, page } from './ui.js';
import { read, write } from './storage.js';

const KEY = 'sokoshamba:loan-inputs';

/* ================================================== KENYAN LENDER TYPES */
/**
 * Rates are typical published ranges for Kenyan agri-lending in 2025/26.
 * Always confirm actual terms with the lender — these are planning figures.
 */
export const LENDERS = [
  {
    id: 'sacco',
    name: 'SACCO loan',
    icon: '🏦',
    rateAnnual: 0.14,
    method: 'reducing',
    processingFee: 0.02,
    insurance: 0.01,
    maxMonths: 36,
    typicalMax: 500000,
    requires: 'Membership + shares (often 3x share value), 2 guarantors',
    speed: '1–2 weeks',
    good: 'Cheapest formal option. Reducing balance means you pay less as you repay.',
    bad: 'You must be a member and have built up shares first. Guarantors take on your risk.'
  },
  {
    id: 'bank',
    name: 'Commercial bank agri-loan',
    icon: '🏛️',
    rateAnnual: 0.18,
    method: 'reducing',
    processingFee: 0.025,
    insurance: 0.015,
    maxMonths: 60,
    typicalMax: 3000000,
    requires: 'Bank statements (6 months), collateral or title deed, business records',
    speed: '2–6 weeks',
    good: 'Largest amounts and longest terms. Builds formal credit history.',
    bad: 'Slow, paperwork heavy, and they usually want security. Not for first-timers.'
  },
  {
    id: 'mfi',
    name: 'Microfinance (MFI)',
    icon: '🏪',
    rateAnnual: 0.28,
    method: 'flat',
    processingFee: 0.03,
    insurance: 0.01,
    maxMonths: 18,
    typicalMax: 300000,
    requires: 'Group membership or chattel security, business plan',
    speed: '3–10 days',
    good: 'Faster and more flexible than banks. Group lending needs no collateral.',
    bad: 'Flat interest means you pay on the FULL amount even after repaying most of it.'
  },
  {
    id: 'agri',
    name: 'Agricultural Finance Corporation (AFC)',
    icon: '🌾',
    rateAnnual: 0.10,
    method: 'reducing',
    processingFee: 0.02,
    insurance: 0.01,
    maxMonths: 48,
    typicalMax: 2000000,
    requires: 'Title deed or lease, farm plan, sometimes a co-signer',
    speed: '4–8 weeks',
    good: 'Government-backed and the cheapest rate available for farmers.',
    bad: 'Slowest to approve. Strict on documentation and land security.'
  },
  {
    id: 'inputcredit',
    name: 'Input credit (agrovet / offtaker)',
    icon: '🌱',
    rateAnnual: 0.36,
    method: 'flat',
    processingFee: 0,
    insurance: 0,
    maxMonths: 6,
    typicalMax: 100000,
    requires: 'A contract to sell your harvest to the lender',
    speed: 'Same day – 3 days',
    good: 'No cash needed upfront. You get seed and fertilizer immediately.',
    bad: 'Expensive when annualised, and you are locked into selling at their price.'
  },
  {
    id: 'digital',
    name: 'Digital / mobile loan',
    icon: '📱',
    rateAnnual: 0.72,
    method: 'flat',
    processingFee: 0.05,
    insurance: 0,
    maxMonths: 3,
    typicalMax: 50000,
    requires: 'Phone number and M-Pesa history only',
    speed: 'Minutes',
    good: 'Instant. No paperwork, no collateral, no guarantors.',
    bad: 'Brutally expensive. Only for genuine emergencies, never for financing a season.'
  },
  {
    id: 'chama',
    name: 'Chama / merry-go-round',
    icon: '🤝',
    rateAnnual: 0.12,
    method: 'flat',
    processingFee: 0,
    insurance: 0,
    maxMonths: 12,
    typicalMax: 200000,
    requires: 'Active group membership and regular contributions',
    speed: 'Days',
    good: 'Cheap, flexible, and the group understands farming timelines.',
    bad: 'Limited by what the group has saved. Social pressure if you default.'
  }
];

/* ================================================================ MATHS */
/** Reducing balance monthly payment (standard amortisation). */
function reducingPayment(principal, annualRate, months) {
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

/** Flat rate: interest charged on the full principal for the whole term. */
function flatPayment(principal, annualRate, months) {
  const totalInterest = principal * annualRate * (months / 12);
  return (principal + totalInterest) / months;
}

export function calcLoan(lender, principal, months) {
  const p = Number(principal) || 0;
  const m = Math.max(1, Number(months) || 1);

  const monthly = lender.method === 'reducing'
    ? reducingPayment(p, lender.rateAnnual, m)
    : flatPayment(p, lender.rateAnnual, m);

  const totalRepaid = monthly * m;
  const interest = totalRepaid - p;
  const fees = p * lender.processingFee;
  const insurance = p * lender.insurance * (m / 12);
  const totalCost = interest + fees + insurance;
  const cashReceived = p - fees;               // fees usually deducted upfront
  const effectiveRate = p > 0 ? (totalCost / p) * (12 / m) : 0;

  return {
    lender, principal: p, months: m,
    monthly: Math.round(monthly),
    totalRepaid: Math.round(totalRepaid + fees + insurance),
    interest: Math.round(interest),
    fees: Math.round(fees),
    insurance: Math.round(insurance),
    totalCost: Math.round(totalCost),
    cashReceived: Math.round(cashReceived),
    effectiveRate,
    overLimit: p > lender.typicalMax,
    overTerm: m > lender.maxMonths
  };
}

/* ================================================================ UI */
const form = qs('#loanForm');
const out = qs('#loanResult');

function placeholder() {
  return `<div class="card card--pad">
    <div class="state" style="padding:32px 8px">
      <div class="state__icon" aria-hidden="true">💰</div>
      <h3>Your loan comparison appears here</h3>
      <p>Enter how much you need and over how long. We'll compare 7 Kenyan lender types
        and show the real total cost of each.</p>
    </div></div>`;
}

function render(principal, months, expectedProfit) {
  const results = LENDERS
    .map((l) => calcLoan(l, principal, months))
    .sort((a, b) => a.totalCost - b.totalCost);

  const cheapest = results[0];
  const dearest = results[results.length - 1];
  const savings = dearest.totalCost - cheapest.totalCost;

  // Affordability check
  const profit = Number(expectedProfit) || 0;
  const monthlyProfit = profit / months;
  const dsr = monthlyProfit > 0 ? (cheapest.monthly / monthlyProfit) : Infinity;

  let verdict, verdictClass, verdictIcon;
  if (!profit) {
    verdict = 'Enter your expected profit to see if you can actually afford the repayments.';
    verdictClass = 'alert--info'; verdictIcon = 'ℹ️';
  } else if (dsr <= 0.4) {
    verdict = `Comfortable. Repayments take about ${Math.round(dsr * 100)}% of your monthly profit, leaving room for surprises.`;
    verdictClass = 'alert--success'; verdictIcon = '✅';
  } else if (dsr <= 0.7) {
    verdict = `Tight but possible. Repayments eat ${Math.round(dsr * 100)}% of your profit. One bad season and you're in trouble.`;
    verdictClass = 'alert--warn'; verdictIcon = '⚠️';
  } else if (dsr <= 1) {
    verdict = `Dangerous. Repayments take ${Math.round(dsr * 100)}% of your profit. You'd have almost nothing left to live on.`;
    verdictClass = 'alert--warn'; verdictIcon = '🚨';
  } else {
    verdict = `Do not take this loan. Repayments (${formatKES(cheapest.monthly)}/month) exceed your expected profit (${formatKES(monthlyProfit)}/month). You would be borrowing to repay.`;
    verdictClass = 'alert--error'; verdictIcon = '⛔';
  }

  out.innerHTML = `
  <div class="card">
    <div class="card__head"><h2>Loan comparison</h2>
      <span class="badge">${formatKES(principal)} over ${months} months</span></div>
    <div class="card__body">

      <div class="result-hero">
        <p class="small" style="color:#dff0e6">Cheapest option: ${cheapest.lender.icon} ${escapeHtml(cheapest.lender.name)}</p>
        <p class="num">${formatKES(cheapest.monthly)}<span style="font-size:1rem">/month</span></p>
        <p class="small" style="color:#dff0e6">
          Total cost of borrowing ${formatKES(cheapest.totalCost)}
          · You repay ${formatKES(cheapest.totalRepaid)} in all</p>
      </div>

      <div class="alert ${verdictClass} mt-4">
        <span aria-hidden="true">${verdictIcon}</span>
        <div><strong>Can you afford it?</strong> ${escapeHtml(verdict)}</div>
      </div>

      ${savings > 0 ? `
        <div class="alert alert--info mt-3">
          <span aria-hidden="true">💡</span>
          <div>Choosing ${escapeHtml(cheapest.lender.name)} over ${escapeHtml(dearest.lender.name)}
            saves you <strong>${formatKES(savings)}</strong> — that's
            ${Math.round((savings / principal) * 100)}% of the amount you're borrowing.</div>
        </div>` : ''}

      <h3 style="font-size:var(--fs-base)" class="mt-5 mb-2">📊 All options, cheapest first</h3>
      <div class="table-wrap">
        <table class="data" style="min-width:auto">
          <thead><tr><th>Lender</th><th>Rate</th><th>Monthly</th><th>Total cost</th><th>You repay</th></tr></thead>
          <tbody>
            ${results.map((r, i) => `
              <tr ${i === 0 ? 'style="background:var(--green-50);font-weight:600"' : ''}>
                <td>${r.lender.icon} ${escapeHtml(r.lender.name)}
                  ${r.overLimit ? '<br><span class="badge badge--warn" style="font-size:10px">Above typical limit</span>' : ''}
                  ${r.overTerm ? '<br><span class="badge badge--warn" style="font-size:10px">Term too long</span>' : ''}</td>
                <td>${Math.round(r.lender.rateAnnual * 100)}%<br>
                  <span class="small muted">${r.lender.method}</span></td>
                <td>${formatKES(r.monthly)}</td>
                <td style="color:var(--danger-600);font-weight:700">${formatKES(r.totalCost)}</td>
                <td>${formatKES(r.totalRepaid)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="small muted mt-2">
        <strong>Reducing balance</strong> = interest only on what you still owe (cheaper).
        <strong>Flat</strong> = interest on the full amount for the whole term (more expensive than it looks).
      </p>

      <h3 style="font-size:var(--fs-base)" class="mt-5 mb-3">🔍 The details</h3>
      <div class="grid gap-3">
        ${results.slice(0, 4).map((r) => `
          <div class="card card--pad" style="background:var(--ink-50)">
            <div class="flex justify-between items-start wrap gap-2">
              <div style="flex:1;min-width:200px">
                <strong>${r.lender.icon} ${escapeHtml(r.lender.name)}</strong>
                <p class="small muted" style="margin-top:2px">
                  ⏱️ ${escapeHtml(r.lender.speed)} · 📋 ${escapeHtml(r.lender.requires)}</p>
              </div>
              <div style="text-align:right">
                <p style="font-family:var(--font-display);font-weight:800;font-size:1.1rem">
                  ${formatKES(r.monthly)}<span style="font-size:11px;font-weight:400">/mo</span></p>
                <p class="small muted">${formatKES(r.totalCost)} total cost</p>
              </div>
            </div>
            <div class="mt-3" style="font-size:13px">
              <div style="color:var(--green-700)">✓ ${escapeHtml(r.lender.good)}</div>
              <div style="color:var(--danger-600);margin-top:4px">✗ ${escapeHtml(r.lender.bad)}</div>
            </div>
            <div class="mt-3" style="font-size:12px;color:var(--ink-500);display:flex;gap:14px;flex-wrap:wrap">
              <span>Cash you receive: <strong>${formatKES(r.cashReceived)}</strong></span>
              <span>Interest: ${formatKES(r.interest)}</span>
              ${r.fees ? `<span>Fees: ${formatKES(r.fees)}</span>` : ''}
              ${r.insurance ? `<span>Insurance: ${formatKES(r.insurance)}</span>` : ''}
            </div>
          </div>`).join('')}
      </div>

      <div class="alert alert--warn mt-5">
        <span aria-hidden="true">🛡️</span>
        <div><strong>Before you sign anything:</strong>
          <ul style="margin:8px 0 0;padding-left:18px;display:grid;gap:5px">
            <li>Ask for the <strong>total amount repayable</strong> in writing, not just the monthly figure.</li>
            <li>Check whether the rate is <strong>reducing balance or flat</strong> — it changes everything.</li>
            <li>Ask about penalties for <strong>early repayment</strong> and for <strong>late payment</strong>.</li>
            <li>Match the repayment schedule to your <strong>harvest</strong>, not to a calendar month.</li>
            <li>Never borrow for a season you haven't costed. Run the
              <a href="${page('calculator.html')}">farm calculator</a> first.</li>
          </ul>
        </div>
      </div>

      <div class="flex gap-2 mt-4 wrap">
        <a class="btn btn--primary btn--sm" href="${page('calculator.html')}">🧮 Cost my season first</a>
        <a class="btn btn--outline btn--sm" href="${page('advisory.html')}">📚 Farm finance guides</a>
        <button class="btn btn--outline btn--sm" onclick="window.print()">🖨 Print comparison</button>
      </div>

      <p class="small muted mt-4">
        Rates shown are typical published ranges for Kenyan agri-lending and are for planning only.
        Your actual rate depends on your credit history, security and the lender's assessment.
        Always confirm exact terms directly with the lender.
      </p>
    </div>
  </div>`;
}

/* =============================================================== EVENTS */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const principal = Number(qs('#amount').value) || 0;
  const months = Number(qs('#months').value) || 12;
  const profit = Number(qs('#expectedProfit').value) || 0;

  if (principal < 1000) return toast('Enter an amount of at least KES 1,000.', 'warn');
  if (months < 1 || months > 60) return toast('Choose a term between 1 and 60 months.', 'warn');

  render(principal, months, profit);
  write(KEY, { principal, months, profit });
  toast('Comparison ready.', 'success');
  if (window.matchMedia('(max-width: 1080px)').matches) {
    out.scrollIntoView({ behavior: 'smooth' });
  }
});

qs('#resetLoan').addEventListener('click', () => {
  form.reset();
  out.innerHTML = placeholder();
});

/* Quick amount buttons */
qsa('[data-amount]').forEach((btn) => {
  btn.addEventListener('click', () => {
    qs('#amount').value = btn.dataset.amount;
    qsa('[data-amount]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

/* Restore last */
const saved = read(KEY, null);
if (saved && saved.principal) {
  qs('#amount').value = saved.principal;
  qs('#months').value = saved.months;
  qs('#expectedProfit').value = saved.profit || '';
  render(saved.principal, saved.months, saved.profit);
} else {
  out.innerHTML = placeholder();
}