/** notifications.js — notifications page (dropdown lives in ui.js). */
import { notificationsService } from './api.js';
import { store } from './state.js';
import { qs, qsa, escapeHtml, timeAgo, emptyState, toast, refreshHeaderBadges } from './ui.js';

const ICONS = { order: '📦', payment: '💳', message: '💬', listing: '🏷️', system: '⚙️' };
const FILTERS = [['all', 'All'], ['unread', 'Unread'], ['order', 'Orders'], ['payment', 'Payments'], ['message', 'Messages'], ['listing', 'Listings'], ['system', 'System']];

const list = qs('#notifList');
let filter = 'all';

qs('#notifFilters').innerHTML = FILTERS
  .map(([v, l]) => `<button class="chip ${v === 'all' ? 'active' : ''}" data-filter="${v}">${l}</button>`).join('');

async function draw() {
  const { data } = await notificationsService.list();
  let rows = data;
  if (filter === 'unread') rows = rows.filter((n) => !n.read);
  else if (filter !== 'all') rows = rows.filter((n) => n.type === filter);

  if (!rows.length) {
    list.innerHTML = emptyState('Nothing here', filter === 'unread' ? 'You are all caught up.' : 'Notifications about orders, payments and messages will appear here.');
    return;
  }

  list.innerHTML = rows.map((n) => `
    <div class="notif-item ${n.read ? '' : 'unread'}" style="border-bottom:1px solid var(--border);border-radius:0;align-items:center">
      <span class="notif-item__icon" aria-hidden="true">${ICONS[n.type] || '🔔'}</span>
      <div style="flex:1;min-width:0">
        <span class="notif-item__title">${escapeHtml(n.title)} ${n.read ? '' : '<span class="badge badge--green" style="margin-left:6px">New</span>'}</span>
        <span class="notif-item__body">${escapeHtml(n.body)}</span>
        <time>${timeAgo(n.at)}</time>
      </div>
      ${n.read ? '' : `<button class="btn btn--ghost btn--sm" data-read="${n.id}">Mark read</button>`}
    </div>`).join('');
}

qs('#notifFilters').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-filter]');
  if (!btn) return;
  qsa('#notifFilters .chip').forEach((c) => c.classList.remove('active'));
  btn.classList.add('active');
  filter = btn.dataset.filter;
  draw();
});

list.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-read]');
  if (!btn) return;
  await notificationsService.markRead(btn.dataset.read);
  refreshHeaderBadges();
  toast('Notification marked as read.', 'success');
  draw();
});

store.subscribe((event) => { if (event === 'notifications') draw(); });
draw();
