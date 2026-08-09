/**
 * guards.js — Role-based page access control.
 *
 * ⚠️ SECURITY NOTE: This is UX only. Real data protection is enforced by
 * Supabase Row Level Security. A determined user can bypass these guards in
 * the browser, but they still cannot read or write data they don't own.
 *
 * Usage in a page:
 *   const user = await requireRole(['rider', 'admin']);
 *   if (!user) return;   // guard already redirected / rendered a message
 */
import { store } from './state.js';
import { qs, page, escapeHtml } from './ui.js';

/* -------------------------------------------------------------- labels */
export const ROLE_META = {
  farmer:   { label: 'Farmer',            icon: '🧑‍🌾', home: 'farmer-dashboard.html' },
  buyer:    { label: 'Buyer',             icon: '🛒',   home: 'buyer-dashboard.html' },
  supplier: { label: 'Supplier',          icon: '🏪',   home: 'supplier-dashboard.html' },
  rider:    { label: 'Rider / Transport', icon: '🚛',   home: 'rider-dashboard.html' },
  service:  { label: 'Service Provider',  icon: '🧰',   home: 'service-dashboard.html' },
  admin:    { label: 'Administrator',     icon: '🛡️',  home: 'admin.html' }
};

/** Where each role should land after login. */
export function homeFor(accountType) {
  return ROLE_META[accountType]?.home || 'dashboard.html';
}

/** Roles allowed to publish products for sale. */
export const SELLER_ROLES = ['farmer', 'supplier', 'admin'];
/** Roles allowed to list services. */
export const PROVIDER_ROLES = ['service', 'rider', 'admin'];

/* ------------------------------------------------------------- helpers */
function renderBlocked({ user, allowed, mountSel = '#dashRoot' }) {
  const mount = qs(mountSel) || qs('#main') || document.body;
  const mine = ROLE_META[user.accountType] || { label: user.accountType, icon: '👤', home: 'dashboard.html' };
  const wanted = allowed
    .map((r) => `${ROLE_META[r]?.icon || ''} ${ROLE_META[r]?.label || r}`)
    .join(' or ');

  mount.innerHTML = `
    <div class="container" style="padding:var(--sp-8) 0;max-width:620px">
      <div class="card card--pad text-center">
        <div style="font-size:3rem" aria-hidden="true">🔒</div>
        <h1 class="mt-3" style="font-size:var(--fs-xl)">This area is for ${escapeHtml(wanted)}</h1>
        <p class="lead mt-3">You're signed in as a <strong>${mine.icon} ${escapeHtml(mine.label)}</strong>,
          so this dashboard won't show anything useful for you.</p>

        <div class="alert alert--info mt-5" style="text-align:left">
          <span aria-hidden="true">💡</span>
          <div>Need a different role? You can change your account type any time from
            <a href="${page('profile.html')}">your profile</a>.</div>
        </div>

        <div class="form-actions" style="justify-content:center">
          <a class="btn btn--primary btn--lg" href="${page(mine.home)}">
            ${mine.icon} Go to my ${escapeHtml(mine.label)} dashboard
          </a>
          <a class="btn btn--outline" href="${page('marketplace.html')}">Browse marketplace</a>
        </div>
      </div>
    </div>`;
}

/* ============================================================ EXPORTS */

/**
 * Require the visitor to be signed in AND hold one of the allowed roles.
 * Returns the user object, or null if blocked (a message was rendered).
 *
 * @param {string[]} allowed  e.g. ['rider','admin']
 * @param {object}   [opts]
 * @param {string}   [opts.mount]  selector to render the "blocked" card into
 * @param {boolean}  [opts.redirect] if true, bounce straight to their own home
 */
export async function requireRole(allowed, opts = {}) {
  const { auth } = await import('./auth.js');
  await auth.ready();

  const user = store.getUser();

  // Not signed in → send to login, remembering where they wanted to go
  if (!user) {
    const target = location.pathname.split('/').pop() + location.search;
    location.href = page('login.html') + '?next=' + encodeURIComponent(target);
    return null;
  }

  // Admin can see everything
  if (user.accountType === 'admin' || allowed.includes(user.accountType)) {
    return user;
  }

  if (opts.redirect) {
    location.href = page(homeFor(user.accountType));
    return null;
  }

  renderBlocked({ user, allowed, mountSel: opts.mount });
  return null;
}

/** Signed-in check only (any role). */
export async function requireUser() {
  const { auth } = await import('./auth.js');
  await auth.ready();
  const user = store.getUser();
  if (!user) {
    const target = location.pathname.split('/').pop() + location.search;
    location.href = page('login.html') + '?next=' + encodeURIComponent(target);
    return null;
  }
  return user;
}

/** True if the given user may publish product listings. */
export const canSell = (user) => SELLER_ROLES.includes(user?.accountType);
/** True if the given user may publish service listings. */
export const canProvideService = (user) => PROVIDER_ROLES.includes(user?.accountType);
