/** contact.js — support form with validation and automation event. */
import { automation } from '../api.js';
import { store } from '../state.js';
import { rules, validateForm, liveValidate, normalizePhone } from '../validation.js';
import { qs, toast, setButtonLoading, escapeHtml } from '../ui.js';

const form = qs('#contactForm');
const schema = {
  name: [rules.required, rules.minLen(3)],
  email: [rules.required, rules.email],
  phone: [rules.required, rules.phone],
  topic: [rules.required],
  message: [rules.required, rules.minLen(20)]
};
liveValidate(form, schema);

const user = store.getUser();
if (user) {
  form.elements.name.value = user.fullName;
  form.elements.email.value = user.email;
  form.elements.phone.value = user.phone;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { valid, values } = validateForm(form, schema);
  if (!valid) return toast('Please complete the highlighted fields.', 'error');
  const btn = form.querySelector('button[type="submit"]');
  setButtonLoading(btn, true, 'Sending…');
  await automation.sendEvent('SUPPORT_MESSAGE', { ...values, phone: normalizePhone(values.phone) });
  await new Promise((r) => setTimeout(r, 500));
  setButtonLoading(btn, false);
  const ref = 'SUP-' + Date.now().toString().slice(-6);
  store.pushNotification({ type: 'system', title: 'Support request received', body: `Reference ${ref} · ${values.topic}` });
  qs('#contactResult').innerHTML = `<div class="alert alert--success"><span>✅</span><div>
    <strong>Message received.</strong> Your reference is ${escapeHtml(ref)}. In production this is emailed to the support
    inbox through the automation service.</div></div>`;
  form.reset();
  toast('Message sent (demo).', 'success');
});
