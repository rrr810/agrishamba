/**
 * validation.js — Frontend validation helpers.
 * Server-side validation is still mandatory; this layer is for UX only.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
/** Kenyan numbers: 07xxxxxxxx, 01xxxxxxxx, +2547xxxxxxxx, 2541xxxxxxxx */
const PHONE_RE = /^(?:\+?254|0)(?:7|1)\d{8}$/;

export const rules = {
  required: (v) => (String(v ?? '').trim() ? '' : 'This field is required.'),
  email: (v) => (EMAIL_RE.test(String(v).trim()) ? '' : 'Enter a valid email address.'),
  phone: (v) => (PHONE_RE.test(String(v).replace(/[\s-]/g, '')) ? '' : 'Enter a valid Kenyan phone number, e.g. 0712345678.'),
  password: (v) => (String(v).length >= 8 ? '' : 'Password must be at least 8 characters.'),
  loginPassword: (v) => (String(v).length >= 6 ? '' : 'Password must be at least 6 characters.'),
  minLen: (n) => (v) => (String(v).trim().length >= n ? '' : `Use at least ${n} characters.`),
  positive: (v) => (Number(v) > 0 ? '' : 'Enter a number greater than zero.'),
  nonNegative: (v) => (v === '' || Number(v) >= 0 ? '' : 'Value cannot be negative.'),
  integer: (v) => (Number.isInteger(Number(v)) ? '' : 'Enter a whole number.'),
  match: (otherValue, label = 'values') => (v) => (v === otherValue ? '' : `The ${label} do not match.`),
  checked: (v) => (v ? '' : 'Please tick this box to continue.')
};

export function setFieldError(input, message) {
  const field = input.closest('.field') || input.parentElement;
  if (!field) return;
  let msg = field.querySelector('.error-msg');
  if (!msg) {
    msg = document.createElement('p');
    msg.className = 'error-msg';
    msg.id = (input.id || input.name || 'field') + '-error';
    field.appendChild(msg);
  }
  if (message) {
    field.classList.add('has-error');
    msg.textContent = message;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', msg.id);
  } else {
    field.classList.remove('has-error');
    msg.textContent = '';
    input.removeAttribute('aria-invalid');
  }
}

export function clearErrors(form) {
  form.querySelectorAll('.field.has-error').forEach((f) => f.classList.remove('has-error'));
  form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
}

/**
 * Validate a form against a schema: { fieldName: [ruleFn, ruleFn] }
 * Returns { valid, values, errors }
 */
export function validateForm(form, schema) {
  clearErrors(form);
  const values = {};
  const errors = {};
  let firstInvalid = null;

  new FormData(form).forEach((value, key) => {
    if (values[key] !== undefined) {
      values[key] = [].concat(values[key], value);
    } else { values[key] = value; }
  });
  form.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    if (!cb.name) return;
    if (form.querySelectorAll(`input[name="${cb.name}"]`).length === 1) values[cb.name] = cb.checked;
  });

  Object.entries(schema).forEach(([name, checks]) => {
    const input = form.elements[name];
    const el = input instanceof RadioNodeList ? input[0] : input;
    if (!el) return;
    const value = input instanceof RadioNodeList ? (input.value || '') :
      (el.type === 'checkbox' ? el.checked : el.value);
    for (const check of [].concat(checks)) {
      const message = check(value);
      if (message) {
        errors[name] = message;
        setFieldError(el, message);
        if (!firstInvalid) firstInvalid = el;
        break;
      }
    }
  });

  if (firstInvalid) {
    firstInvalid.focus();
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return { valid: Object.keys(errors).length === 0, values, errors };
}

/** Attach blur-time validation for instant feedback. */
export function liveValidate(form, schema) {
  Object.entries(schema).forEach(([name, checks]) => {
    const input = form.elements[name];
    const el = input instanceof RadioNodeList ? input[0] : input;
    if (!el) return;
    el.addEventListener('blur', () => {
      const value = el.type === 'checkbox' ? el.checked : el.value;
      if (value === '' && el.dataset.touched !== '1') return;
      el.dataset.touched = '1';
      for (const check of [].concat(checks)) {
        const msg = check(value);
        if (msg) return setFieldError(el, msg);
      }
      setFieldError(el, '');
    });
    el.addEventListener('input', () => {
      if ((el.closest('.field') || {}).classList?.contains('has-error')) setFieldError(el, '');
    });
  });
}

export const normalizePhone = (v) => {
  const digits = String(v).replace(/[^\d+]/g, '');
  if (digits.startsWith('0')) return '+254' + digits.slice(1);
  if (digits.startsWith('254')) return '+' + digits;
  return digits;
};
