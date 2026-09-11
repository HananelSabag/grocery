import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../stores/auth';

/**
 * The admin panel's data.
 *
 * Every one of these is a SECURITY DEFINER function that re-checks `is_admin()`
 * in its own body, so this hook holds no authority at all — hiding the link in
 * the UI is a convenience, and the database is what actually refuses. A
 * non-admin calling these by hand gets 42501.
 */

/**
 * Whether to show the entrance.
 *
 * Reads the admins table, which is itself readable only by admins: a non-admin
 * gets an empty result rather than a forbidden one, which is the same answer
 * without telling them a list exists.
 */
export function useIsAdmin() {
  const email = useAuth((s) => s.user?.email);

  const query = useQuery({
    queryKey: ['is-admin', email],
    enabled: !!email,
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.from('admins').select('email').limit(1);
      if (error) return false;
      return (data ?? []).length > 0;
    },
  });

  return query.data === true;
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    staleTime: 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_overview');
      if (error) throw error;
      // A table-returning function comes back as an array of one row.
      return Array.isArray(data) ? data[0] : data;
    },
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    staleTime: 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_users');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminLists() {
  return useQuery({
    queryKey: ['admin', 'lists'],
    staleTime: 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_lists');
      if (error) throw error;
      return data ?? [];
    },
  });
}
