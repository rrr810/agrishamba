/**
 * auth.js — Authentication abstraction.
 *   Demo mode      → localStorage-only simulation (no passwords stored).
 *   Production mode → Supabase Auth (email + password).
 */
import { isDemo } from './config.js';
import { store } from './state.js';
import { KEYS, read, write } from './storage.js';
import { demoUsers } from '../data/demo-data.js';
import { getSupabase } from './supabase-client.js';

const latency = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const ok = (data) => ({ data, error: null });
const fail = (message) => ({ data: null, error: { message } });

/* ------------------------------------------------------------ mappers */
function mapProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name || row.email?.split('@')[0] || 'User',
    email: row.email,
    phone: row.phone || '',
    accountType: row.account_type || 'buyer',
    county: row.county || 'Nairobi',
    location: row.location || '',
    bio: row.bio || '',
    avatar: row.avatar_url || '',
    verified: !!row.verified,
    rating: Number(row.rating || 5),
    joined: (row.created_at || new Date().toISOString()).slice(0, 10)
  };
}

function prettyErr(err) {
  const msg = err?.message || String(err);
  if (/invalid.*credentials|invalid.*password|invalid login/i.test(msg))
    return 'Wrong email or password.';
  if (/already registered|already exists|user.*already/i.test(msg))
    return 'An account with this email already exists. Try logging in.';
  if (/email.*not.*confirmed|email not confirmed/i.test(msg))
    return 'Please verify your email first. Check your inbox for the confirmation link.';
  if (/password.*at least|password should be/i.test(msg))
    return 'Please choose a password with at least 8 characters.';
  if (/rate limit|too many/i.test(msg))
    return 'Too many attempts. Please wait a moment and try again.';
  if (/session.*missing|auth session missing|jwt|token expired|no_authorization/i.test(msg))
    return 'No active reset session found. Please click the link sent to your email.';
  return msg;
}

function registry() {
  const stored = read(KEYS.users, null);
  if (stored) return stored;
  write(KEYS.users, demoUsers);
  return demoUsers;
}

let hydratePromise = null;

async function syncProfileFromAuth(sb, authUser) {
  if (!authUser) return null;
  try {
    const { data, error } = await sb.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
    if (error || !data) return null;
    const mapped = mapProfile(data);
    if (mapped) store.setUser(mapped);
    return mapped;
  } catch (_) {
    return null;
  }
}

async function _doHydrate() {
  if (isDemo()) return null;
  const sb = await getSupabase();
  if (!sb) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      try { await sb.auth.exchangeCodeForSession(code); } catch (_) {}
    }

    if (window.location.hash && window.location.hash.includes('access_token')) {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      } catch (_) {}
    }

    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) await syncProfileFromAuth(sb, session.user);

    sb.auth.onAuthStateChange(async (event, sess) => {
      if (event === 'SIGNED_OUT') { store.clearUser(); return; }
      if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'PASSWORD_RECOVERY'].includes(event)) {
        if (sess?.user) await syncProfileFromAuth(sb, sess.user);
      }
    });
  } catch (e) {
    console.warn('[auth.hydrate] failed:', e);
  }
  return null;
}

function verifyRedirect() {
  const origin = window.location.origin;
  const inPages = window.location.pathname.includes('/pages/');
  const base = inPages
    ? window.location.pathname.replace(/\/pages\/.*$/, '/pages/')
    : '/pages/';
  return origin + base;
}

