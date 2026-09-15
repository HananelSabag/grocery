/**
 * Where to go once Google sends somebody back.
 *
 * Signing in leaves the app for Google and comes back to the URL passed as
 * `redirectTo` — which is the site root, deliberately: a deep path that is not
 * on the Supabase project's redirect allowlist is silently swapped for the
 * project's Site URL, and this project is shared with another app. So the round
 * trip always ends on "/".
 *
 * For most screens that costs a tap. For an invitation it cost the invitation: a
 * person who followed /join/<code>, signed in for the first time, and was put
 * down on "/" had no way back to the link. They landed on the empty list sign-up
 * had just made for them, and to them the link had done nothing.
 *
 * So the destination is written down before leaving and read back after. That
 * works whatever URL the round trip ends on.
 */

const KEY = 'grocery_return_to';

/** Long enough for a slow Google account picker; short enough not to surprise anyone later. */
const MAX_AGE_MS = 30 * 60_000;

export const rememberReturnTo = (path) => {
  if (!path || path === '/') return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    /* private mode — the person lands on the list instead, as before */
  }
};

/**
 * The remembered destination, once: reading it forgets it. Only a path on this
 * site, and only a recent one.
 */
export const takeReturnTo = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);

    const { path, at } = JSON.parse(raw);
    const fresh = Date.now() - Number(at) < MAX_AGE_MS;
    const local = typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
    return fresh && local ? path : null;
  } catch {
    return null;
  }
};
