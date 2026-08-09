/**
 * auth.js — Authentication abstraction.
 *   Demo mode      → localStorage-only simulation (no passwords stored).
 *   Production mode → Supabase Auth (email + password).
 *
 * Every consumer only uses auth.login/register/logout/resetPassword/etc.
 * — the branching stays here.
 */
import { isDemo } from './config.js';
import { store } from './state.js';
import { KEYS, read, write } from './storage.js';
import { demoUsers } from '../data/demo-data.js';
import { getSupabase } from './supabase-client.js';

const latency = (ms = 700) => new Promise((r) => setTimeout(r, ms));
const ok = (data) => ({ data, error: null });
const fail = (message) => ({ data: null, error: { message } });

/* ------------------------------------------------------------ mappers */
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
  return msg;
}

/* ---------------------------------------------------- demo-only registry */
function registry() {
  const stored = read(KEYS.users, null);
  if (stored) return stored;
  write(KEYS.users, demoUsers);
  return demoUsers;
}

/* ------------------------------------------- hydrate the session on boot */
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
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) await syncProfileFromAuth(sb, session.user);
    sb.auth.onAuthStateChange(async (event, sess) => {
      if (event === 'SIGNED_OUT') { store.clearUser(); return; }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (sess?.user) await syncProfileFromAuth(sb, sess.user);
      }
    });
  } catch (e) {
    console.warn('[auth.hydrate] failed:', e);
  }
  return null;
}

function verifyRedirect() {
  // Absolute URL so Supabase redirects back correctly whether the user is
  // on / or /pages/*.
  const origin = window.location.origin;
  const inPages = window.location.pathname.includes('/pages/');
  const base = inPages
    ? window.location.pathname.replace(/\/pages\/.*$/, '/pages/')
    : '/pages/';
  return origin + base;
}

/* ============================================================== EXPORT */
export const auth = {
  /** Kick off (or return) the Supabase session hydration. Idempotent. */
  hydrate() { if (!hydratePromise) hydratePromise = _doHydrate(); return hydratePromise; },

  /** Await this before any code that depends on store.getUser() being correct. */
  ready() { if (!hydratePromise) hydratePromise = _doHydrate(); return hydratePromise; },

  getCurrentUser() { return store.getUser(); },
  isAuthenticated() { return Boolean(store.getUser()); },

  /* ----------------------------------------------------------- LOGIN */
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
    if (!sb) return fail('Cannot reach the authentication service. Check your internet connection.');
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    if (error) return fail(prettyErr(error));
    const profile = await syncProfileFromAuth(sb, data.user);
    return ok(profile || {
      id: data.user.id, email: data.user.email,
      fullName: data.user.email, accountType: 'buyer'
    });
  },

  /* -------------------------------------------------------- REGISTER */
  async register(payload) {
    const { fullName, email, phone, password, accountType } = payload;
    if (!fullName || !email || !phone || !password || !accountType)
      return fail('All fields are required.');

    if (isDemo()) {
      await latency(900);
      const users = registry();
      if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase()))
        return fail('An account with this email already exists. Try logging in.');
      const user = {
        id: 'usr-' + Date.now(),
        fullName: fullName.trim(), email: email.trim().toLowerCase(),
        phone: phone.trim(), accountType,
        county: payload.county || '', location: payload.location || '',
        verified: false, avatar: '', bio: '',
        joined: new Date().toISOString().slice(0, 10),
        rating: 0, emailVerified: false
      };
      write(KEYS.users, [...users, user]);
      store.setUser(user);
      store.pushNotification({
        type: 'system', title: 'Welcome to SokoShamba',
        body: `Your ${accountType} account was created in demo mode.`
      });
      return ok(user);
    }

    const sb = await getSupabase();
    if (!sb) return fail('Cannot reach the authentication service. Check your internet connection.');
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

    // If email confirmation is disabled, session exists → sign the user in.
    if (data.session) {
      const profile = await syncProfileFromAuth(sb, data.user);
      return ok(profile || {
        id: data.user.id, email: data.user.email,
        fullName: fullName.trim(), accountType
      });
    }
    // Otherwise the user must click the email link first.
    return ok({
      id: data.user?.id, email: email.trim().toLowerCase(),
      fullName: fullName.trim(), accountType, needsVerification: true
    });
  },

  /* ---------------------------------------------------------- LOGOUT */
  async logout() {
    if (isDemo()) { await latency(200); store.clearUser(); return ok(true); }
    const sb = await getSupabase();
    if (sb) await sb.auth.signOut();
    store.clearUser();
    return ok(true);
  },

  /* -------------------------------------------------- RESET PASSWORD */
  async resetPassword(email) {
    if (!email) return fail('Enter the email linked to your account.');
    if (isDemo()) { await latency(800); return ok({ sent: true, demo: true }); }
    const sb = await getSupabase();
    if (!sb) return fail('Cannot reach the authentication service.');
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: verifyRedirect() + 'reset-password.html'
    });
    if (error) return fail(prettyErr(error));
    return ok({ sent: true });
  },

  async updatePassword(newPassword) {
    if (!newPassword || newPassword.length < 8)
      return fail('Choose a password with at least 8 characters.');
    if (isDemo()) { await latency(700); return ok({ updated: true, demo: true }); }
    const sb = await getSupabase();
    if (!sb) return fail('Cannot reach the authentication service.');
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) return fail(prettyErr(error));
    return ok({ updated: true });
  },

  async resendVerification(email) {
    if (isDemo()) { await latency(600); return ok({ sent: true, demo: true }); }
    const sb = await getSupabase();
    if (!sb) return fail('Cannot reach the authentication service.');
    const target = (email || store.getUser()?.email || '').trim().toLowerCase();
    if (!target) return fail('Enter your email address to receive a new link.');
    const { error } = await sb.auth.resend({ type: 'signup', email: target });
    if (error) return fail(prettyErr(error));
    return ok({ sent: true });
  },

  /* ----------------------------- Demo persona quick-sign-in (demo only) */
  async loginAsDemo(accountType) {
    if (!isDemo())
      return fail('Demo personas are only available in demo mode. Register a real account instead.');
    const user = registry().find((u) => u.accountType === accountType);
    if (!user) return fail('Demo account unavailable.');
    await latency(400);
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
