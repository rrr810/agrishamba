/** settings.js — account, security, notification and preference settings. */
import { store } from '../state.js';
import { auth } from '../auth.js';
import { clearAll } from '../storage.js';
import { rules, validateForm } from '../validation.js';
import { qs, qsa, escapeHtml, toast, confirmDialog, setButtonLoading, requireAuth, page } from '../ui.js';

const user = await requireAuth();
if (user) {
  const panel = qs('#settingsPanel');
  const s = () => store.getSettings();

  const toggle = (key, label, desc) => `
    <div class="switch">
      <div><p class="switch__label">${label}</p><p class="switch__desc">${desc}</p></div>
      <span class="toggle"><input type="checkbox" data-setting="${key}" ${s()[key] ? 'checked' : ''}
        aria-label="${label}"><span class="toggle__track"></span></span>
    </div>`;

  const views = {
    account: () => `
      <section class="card card--pad">
        <h2 style="font-size:var(--fs-md)" class="mb-4">Account information</h2>
        <dl class="spec-list">
          <div><dt>Name</dt><dd>${escapeHtml(user.fullName)}</dd></div>
          <div><dt>Email</dt><dd>${escapeHtml(user.email)}</dd></div>
          <div><dt>Phone</dt><dd>${escapeHtml(user.phone)}</dd></div>
          <div><dt>Account type</dt><dd style="text-transform:capitalize">${escapeHtml(user.accountType)}</dd></div>
          <div><dt>Verification</dt><dd>${user.verified ? '✅ Verified' : '⚠️ Pending'}</dd></div>
        </dl>
        <div class="form-actions">
          <a class="btn btn--primary" href="profile.html">Edit profile</a>
          <a class="btn btn--outline" href="verify-email.html">Email verification</a>
        </div>
      </section>
      <section class="card card--pad mt-5" style="border-color:#f3cdcd">
        <h2 style="font-size:var(--fs-md);color:var(--danger-600)">Danger zone</h2>
        <p class="small muted mt-2 mb-4">Clearing demo data removes the cart, orders, listings and session stored in this
          browser and restores the original sample dataset on reload.</p>
        <div class="flex gap-2 wrap">
          <button class="btn btn--outline" id="clearDemo">Reset demo data</button>
          <button class="btn btn--danger" id="deleteAccount">Delete account</button>
        </div>
      </section>`,

    security: () => `
      <section class="card card--pad">
        <h2 style="font-size:var(--fs-md)" class="mb-4">Change password</h2>
        <form id="pwForm" novalidate>
          <div class="field"><label for="current">Current password</label>
            <input class="input" id="current" name="current" type="password" autocomplete="current-password"></div>
          <div class="field"><label for="newPw">New password <span class="req">*</span></label>
            <input class="input" id="newPw" name="newPw" type="password" autocomplete="new-password" required></div>
          <div class="field"><label for="confirmPw">Confirm new password <span class="req">*</span></label>
            <input class="input" id="confirmPw" name="confirmPw" type="password" autocomplete="new-password" required></div>
          <button class="btn btn--primary" type="submit">Update password</button>
        </form>
      </section>
      <section class="card card--pad mt-5">
        <h2 style="font-size:var(--fs-md)" class="mb-3">Sessions &amp; two-factor</h2>
        <p class="small muted mb-4">Session management and 2FA are enforced by the authentication provider.
          These controls activate once Supabase Auth is connected.</p>
        <div class="flex gap-2 wrap">
          <button class="btn btn--outline" data-action="coming-soon" data-message="Two-factor authentication is configured in Supabase Auth and will be enabled after backend integration.">Enable 2FA</button>
          <button class="btn btn--outline" data-action="coming-soon" data-message="Signing out other devices requires the auth backend session API.">Sign out other devices</button>
        </div>
      </section>`,

    notifications: () => `
      <section class="card card--pad">
        <h2 style="font-size:var(--fs-md)" class="mb-2">Notification preferences</h2>
        <p class="small muted mb-3">Stored locally in demo mode; synced to your profile in production.</p>
        ${toggle('emailOrders', 'Order emails', 'Order confirmations, dispatch and delivery updates.')}
        ${toggle('emailMarketing', 'Product news', 'Occasional platform updates and new feature announcements.')}
        ${toggle('smsAlerts', 'SMS alerts', 'Critical order and payment alerts by SMS.')}
        ${toggle('priceAlerts', 'Market price alerts', 'Notify me when reference prices move sharply.')}
      </section>`,

    preferences: () => `
      <section class="card card--pad">
        <h2 style="font-size:var(--fs-md)" class="mb-4">Platform preferences</h2>
        <div class="grid-2">
          <div class="field"><label for="language">Language</label>
            <select class="select" id="language" data-setting-select="language">
              <option value="en" ${s().language === 'en' ? 'selected' : ''}>English</option>
              <option value="sw" ${s().language === 'sw' ? 'selected' : ''}>Kiswahili (coming soon)</option>
            </select></div>
          <div class="field"><label for="currency">Currency</label>
            <select class="select" id="currency" data-setting-select="currency">
              <option value="KES" ${s().currency === 'KES' ? 'selected' : ''}>KES — Kenyan Shilling</option>
            </select></div>
        </div>
        ${toggle('compactCards', 'Compact product cards', 'Show more listings per screen on the marketplace.')}
      </section>`
  };

  function show(tab) {
    panel.innerHTML = views[tab]();
    wire(tab);
  }

  function wire(tab) {
    qsa('[data-setting]').forEach((input) => {
      input.addEventListener('change', () => {
        store.updateSettings({ [input.dataset.setting]: input.checked });
        toast(`${input.getAttribute('aria-label')} ${input.checked ? 'enabled' : 'disabled'}.`, 'success');
      });
    });
    qsa('[data-setting-select]').forEach((sel) => {
      sel.addEventListener('change', () => {
        if (sel.value === 'sw') { toast('Kiswahili translation is coming soon.', 'info'); sel.value = 'en'; return; }
        store.updateSettings({ [sel.dataset.settingSelect]: sel.value });
        toast('Preference saved.', 'success');
      });
    });

    if (tab === 'security') {
      const form = qs('#pwForm');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { valid, values } = validateForm(form, { newPw: [rules.required, rules.password], confirmPw: [rules.required] });
        if (!valid) return;
        if (values.newPw !== values.confirmPw) return toast('The new passwords do not match.', 'error');
        const btn = form.querySelector('button[type="submit"]');
        setButtonLoading(btn, true, 'Updating…');
        const { error } = await auth.updatePassword(values.newPw);
        setButtonLoading(btn, false);
        if (error) return toast(error.message, 'error');
        form.reset();
        toast('Password updated (demo).', 'success');
      });
    }

    if (tab === 'account') {
      qs('#clearDemo').addEventListener('click', async () => {
        const yes = await confirmDialog({ title: 'Reset demo data', message: 'This clears your cart, orders, listings and session in this browser. Continue?', confirmLabel: 'Reset data', danger: true });
        if (!yes) return;
        clearAll();
        toast('Demo data cleared. Reloading…', 'success');
        setTimeout(() => { location.href = page('login.html'); }, 900);
      });
      qs('#deleteAccount').addEventListener('click', async () => {
        const yes = await confirmDialog({ title: 'Delete account', message: 'Account deletion must be processed by the backend so that orders, payments and legal records are handled correctly. Log out of the demo session instead?', confirmLabel: 'Log out', danger: true });
        if (!yes) return;
        await auth.logout();
        location.href = page('login.html');
      });
    }
  }

  qs('#settingsTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    qsa('#settingsTabs .tab').forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    show(btn.dataset.tab);
  });

  show('account');
}