/* ============================================================== EXPORT */
export const auth = {
  hydrate() { if (!hydratePromise) hydratePromise = _doHydrate(); return hydratePromise; },
  ready() { if (!hydratePromise) hydratePromise = _doHydrate(); return hydratePromise; },

  getCurrentUser() { return store.getUser(); },
  isAuthenticated() { return Boolean(store.getUser()); },

  /* ----------------------------------------------------------- LOGIN */
  async login({ email, password }) {
    if (!email || !password) return fail('Enter your email and password.');
    const cleanEmail = email.trim().toLowerCase();

    if (isDemo()) {
      await latency(200);
      const user = registry().find((u) => u.email.toLowerCase() === cleanEmail);
      if (!user) return fail('No account found with that email. Try a demo persona or register.');
      store.setUser(user);
      return ok(user);
    }

    const sb = await getSupabase();
    if (!sb) return fail('Cannot reach authentication service. Check your internet connection.');

    try {
      const loginPromise = sb.auth.signInWithPassword({
        email: cleanEmail,
        password
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Login request timed out. Please check your connection.')), 8000)
      );

      const res = await Promise.race([loginPromise, timeoutPromise]);
      if (res?.error) return fail(prettyErr(res.error));

      const authUser = res?.data?.user;
      if (!authUser) return fail('Login failed. Please verify your credentials.');

      let profile = null;
      try {
        profile = await syncProfileFromAuth(sb, authUser);
      } catch (_) {}

      const finalUser = profile || {
        id: authUser.id,
        email: authUser.email,
        fullName: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
        accountType: authUser.user_metadata?.account_type || 'buyer',
        county: authUser.user_metadata?.county || 'Nairobi',
        location: authUser.user_metadata?.location || '',
        verified: false,
        rating: 5
      };

      store.setUser(finalUser);
      return ok(finalUser);
    } catch (err) {
      console.warn('[auth.login] error:', err);
      return fail(prettyErr(err));
    }
  },

  /* -------------------------------------------------------- REGISTER */
  async register(payload) {
    const { fullName, email, phone, password, accountType } = payload;
    if (!fullName || !email || !phone || !password || !accountType)
      return fail('All fields are required.');

    if (isDemo()) {
      await latency(400);
      const users = registry();
      if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase()))
        return fail('An account with this email already exists. Try logging in.');
      const user = {
        id: 'usr-' + Date.now(),
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        accountType,
        county: payload.county || '',
        location: payload.location || '',
        verified: false,
        avatar: '',
        bio: '',
        joined: new Date().toISOString().slice(0, 10),
        rating: 0,
        emailVerified: false
      };
      write(KEYS.users, [...users, user]);
      store.setUser(user);
      return ok(user);
    }

    const sb = await getSupabase();
    if (!sb) return fail('Cannot reach authentication service. Check your internet connection.');
    const { data, error } = await sb.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          account_type: accountType,
          county: payload.county || '',
          location: payload.location || ''
        },
        emailRedirectTo: verifyRedirect() + 'verify-email.html'
      }
    });
    if (error) return fail(prettyErr(error));

    if (data.session) {
      const profile = await syncProfileFromAuth(sb, data.user);
      return ok(profile || {
        id: data.user.id,
        email: data.user.email,
        fullName: fullName.trim(),
        accountType
      });
    }
    return ok({
      id: data.user?.id,
      email: email.trim().toLowerCase(),
      fullName: fullName.trim(),
      accountType,
      needsVerification: true
    });
  },

  /* ---------------------------------------------------------- LOGOUT */
  async logout() {
    if (isDemo()) { await latency(100); store.clearUser(); return ok(true); }
    const sb = await getSupabase();
    if (sb) {
      try { await sb.auth.signOut(); } catch (_) {}
    }
    store.clearUser();
    return ok(true);
  },

  /* -------------------------------------------------- RESET PASSWORD */
  async resetPassword(email) {
    if (!email) return fail('Enter the email linked to your account.');
    const targetEmail = email.trim().toLowerCase();

    if (isDemo()) {
      await latency(300);
      return ok({ sent: true, demo: true, resetUrl: `reset-password.html?email=${encodeURIComponent(targetEmail)}` });
    }

    const sb = await getSupabase();
    if (!sb) return ok({ sent: true, fallback: true, resetUrl: `reset-password.html?email=${encodeURIComponent(targetEmail)}` });

    try {
      const { error } = await sb.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: verifyRedirect() + 'reset-password.html'
      });
      if (error) {
        console.warn('[auth.resetPassword] Supabase note:', error.message);
        return ok({ sent: true, fallback: true, resetUrl: `reset-password.html?email=${encodeURIComponent(targetEmail)}` });
      }
      return ok({ sent: true, resetUrl: `reset-password.html?email=${encodeURIComponent(targetEmail)}` });
    } catch (err) {
      return ok({ sent: true, fallback: true, resetUrl: `reset-password.html?email=${encodeURIComponent(targetEmail)}` });
    }
  },

  /* -------------------------------------------------- UPDATE PASSWORD */
  async updatePassword(newPassword) {
    if (!newPassword || newPassword.length < 8)
      return fail('Choose a password with at least 8 characters.');

    if (isDemo()) {
      await latency(300);
      store.clearUser();
      return ok({ updated: true, demo: true });
    }

    const sb = await getSupabase();
    if (!sb) return fail('Authentication service unreachable.');

    try {
      if (window.location.hash && window.location.hash.includes('access_token')) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          try {
            await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          } catch (_) {}
        }
      }

      const { data: { session } } = await sb.auth.getSession();
      if (!session || !session.access_token) {
        return fail('No active reset session found. Please open the reset link sent to your email.');
      }

      const updatePromise = sb.auth.updateUser({ password: newPassword });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Password update timed out. Please try requesting a new link.')), 6000)
      );

      const res = await Promise.race([updatePromise, timeoutPromise]);
      if (res?.error) {
        return fail(prettyErr(res.error));
      }

      try { await sb.auth.signOut(); } catch (_) {}
      store.clearUser();

      return ok({ updated: true, data: res?.data });
    } catch (err) {
      console.warn('[auth.updatePassword] error:', err);
      return fail(prettyErr(err));
    }
  },

  async resendVerification(email) {
    if (isDemo()) { await latency(300); return ok({ sent: true, demo: true }); }
    const sb = await getSupabase();
    if (!sb) return fail('Cannot reach authentication service.');
    const target = (email || store.getUser()?.email || '').trim().toLowerCase();
    if (!target) return fail('Enter your email address to receive a new link.');
    const { error } = await sb.auth.resend({ type: 'signup', email: target });
    if (error) return fail(prettyErr(error));
    return ok({ sent: true });
  },

  async loginAsDemo(accountType) {
    if (!isDemo())
      return fail('Demo personas are only available in demo mode. Register a real account instead.');
    const user = registry().find((u) => u.accountType === accountType);
    if (!user) return fail('Demo account unavailable.');
    await latency(200);
    store.setUser(user);
    return ok(user);
  },

  passwordStrength(pw = '') {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw) && pw.length >= 10) score++;
    const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
    return { score, label: labels[score] };
  }
};

export default auth;