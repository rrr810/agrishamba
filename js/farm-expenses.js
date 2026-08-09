/**
 * farm-expenses.js — Farm expense tracker.
 * Log every shilling spent on the farm, see where it goes,
 * and compare against what the season was supposed to cost.
 * Persists to Supabase when signed in, localStorage otherwise.
 */
import { qs, qsa, formatKES, escapeHtml, toast, page, confirmDialog } from './ui.js';
import { store } from './state.js';
import { read, write } from './storage.js';
import { getSupabase } from './supabase-client.js';
import { CROP_PROFILES } from './farm-data.js';

const LKEY = 'sokoshamba:expenses-local';

export const EXPENSE_CATEGORIES = [
  { id: 'seed',       label: 'Seed',            icon: '🌱' },
  { id: 'fertilizer', label: 'Fertilizer',      icon: '🧪' },
  { id: 'chemicals',  label: 'Chemicals',       icon: '🧴' },
  { id: 'labour',     label: 'Labour',          icon: '👷' },
  { id: 'land',       label: 'Land & rent',     icon: '🗺️' },
  { id: 'irrigation', label: 'Irrigation',      icon: '💧' },
  { id: 'equipment',  label: 'Equipment',       icon: '🚜' },
  { id: 'feed',       label: 'Feed',            icon: '🌽' },
  { id: 'veterinary', label: 'Vet & vaccines',  icon: '🩺' },
  { id: 'transport',  label: 'Transport',       icon: '🚛' },
  { id: 'fuel',       label: 'Fuel & power',    icon: '⛽' },
  { id: 'packaging',  label: 'Packaging',       icon: '📦' },
  { id: 'other',      label: 'Other',           icon: '📌' }
];

const catMeta = (id) => EXPENSE_CATEGORIES.find((c) => c.id === id)
  || { id, label: id, icon: '📌' };

/* ============================================================ STORAGE */
async function loadExpenses() {
  const user = store.getUser();
  if (user) {
    const sb = await getSupabase();
    const { data, error } = await sb.from('farm_expenses')
      .select('*').eq('user_id', user.id).order('date', { ascending: false });
    if (!error && data) return data;
  }
  return read(LKEY, []);
}

async function saveExpense(exp) {
  const user = store.getUser();
  if (user) {
    const sb = await getSupabase();
    const row = {
      user_id: user.id, date: exp.date, category: exp.category,
      description: exp.description || '', crop: exp.crop || '',
      amount: Number(exp.amount)
    };
    if (exp.id && !exp.id.startsWith('local-')) {
      const { error } = await sb.from('farm_expenses').update(row).eq('id', exp.id);
      if (error) return failSave(error.message);
    } else {
      const { error } = await sb.from('farm_expenses').insert(row);
      if (error) return failSave(error.message);
    }
    return true;
  }
  const list = read(LKEY, []);
  if (exp.id && exp.id.startsWith('local-')) {
    const i = list.findIndex((e) => e.id === exp.id);
    if (i > -1) list[i] = { ...list[i], ...exp };
  } else {
    list.unshift({ ...exp, id: 'local-' + Date.now() });
  }
  write(LKEY, list);
  return true;
}

function failSave(msg) { toast('Could not save: ' + msg, 'error'); return false; }

async function deleteExpense(id) {
  const user = store.getUser();
  if (user && !id.startsWith('local-')) {
    const sb = await getSupabase();
    await sb.from('farm_expenses').delete().eq('id', id);
  } else {
    write(LKEY, read(LKEY, []).filter((e) => e.id !== id));
  }
}

/* ============================================================ MATHS */
function breakdownByCategory(expenses) {
  const map = {};
  expenses.forEach((e) => {
    map[e.category] = (map[e.category] || 0) + Number(e.amount);
  });
  const total = Object.values(map).reduce((s, v) => s + v, 0);
  return {
    total,
    rows: Object.entries(map)
      .map(([cat, amt]) => ({ cat, amt, pct: total > 0 ? (amt / total) * 100 : 0 }))
      .sort((a, b) => b.amt - a.amt)
  };
}

function lastSixMonths(expenses) {
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('en-KE', { month: 'short' }),
      total: 0
    });
  }
  expenses.forEach((e) => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const b = buckets.find((x) => x.key === key);
    if (b) b.total += Number(e.amount);
  });
  return buckets;
}

