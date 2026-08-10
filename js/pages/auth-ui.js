/** auth-ui.js — controller for login / register / forgot / reset / verify pages. */
import { auth } from '../auth.js';
import { store } from '../state.js';
import { rules, validateForm, liveValidate, setFieldError, normalizePhone } from '../validation.js';
import { qs, qsa, toast, setButtonLoading, escapeHtml, getParam, page } from '../ui.js';
import { COUNTIES, ACCOUNT_TYPES, isDemo } from '../config.js';
import { getSupabase } from '../supabase-client.js';

auth.hydrate();

if (!isDemo()) {
  qs('#loginForm')?.previousElementSibling?.remove?.();
  const alertBoxEl = qs('#loginForm')?.parentElement?.querySelector('.alert--info');
  alertBoxEl?.remove();
}

qsa('[data-toggle-password]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.togglePassword);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? '🙈' : '👁';
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
});

function alertBox(type, html) {
  const box = qs('#formAlert');
  if (!box) return;
  box.innerHTML = `<div class="alert alert--${type}"><span aria-hidden="true">${type === 'error' ? '⛔' : '✅'}</span><div>${html}</div></div>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
const clearAlert = () => { const b = qs('#formAlert'); if (b) b.innerHTML = ''; };

function wireStrength(inputId = 'password') {
  const input = document.getElementById(inputId);
  const meter = qs('#strength');
  if (!input || !meter) return;
  input.addEventListener('input', () => {
    const { score, label } = auth.passwordStrength(input.value);
    meter.dataset.level = input.value ? String(score) : '0';
    meter.querySelector('.strength__text').textContent = input.value ? `Password strength: ${label}` : 'Use 8+ characters with a mix of letters, numbers and symbols.';
  });
}

function redirectForUser(user) {
  const next = getParam('next');
  if (next) return next;
  const map = {
    farmer: 'farmer-dashboard.html',
    buyer: 'buyer-dashboard.html',
    supplier: 'supplier-dashboard.html',
    service: 'service-dashboard.html',
    rider: 'rider-dashboard.html',
    admin: 'admin.html'
  };
  return map[user.accountType] || 'dashboard.html';
}

const loginForm = qs('#loginForm');
if (loginForm) {
  const schema = { email: [rules.required, rules.email], password: [rules.required, rules.loginPassword] };
  liveValidate(loginForm, schema);

  qsa('[data-demo]').forEach((chip) => {
    chip.addEventListener('click', async () => {
      chip.classList.add('active');
      const { data, error } = await auth.loginAsDemo(chip.dataset.demo);
      chip.classList.remove('active');
      if (error) return toast(error.message, 'error');
      toast(`Signed in as ${data.fullName} (demo).`, 'success');
      setTimeout(() => { location.href = redirectForUser(data); }, 600);
    });
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    const { valid, values } = validateForm(loginForm, schema);
    if (!valid) return;
    const btn = loginForm.querySelector('button[type="submit"]');
    setButtonLoading(btn, true, 'Signing in…');
    const { data, error } = await auth.login({ email: values.email, password: values.password });
    setButtonLoading(btn, false);
    if (error) return alertBox('error', escapeHtml(error.message));
    alertBox('success', `Welcome back, ${escapeHtml(data.fullName.split(' ')[0])}. Redirecting…`);
    toast('Logged in successfully.', 'success');
    setTimeout(() => { location.href = redirectForUser(data); }, 700);
  });
}

const registerForm = qs('#registerForm');
if (registerForm) {
  const wrap = qs('#accountTypes');
  const preset = getParam('type');
  if (wrap) {
    wrap.innerHTML = ACCOUNT_TYPES.map((t) => `
      <label class="choice">
        <input type="radio" name="accountType" value="${t.id}" ${preset === t.id ? 'checked' : ''}>
        <span><span class="choice__title">${t.label}</span><span class="choice__desc">${t.desc}</span></span>
      </label>`).join('');
  }

  const countySelect = qs('#county');
  if (countySelect) {
    countySelect.insertAdjacentHTML('beforeend', COUNTIES.map((c) => `<option>${c}</option>`).join(''));
  }

  wireStrength('password');

  const schema = {
    accountType: [rules.required],
    fullName: [rules.required, rules.minLen(3)],
    phone: [rules.required, rules.phone],
    email: [rules.required, rules.email],
    password: [rules.required, rules.password],
    confirmPassword: [rules.required],
    terms: [rules.checked]
  };
  liveValidate(registerForm, { fullName: schema.fullName, phone: schema.phone, email: schema.email, password: schema.password });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    const result = validateForm(registerForm, schema);
    const pw = registerForm.elements.password.value;
    const cpw = registerForm.elements.confirmPassword.value;
    if (result.valid && pw !== cpw) {
      setFieldError(registerForm.elements.confirmPassword, 'The passwords do not match.');
      registerForm.elements.confirmPassword.focus();
      return;
    }
    if (!result.valid) {
      if (result.errors.accountType) qs('#accountType-error').textContent = 'Choose the account type that fits you.';
      if (result.errors.terms) qs('#terms-error').textContent = 'Please accept the terms to continue.';
      return;
    }
    const btn = registerForm.querySelector('button[type="submit"]');
    setButtonLoading(btn, true, 'Creating account…');
    const { data, error } = await auth.register({
      ...result.values,
      phone: normalizePhone(result.values.phone)
    });
    setButtonLoading(btn, false);
    if (error) return alertBox('error', escapeHtml(error.message));
    alertBox('success', 'Account created. Taking you to email verification…');
    toast('Welcome to SokoShamba!', 'success');
    setTimeout(() => { location.href = 'verify-email.html'; }, 900);
  });
}

const forgotForm = qs('#forgotForm');
if (forgotForm) {
  const schema = { email: [rules.required, rules.email] };
  liveValidate(forgotForm, schema);
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    const { valid, values } = validateForm(forgotForm, schema);
    if (!valid) return;
    const btn = forgotForm.querySelector('button[type="submit"]');
    setButtonLoading(btn, true, 'Sending…');
    const { data, error } = await auth.resetPassword(values.email);
    setButtonLoading(btn, false);
    if (error) return alertBox('error', escapeHtml(error.message));
    forgotForm.hidden = true;
    const successBox = qs('#forgotSuccess');
    if (successBox) {
      successBox.hidden = false;
      const link = successBox.querySelector('#directResetLink');
      if (link && data?.resetUrl) {
        link.href = data.resetUrl;
      }
    }
  });
}

const resetForm = qs('#resetForm');
if (resetForm) {
  wireStrength('password');
  const schema = { password: [rules.required, rules.password], confirmPassword: [rules.required] };
  liveValidate(resetForm, schema);

  (async () => {
    const hasHashToken = window.location.hash && window.location.hash.includes('access_token');
    const hasCodeParam = window.location.search && window.location.search.includes('code');
    const sb = await getSupabase();
    let session = null;
    if (sb) {
      const res = await sb.auth.getSession();
      session = res.data?.session;
    }

    const warningBox = qs('#tokenWarning');
    const warningText = qs('#tokenWarningText');

    if (!hasHashToken && !hasCodeParam && !session) {
      if (warningBox && warningText) {
        warningBox.className = 'alert alert--warn mb-4';
        warningBox.hidden = false;
        warningText.innerHTML = `No active password recovery link detected. If your link expired, please <a href="forgot-password.html"><strong>request a new reset link</strong></a>.`;
      }
    } else {
      if (warningBox) warningBox.hidden = true;
    }
  })();

  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    const { valid, values } = validateForm(resetForm, schema);
    if (!valid) return;
    if (values.password !== values.confirmPassword) {
      return setFieldError(resetForm.elements.confirmPassword, 'The passwords do not match.');
    }
    const btn = resetForm.querySelector('button[type="submit"]');
    setButtonLoading(btn, true, 'Updating…');
    
    try {
      const { data, error } = await auth.updatePassword(values.password);
      setButtonLoading(btn, false);
      if (error) return alertBox('error', escapeHtml(error.message));
      
      store.clearUser();
      alertBox('success', 'Password updated successfully! Taking you to login…');
      toast('Password updated successfully! 🎉', 'success');
      setTimeout(() => { location.href = 'login.html'; }, 1400);
    } catch (err) {
      setButtonLoading(btn, false);
      alertBox('error', escapeHtml(err.message || 'Could not update password. Please try again.'));
    }
  });
}

const resendBtn = qs('#resendBtn');
if (resendBtn) {
  const user = store.getUser();
  const emailEl = qs('#verifyEmail');
  if (user && emailEl) emailEl.textContent = user.email;
  resendBtn.addEventListener('click', async () => {
    setButtonLoading(resendBtn, true, 'Sending…');
    const { error } = await auth.resendVerification(user?.email || '');
    setButtonLoading(resendBtn, false);
    if (error) return toast(error.message, 'error');
    toast('Verification email sent.', 'info');
  });
}