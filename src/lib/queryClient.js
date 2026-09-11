import { QueryClient } from '@tanstack/react-query';

/**
 * A shared list is read far more often than it is written, and it changes
 * under you — someone else is in the shop right now. So the defaults lean on
 * refetching at the moments a person would expect fresh data (coming back to
 * the tab, reconnecting) rather than on a polling interval that would drain a
 * phone sitting in a pocket.
 *
 * Realtime is what actually keeps the list live; these are the fallbacks for
 * when the socket is asleep or was never established.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Long enough that navigating between screens doesn't refetch, short
      // enough that returning to the tab after a minute shows the real list.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        // A row the policies won't return is not a transient failure —
        // retrying it three times just delays the empty state.
        const code = error?.code;
        if (code === 'PGRST301' || code === '42501' || code === '28000') return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: 0,
    },
  },
});

/** Query keys in one place, so an invalidation can never miss by a typo. */
export const keys = {
  list: ['list'],
  trip: (listId) => ['trip', listId],
  items: (tripId) => ['items', tripId],
  members: (listId) => ['members', listId],
  history: (listId) => ['history', listId],
  invitations: (listId) => ['invitations', listId],
};
