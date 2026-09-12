import { registerSW } from 'virtual:pwa-register';

import { useUpdate } from '../stores/update';

/**
 * Keep every device on the build that is actually deployed.
 *
 * The service worker answers from its own cache, which is what makes a cold
 * start instant — and also what made a deploy take two openings to appear: the
 * first painted the cached shell while the new worker installed behind it, and
 * only the opening after that ran the new code. On a phone where the app is
 * never really closed, "the opening after that" can be days. A fix I pushed at
 * noon reached my own phone the next morning.
 *
 * So the worker is asked for a new build on a schedule rather than whenever the
 * browser feels like it, and once one is waiting the page is replaced — quietly
 * if nobody is mid-sentence, and behind one tap if they are.
 */

/** While the app is on screen. A deploy reaches an open tab within a minute. */
const CHECK_EVERY_MS = 60_000;

/**
 * Long enough that the page does not vanish under a tap that just landed, and
 * also the retry beat: while somebody stays busy this keeps asking, so the
 * update applies itself the moment they close the sheet or leave the field.
 */
const SETTLE_MS = 4_000;

/** One recovery reload per tab, so a chunk that is genuinely gone cannot loop. */
const RECOVERED_KEY = 'grocery_chunk_reload';

/**
 * Is this person in the middle of something a reload would throw away?
 *
 * Read off the DOM rather than off app state, so it stays true for screens
 * added later without anyone remembering to wire them up: a caret in a field,
 * or an open sheet (every one of ours is role="dialog").
 */
const isBusy = () => {
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return true;
  return !!document.querySelector('[role="dialog"]');
};

export const initPwa = () => {
  // A deploy renames every hashed chunk, so a lazy route that was not already
  // loaded fails to import afterwards — a blank screen on a tap, on the build
  // we just replaced. One reload lands on the new index.html and fixes it.
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    try {
      if (sessionStorage.getItem(RECOVERED_KEY)) return;
      sessionStorage.setItem(RECOVERED_KEY, '1');
    } catch {
      /* private mode: one reload is still better than a blank screen */
    }
    window.location.reload();
  });

  let apply = null;
  let settling = null;

  const settle = () => {
    if (!apply) return;

    // Off screen there is nothing to disturb, so take it now: they come back
    // to the new build already rendered, having seen nothing happen.
    if (document.visibilityState === 'hidden' || !isBusy()) {
      clearInterval(settling);
      apply();
      return;
    }

    // Busy. Ask, and keep trying — whichever comes first wins.
    useUpdate.getState().ask(apply);
  };

  const updateSW = registerSW({
    immediate: true,

    onNeedRefresh() {
      // `updateSW(true)` tells the waiting worker to take over and reloads the
      // page once it has; calling location.reload() here instead would just
      // paint the old shell again.
      apply = () => updateSW(true);
      clearInterval(settling);
      settling = setInterval(settle, SETTLE_MS);
    },

    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      // The browser decides on its own when to re-check the worker script, and
      // its own schedule is measured in hours. This is the whole point of the
      // file: ask while the app is being used, skip it while it is not, so a
      // backgrounded phone is not woken up for it.
      const check = () => {
        if (document.visibilityState === 'visible' && navigator.onLine !== false) {
          registration.update().catch(() => { /* offline, or the check raced a reload */ });
        }
      };

      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        check();
        // Coming back is the safest moment there is to swap the page, and
        // going away is the second safest.
        settle();
      });
    },
  });
};