/* ============================================================ RENDER */
const listEl = qs('#expenseList');
const statsEl = qs('#expenseStats');
let all = [];
let editingId = null;

async function refresh() {
  const listWrap = qs('#expenseListWrap');
  if (listWrap) listWrap.innerHTML = `<div class="state" style="padding:28px"><div class="spinner"></div><p>Loading your records…</p></div>`;
  all = await loadExpenses();
  renderStats();
  renderList();
}

function renderStats() {
  const bd = breakdownByCategory(all);
  const months = lastSixMonths(all);
  const maxMonth = Math.max(...months.map((m) => m.total), 1);
  const avgMonth = months.reduce((s, m) => s + m.total, 0) / 6;

  const budget = Number(qs('#seasonBudget')?.value) || 0;
  let budgetHtml = '';
  if (budget > 0) {
    const used = (bd.total / budget) * 100;
    const over = used > 100;
    budgetHtml = `
      <div class="card card--pad" style="border-color:${over ? 'var(--danger-500)' : 'var(--green-300)'}">
        <div class="flex justify-between items-center wrap gap-2">
          <strong>Season budget</strong>
          <span class="badge ${over ? 'badge--danger' : 'badge--green'}">
            ${Math.round(used)}% used</span>
        </div>
        <div class="progress mt-3">
          <span style="width:${Math.min(100, used)}%;background:${over ? 'var(--danger-500)' : 'var(--green-500)'}"></span>
        </div>
        <p class="small muted mt-2">
          ${over
            ? `You're ${formatKES(bd.total - budget)} over budget. Time to review the biggest categories below.`
            : `${formatKES(Math.max(0, budget - bd.total))} of your ${formatKES(budget)} budget still available.`}
        </p>
      </div>`;
  }

  statsEl.innerHTML = `
    <div class="stat-grid">
      <div class="stat"><p class="stat__label">Spent this season</p>
        <p class="stat__value">${formatKES(bd.total)}</p>
        <p class="stat__meta">${all.length} record${all.length === 1 ? '' : 's'} logged</p></div>
      <div class="stat stat--gold"><p class="stat__label">Top category</p>
        <p class="stat__value" style="font-size:1.3rem">${bd.rows[0] ? catMeta(bd.rows[0].cat).icon + ' ' + escapeHtml(catMeta(bd.rows[0].cat).label) : '—'}</p>
        <p class="stat__meta">${bd.rows[0] ? Math.round(bd.rows[0].pct) + '% of all spending' : 'No spending yet'}</p></div>
      <div class="stat stat--info"><p class="stat__label">Avg / month</p>
        <p class="stat__value">${formatKES(Math.round(avgMonth))}</p>
        <p class="stat__meta">Last 6 months</p></div>
    </div>

    ${budgetHtml}

    <div class="grid gap-4 mt-4" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
      <div class="card card--pad">
        <h3 style="font-size:var(--fs-base)" class="mb-3">💸 Where the money went</h3>
        ${bd.rows.length ? bd.rows.map((r) => `
          <div class="mb-3">
            <div class="flex justify-between small">
              <span>${catMeta(r.cat).icon} ${escapeHtml(catMeta(r.cat).label)}</span>
              <strong>${formatKES(r.amt)} <span class="muted">(${Math.round(r.pct)}%)</span></strong>
            </div>
            <div class="progress mt-1"><span style="width:${r.pct}%"></span></div>
          </div>`).join('')
        : `<p class="small muted">Nothing logged yet.</p>`}
      </div>

      <div class="card card--pad">
        <h3 style="font-size:var(--fs-base)" class="mb-3">📈 Last 6 months</h3>
        <div class="bars" style="height:160px">
          ${months.map((m) => `
            <div class="bars__col">
              <div class="bars__bar" style="height:${(m.total / maxMonth) * 100}%"></div>
              <small>${m.label}</small>
            </div>`).join('')}
        </div>
        <p class="small muted mt-3">
          ${months[5].total > 0
            ? `This month so far: <strong>${formatKES(months[5].total)}</strong>`
            : 'No spending recorded this month yet.'}
        </p>
      </div>
    </div>`;
}

function renderList() {
  if (!all.length) {
    listEl.innerHTML = `<div class="state">
      <div class="state__icon" aria-hidden="true">📓</div>
      <h3>No expenses logged yet</h3>
      <p>Every shilling you record here builds a true picture of your farm's costs.
        Start with your biggest recent purchase.</p>
    </div>`;
    return;
  }

  listEl.innerHTML = `
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Crop</th>
        <th style="text-align:right">Amount</th><th></th></tr></thead>
      <tbody>
        ${all.map((e) => `
          <tr style="transition:background .15s ease" onmouseover="this.style.background='var(--green-50)'"
              onmouseout="this.style.background=''">
            <td>${new Date(e.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</td>
            <td>${catMeta(e.category).icon} ${escapeHtml(catMeta(e.category).label)}</td>
            <td>${escapeHtml(e.description || '—')}</td>
            <td class="muted">${escapeHtml(e.crop || '—')}</td>
            <td style="text-align:right;font-weight:700">${formatKES(e.amount)}</td>
            <td style="text-align:right;white-space:nowrap">
              <button class="btn btn--ghost btn--sm" data-edit="${e.id}" aria-label="Edit">✏️</button>
              <button class="btn btn--ghost btn--sm" data-del="${e.id}" style="color:var(--danger-600)" aria-label="Delete">🗑️</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table></div>`;

  qsa('[data-del]', listEl).forEach((btn) => {
    btn.addEventListener('click', async () => {
      const yes = await confirmDialog({
        title: 'Delete this record?',
        message: 'This removes the expense from your tracker. This cannot be undone.',
        confirmLabel: 'Delete', danger: true
      });
      if (!yes) return;
      await deleteExpense(btn.dataset.del);
      toast('Record deleted.', 'success');
      refresh();
    });
  });

  qsa('[data-edit]', listEl).forEach((btn) => {
    btn.addEventListener('click', () => {
      const e = all.find((x) => x.id === btn.dataset.edit);
      if (!e) return;
      editingId = e.id;
      qs('#expDate').value = e.date;
      qs('#expCategory').value = e.category;
      qs('#expDesc').value = e.description || '';
      qs('#expCrop').value = e.crop || '';
      qs('#expAmount').value = e.amount;
      qs('#saveExpenseBtn').textContent = 'Save changes';
      qs('#cancelEditBtn').hidden = false;
      qs('#expenseForm').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/* ============================================================ FORM */
function buildForm() {
  qs('#expCategory').innerHTML = EXPENSE_CATEGORIES
    .map((c) => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
  qs('#expCrop').innerHTML = `<option value="">General / whole farm</option>` +
    Object.values(CROP_PROFILES).map((c) => `<option>${escapeHtml(c.name)}</option>`).join('');
}

function wireForm() {
  qs('#expenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(qs('#expAmount').value);
    const date = qs('#expDate').value;
    if (!amount || amount <= 0) return toast('Enter an amount greater than zero.', 'warn');
    if (!date) return toast('Pick a date.', 'warn');

    const exp = {
      id: editingId,
      date,
      category: qs('#expCategory').value,
      description: qs('#expDesc').value.trim(),
      crop: qs('#expCrop').value,
      amount
    };

    const okSave = await saveExpense(exp);
    if (!okSave) return;

    toast(editingId ? 'Record updated.' : `Logged ${formatKES(amount)}.`, 'success');
    editingId = null;
    qs('#expenseForm').reset();
    qs('#expDate').value = new Date().toISOString().slice(0, 10);
    qs('#saveExpenseBtn').textContent = 'Log expense';
    qs('#cancelEditBtn').hidden = true;
    refresh();
  });

  qs('#cancelEditBtn').addEventListener('click', () => {
    editingId = null;
    qs('#expenseForm').reset();
    qs('#expDate').value = new Date().toISOString().slice(0, 10);
    qs('#saveExpenseBtn').textContent = 'Log expense';
    qs('#cancelEditBtn').hidden = true;
  });

  qs('#seasonBudget').addEventListener('change', () => {
    write('sokoshamba:expense-budget', qs('#seasonBudget').value);
    renderStats();
  });
  qs('#printExpenses').addEventListener('click', () => window.print());
}

/* ============================================================ BOOT */
buildForm();
wireForm();
qs('#expDate').value = new Date().toISOString().slice(0, 10);
const savedBudget = read('sokoshamba:expense-budget', '');
if (savedBudget) qs('#seasonBudget').value = savedBudget;
refresh();