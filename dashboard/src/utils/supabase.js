import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn(
    '[Croppy] Supabase env vars missing — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to dashboard/.env'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: true,
    storage:            window.localStorage,
    flowType:           'implicit',
  },
});

// Module-level token cache — updated on every auth state change.
// api.js reads this directly instead of calling getSession() which can
// return null during the brief window between tab load and session restore.
export let cachedAccessToken = null;

supabase.auth.onAuthStateChange((event, session) => {
  cachedAccessToken = session?.access_token ?? null;
});

// Seed from storage immediately so the very first API call is covered
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.access_token) cachedAccessToken = session.access_token;
});
