/** profile.js — view and edit the signed-in user's profile. */
import { profiles } from '../api.js';
import { COUNTIES, ACCOUNT_TYPES } from '../config.js';
import { rules, validateForm, liveValidate, normalizePhone } from '../validation.js';
import { qs, escapeHtml, initials, formatDate, toast, setButtonLoading, requireAuth } from '../ui.js';

const user = await requireAuth();
if (user) {
  const root = qs('#profileRoot');

  const render = (u) => {
    const type = ACCOUNT_TYPES.find((t) => t.id === u.accountType);
    root.innerHTML = `
    <section class="card card--pad mb-5">
      <div class="profile-head">
        <div class="avatar avatar--lg" id="avatarBox">${u.avatar ? `<img src="${u.avatar}" alt="Profile photo of ${escapeHtml(u.fullName)}" style="width:100%;height:100%;object-fit:cover">` : initials(u.fullName)}</div>
        <div style="flex:1">
          <h2 style="font-size:var(--fs-xl)">${escapeHtml(u.fullName)}</h2>
          <p class="muted small">${escapeHtml(type?.label || u.accountType)} · Joined ${formatDate(u.joined)}</p>
          <div class="flex gap-2 mt-3 wrap">
            ${u.verified ? '<span class="badge badge--green badge--verified">Verified account</span>' : '<span class="badge badge--warn">Verification pending</span>'}
            ${u.rating ? `<span class="badge">⭐ ${u.rating}</span>` : ''}
            <span class="badge badge--info">📍 ${escapeHtml(u.county || 'County not set')}</span>
          </div>
        </div>
        <div>
          <label class="btn btn--outline btn--sm" for="avatarInput">Change photo</label>
          <input type="file" id="avatarInput" accept="image/*" class="sr-only">
        </div>
      </div>
      <p class="small muted mt-4">Avatar uploads go to a Supabase Storage bucket in production; in demo mode the image
        stays in your browser only.</p>
    </section>

    <form class="card card--pad" id="profileForm" novalidate>
      <h2 style="font-size:var(--fs-md)" class="mb-4">Profile details</h2>
      <div class="grid-2">
        <div class="field"><label for="fullName">Full name <span class="req">*</span></label>
          <input class="input" id="fullName" name="fullName" value="${escapeHtml(u.fullName)}" required></div>
        <div class="field"><label for="phone">Phone <span class="req">*</span></label>
          <input class="input" id="phone" name="phone" type="tel" value="${escapeHtml(u.phone)}" required></div>
      </div>
      <div class="grid-2">
        <div class="field"><label for="email">Email <span class="req">*</span></label>
          <input class="input" id="email" name="email" type="email" value="${escapeHtml(u.email)}" required>
          <p class="hint">Changing your email requires re-verification once auth is connected.</p></div>
        <div class="field"><label for="accountType">Account type</label>
          <select class="select" id="accountType" name="accountType">
            ${ACCOUNT_TYPES.map((t) => `<option value="${t.id}" ${t.id === u.accountType ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select></div>
      </div>
      <div class="grid-2">
        <div class="field"><label for="county">County</label>
          <select class="select" id="county" name="county"><option value="">Select county</option>
            ${COUNTIES.map((c) => `<option ${c === u.county ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label for="location">Town / ward</label>
          <input class="input" id="location" name="location" value="${escapeHtml(u.location || '')}"></div>
      </div>
      <div class="field"><label for="bio">About you</label>
        <textarea class="textarea" id="bio" name="bio" placeholder="Tell buyers about your farm, produce and experience.">${escapeHtml(u.bio || '')}</textarea></div>
      <div class="form-actions">
        <button class="btn btn--primary" type="submit">Save changes</button>
        <a class="btn btn--outline" href="settings.html">Account settings</a>
      </div>
    </form>`;

    const form = qs('#profileForm');
    const schema = {
      fullName: [rules.required, rules.minLen(3)],
      phone: [rules.required, rules.phone],
      email: [rules.required, rules.email]
    };
    liveValidate(form, schema);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { valid, values } = validateForm(form, schema);
      if (!valid) return toast('Please fix the highlighted fields.', 'error');
      const btn = form.querySelector('button[type="submit"]');
      setButtonLoading(btn, true, 'Saving…');
      const { data, error } = await profiles.update({ ...values, phone: normalizePhone(values.phone) });
      setButtonLoading(btn, false);
      if (error) return toast(error.message, 'error');
      toast('Profile updated.', 'success');
      render(data);
    });

    qs('#avatarInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) return toast('Choose an image under 2MB.', 'error');
      const { data, error } = await profiles.uploadAvatar(file);
      if (error) return toast(error.message, 'error');
      const { data: updated } = await profiles.update({ avatar: data.url });
      toast('Profile photo updated.', 'success');
      render(updated);
    });
  };

  render(user);
}
