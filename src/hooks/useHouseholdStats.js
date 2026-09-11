import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../stores/auth';

/**
 * What this household has actually done.
 *
 * The profile screen was a settings list, and a settings list is a thin thing
 * to open. These three numbers are the part of it worth looking at: they say
 * the app has been used, and by how many people.
 *
 * Counted with head-only queries — the rows themselves are never fetched, so
 * this stays one cheap round trip however long the history gets.
 */
export function useHouseholdStats(listId) {
  const userId = useAuth((s) => s.user?.id);

  return useQuery({
    queryKey: ['household-stats', listId, userId],
    enabled: !!listId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [shops, members, mine] = await Promise.all([
        supabase.from('trips').select('id', { count: 'exact', head: true })
          .eq('list_id', listId).eq('status', 'completed'),
        supabase.from('list_members').select('id', { count: 'exact', head: true })
          .eq('list_id', listId),
        // Everything this person has ticked off, across every shop on the list.
        supabase.from('items').select('id', { count: 'exact', head: true })
          .eq('purchased_by', userId),
      ]);

      return {
        shops: shops.count ?? 0,
        members: members.count ?? 0,
        itemsBought: mine.count ?? 0,
      };
    },
  });
}
