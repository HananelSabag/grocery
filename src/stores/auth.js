import { useMemo } from 'react';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

/**
 * Who is signed in.
 *
 * Supabase owns the session — it persists and refreshes it on its own. This
 * store is only a React-shaped view of `onAuthStateChange`, so nothing in the
 * UI has to await a promise to know whether to show the list or the sign-in
 * screen.
 *
 * `ready` is the distinction that matters: `user === null` means signed out,
 * but only once `ready` is true. Before that it means "we haven't looked yet",
 * and rendering the sign-in screen would flash it at an already-signed-in user
 * on every reload.
 */
export const useAuth = create((set) => ({
  user: null,
  ready: false,

  setSession: (session) => set({ user: session?.user ?? null, ready: true }),
}));

/** Wire the store to Supabase. Returns an unsubscribe. */
export const initAuth = () => {
  supabase.auth.getSession().then(({ data }) => {
    useAuth.getState().setSession(data.session);
  });

  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    useAuth.getState().setSession(session);
  });

  return () => sub.subscription.unsubscribe();
};

/**
 * The display name and picture Google gave us, with sane fallbacks.
 *
 * The derivation happens in useMemo, NOT inside the selector. A selector that
 * builds an object returns a new reference on every call, and the store
 * compares snapshots with Object.is — so React re-renders, calls the selector
 * again, gets another new object, and loops until it gives up with "Maximum
 * update depth exceeded". Selecting the one stable value and shaping it
 * afterwards keeps the snapshot identical between renders.
 */
export const useProfile = () => {
  const user = useAuth((s) => s.user);

  return useMemo(() => {
    const meta = user?.user_metadata ?? {};
    return {
      id: user?.id ?? null,
      email: user?.email ?? null,
      name: meta.full_name || meta.name || user?.email?.split('@')[0] || '',
      avatar: meta.avatar_url || meta.picture || null,
    };
  }, [user]);
};
