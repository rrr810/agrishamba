/**
 * supabase-client.js — lazy singleton loader for @supabase/supabase-js
 *
 * Loaded via ESM CDN so there is no build step. In demo mode nothing is
 * fetched — getSupabase() resolves to null.
 */
import { SUPABASE, isDemo } from './config.js';

const CDN_URL = 'https://esm.sh/@supabase/supabase-js@2.45.4';

let clientPromise = null;

/**
 * Returns a promise that resolves to a configured Supabase client,
 * or null when the app is running in demo mode.
 */
export function getSupabase() {
  if (isDemo()) return Promise.resolve(null);
  if (clientPromise) return clientPromise;

  clientPromise = import(CDN_URL)
    .then(({ createClient }) =>
      createClient(SUPABASE.url, SUPABASE.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
          storageKey: 'sokoshamba.supabase.auth'
        },
        global: { headers: { 'x-client-info': 'sokoshamba-web/1.0' } }
      })
    )
    .catch((err) => {
      console.error('[supabase-client] failed to load supabase-js from CDN:', err);
      clientPromise = null; // allow retry
      return null;
    });

  return clientPromise;
}
