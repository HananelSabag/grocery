import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../stores/auth';

/**
 * This account's own profile row.
 *
 * `stores/auth` already exposes the identity Google put in the JWT, which is
 * enough for a name and the Google picture. This reads the row itself, because
 * an uploaded picture lives in the database and nowhere in the token — so the
 * profile screen would otherwise never see it.
 */
export function useMyProfile() {
  const userId = useAuth((s) => s.user?.id);

  return useQuery({
    queryKey: ['my-profile', userId],
    enabled: !!userId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, custom_avatar_url, email')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
