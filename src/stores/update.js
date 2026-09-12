import { create } from 'zustand';

/**
 * Whether a newly deployed build is installed and waiting to take over.
 *
 * In almost every case it takes over by itself and nobody ever reads this —
 * see lib/pwa.js. The flag exists for the one case that cannot be handled
 * quietly: an update that lands while somebody is typing an item or has a
 * sheet open, where replacing the page would throw their work away. Then the
 * app asks instead of acting.
 */
export const useUpdate = create((set) => ({
  /** A build is ready and the quiet path was blocked. */
  blocked: false,

  /** Replaces the page with the new build. Set by lib/pwa.js. */
  apply: () => {},

  ask: (apply) => set({ blocked: true, apply }),
}));
