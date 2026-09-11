import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  // Fail loudly at boot rather than at the first query, where the error would
  // surface as an unhelpful network failure inside a component.
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — copy .env.example to .env'
  );
}

/**
 * The only way this app reaches its data.
 *
 * Both values above are public by design: the publishable key grants nothing
 * on its own, because every table is behind RLS and every policy keys off
 * `auth.uid()`. What the user may see is decided in Postgres, not here.
 *
 * `schema: 'grocery'` points PostgREST at our schema rather than `public`.
 */
export const supabase = createClient(url, key, {
  db: { schema: 'grocery' },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // The OAuth callback comes back as a URL fragment; let the client consume
    // it so we never have to parse tokens by hand.
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

/** Start Google sign-in. Returns to wherever the user was heading. */
export const signInWithGoogle = (redirectPath = '/') =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${redirectPath}`,
      queryParams: {
        // Ask for a refresh token and let the user pick an account rather than
        // silently reusing the one Chrome is signed into.
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

export const signOut = () => supabase.auth.signOut();
