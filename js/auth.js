/**
 * auth.js — Authentication abstraction.
 */
import { isDemo } from './config.js';
import { store } from './state.js';
import { KEYS, read, write } from './storage.js';
import { demoUsers } from '../data/demo-data.js';
import { getSupabase } from './supabase-client.js';

const latency = (ms = 500) => new Promise((r) => setTimeout(r, ms));
const ok = (data) => ({ data, error: null });
const fail = (message) => ({ data: null, error: { message } });

function mapProfile(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || '',
    accountType: row.account_type,
    county: row.county || '',
    location: row.location || '',
    bio: row.bio || '',
    avatar: row.avatar_url || '',
    verified: !!row.verified,
    rating: Number(row.rating || 0),
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
    return 'Reset link has expired or is invalid. Please request a new link from the Forgot Password page.';
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
  const { data, error } = await sb.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
  if (error) { console.warn('[auth] profile fetch failed:', error.message); return null; }
  if (!data) { console.warn('[auth] no profile row yet for user', authUser.id); return null; }
  const mapped = mapProfile(data);
  store.setUser(mapped);
  return mapped;
}

async function _doHydrate() {
  if (isDemo()) return null;
  const sb = await getSupabase();
  if (!sb) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      try { await sb.auth.exchangeCodeForSession(code); } catch (err) { console.warn('[auth.hydrate] PKCE note:', err); }
    }

    if (window.location.hash && window.location.hash.includes('access_token')) {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      } catch (err) { console.warn('[auth.hydrate] Hash session note:', err); }
    }

    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) await syncProfileFromAuth(sb, session.user);

    sb.auth.onAuthStateChange(async (event, sess) => {
      if (event === 'SIGNED_OUT') { store.clearUser(); return; }
      if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'PASSWORD_RECOVERY'].includes(event)) {
        if (sess?.user) await syncProfileFromAuth(sb, sess.user);
      }
    });
  } catch (e) { console.warn('[auth.hydrate] failed:', e); }
  return null;
}

function verifyRedirect() {
  const origin = window.location.origin;
  const inPages = window.location.pathname.includes('/pages/');
  const base = inPages ? window.location.pathname.replace(/\/pages\/.*$/, '/pages/') : '/pages/';
  return origin + base;
}

export const auth = {
  hydrate() { if (!hydratePromise) hydratePromise = _doHydrate(); return hydratePromise; },
  ready() { if (!hydratePromise) hydratePromise = _doHydrate(); return hydratePromise; },

  getCurrentUser() { return store.getUser(); },
  isAuthenticated() { return Boolean(store.getUser()); },

  async login({ email, password }) {
    if (!email || !password) return fail('Enter your email and password.');
    if (isDemo()) {
      await latency();
      const user = registry().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!user) return fail('No account found with that email. Try a demo account or register.');
      if (password.length < 6) return fail('Password must be at least 6 characters.');
      store.setUser(user);
      return ok(user);
    }
    const sb = await getSupabase();
    if (!sb) return fail('Cannot reach authentication service. Check your internet connection.');
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) return fail(prettyErr(error));
    const profile = await syncProfileFromAuth(sb, data.user);
    return ok(profile || { id: data.user.id, email: data.user.email, fullName: data.user.email, accountType: 'buyer' });
  },

  async register(payload) {
    const { fullName, email, phone, password, accountType } = payload;
    if (!fullName || !email || !phone || !password || !accountType) return fail('All fields are required.');

    if (isDemo()) {
      await latency(600);
      const users = registry();
      if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase()))
        return fail('An account with this email already exists. Try logging in.');
      const user = {
        id: 'usr-' + Date.now(), fullName: fullName.trim(), email: email.trim().toLowerCase(),
        phone: phone.trim(), accountType, county: payload.county || '', location: payload.location || '',
        verified: false, avatar: '', bio: '', joined: new Date().toISOString().slice(0, 10), rating: 0, emailVerified: false
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
        data: { full_name: fullName.trim(), phone: phone.trim(), account_type: accountType, county: payload.county || '', location: payload.location || '' },
        emailRedirectTo: verifyRedirect() + 'verify-email.html'
      }
    });
    if (error) return fail(prettyErr(error));
    if (data.session) {
      const profile = await syncProfileFromAuth(sb, data.user);
      return ok(profile || { id: data.user.id, email: data.user.email, fullName: fullName.trim(), accountType });
    }
    return ok({ id: data.user?.id, email: email.trim().toLowerCase(), fullName: fullName.trim(), accountType, needsVerification: true });
  },

  async logout() {
    if (isDemo()) { await latency(200); store.clearUser(); return ok(true); }
    const sb = await getSupabase();
    if (sb) await sb.auth.signOut();
    store.clearUser();
    return ok(true);
  },

  async resetPassword(email) {
    if (!email) return fail('Enter the email linked to your account.');
    const targetEmail = email.trim().toLowerCase();

    if (isDemo()) {
      await latency(500);
      return ok({ sent: true, demo: true, resetUrl: `reset-password.html?email=${encodeURIComponent(targetEmail)}` });
    }

    const sb = await getSupabase();
    if (!sb) return ok({ sent: true, fallback: true, resetUrl: `reset-password.html?email=${encodeURIComponent(targetEmail)}` });

    try {
      const { error } = await sb.auth.resetPasswordForEmail(targetEmail, { redirectTo: verifyRedirect() + 'reset-password.html' });
      if (error) return ok({ sent: true, fallback: true, resetUrl: `reset-password.html?email=${encodeURIComponent(targetEmail)}` });
      return ok({ sent: true, resetUrl: `reset-password.html?email=${encodeURIComponent(targetEmail)}` });
    } catch (err) {
      return ok({ sent: true, fallback: true, resetUrl: `reset-password.html?email=${encodeURIComponent(targetEmail)}` });
    }
  },

  async updatePassword(newPassword) {
    if (!newPassword || newPassword.length < 8) return fail('Choose a password with at least 8 characters.');
    if (isDemo()) { await latency(500); return ok({ updated: true, demo: true }); }

    const sb = await getSupabase();
    if (!sb) return fail('Authentication service unreachable.');

    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        if (window.location.hash && window.location.hash.includes('access_token')) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
        }
      }

      const { data: { session: activeSession } } = await sb.auth.getSession();
      if (!activeSession) {
        return fail('No active reset session found. Please open the link sent to your email, or request a new one from Forgot Password.');
      }

      const { data, error } = await sb.auth.updateUser({ password: newPassword });
      if (error) return fail(prettyErr(error));
      return ok({ updated: true, data });
    } catch (err) {
      return fail(prettyErr(err));
    }
  },

  async resendVerification(email) {
    if (isDemo()) { await latency(600); return ok({ sent: true, demo: true }); }
    const sb = await getSupabase();
    if (!sb) return fail('Cannot reach authentication service.');
    const target = (email || store.getUser()?.email || '').trim().toLowerCase();
    if (!target) return fail('Enter your email address to receive a new link.');
    const { error } = await sb.auth.resend({ type: 'signup', email: target });
    if (error) return fail(prettyErr(error));
    return ok({ sent: true });
  },

  async loginAsDemo(accountType) {
    if (!isDemo()) return fail('Demo personas are only available in demo mode. Register a real account instead.');
    const user = registry().find((u) => u.accountType === accountType);
    if (!user) return fail('Demo account unavailable.');
    await latency(300);
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
a
export default auth;