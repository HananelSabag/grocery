import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { keys } from '../lib/queryClient';
import { useAuth } from '../stores/auth';

/**
 * The list this user is working in, and its open shopping run.
 *
 * `ensure_list` is an RPC rather than a select because a brand-new user has
 * nothing to select: it creates the list, the membership and the first trip in
 * one statement, and returns the id. Callers can then treat "signed in" and
 * "has a list" as the same state.
 */
export const useList = () => {
  const user = useAuth((s) => s.user);

  return useQuery({
    queryKey: keys.list,
    enabled: !!user,
    queryFn: async () => {
      const { data: listId, error: rpcError } = await supabase.rpc('ensure_list');
      if (rpcError) throw rpcError;

      const [{ data: list, error: listError }, { data: trip, error: tripError }] = await Promise.all([
        supabase.from('lists').select('id, name, owner_id').eq('id', listId).single(),
        supabase
          .from('trips')
          .select('id, list_id, status, created_at')
          .eq('list_id', listId)
          .eq('status', 'active')
          .single(),
      ]);
      if (listError) throw listError;
      if (tripError) throw tripError;

      return { list, trip };
    },
  });
};

/**
 * The items on a trip, newest sort order first within each aisle.
 *
 * Ordering is done here rather than in the query because the display order is
 * a UI decision (aisle, then unbought before bought) and the server has no
 * opinion about it.
 */
export const useItems = (tripId) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: keys.items(tripId),
    enabled: !!tripId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select(`
          id, trip_id, name, category_key, quantity, unit, note,
          image_url, product_url, sort_order, is_purchased,
          added_by, purchased_by, purchased_at, version, created_at
        `)
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Someone else is in the shop right now. Postgres changes arrive over the
  // socket; the polling defaults in queryClient are only the fallback for when
  // this never connects.
  useEffect(() => {
    if (!tripId) return undefined;

    const channel = supabase
      .channel(`items:${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'grocery', table: 'items', filter: `trip_id=eq.${tripId}` },
        () => queryClient.invalidateQueries({ queryKey: keys.items(tripId) })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tripId, queryClient]);

  return query;
};

/** Everyone on the list, for the avatars against each item. */
export const useMembers = (listId) =>
  useQuery({
    queryKey: keys.members(listId),
    enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_members')
        .select('id, user_id, role, joined_at, profiles:user_id (id, display_name, avatar_url)')
        .eq('list_id', listId)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

/** Finished shops, newest first. */
export const useHistory = (listId) =>
  useQuery({
    queryKey: keys.history(listId),
    enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('id, store_name, total_ils, completed_at, completed_by, profiles:completed_by (display_name, avatar_url)')
        .eq('list_id', listId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const useAddItem = (tripId) => {
  const queryClient = useQueryClient();
  const user = useAuth((s) => s.user);

  return useMutation({
    mutationFn: async (fields) => {
      const { data, error } = await supabase
        .from('items')
        .insert({ ...fields, trip_id: tripId, added_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    // Typing an item and watching it appear a beat later is the one place the
    // network is felt, because it happens mid-sentence in a shop. Show it now.
    onMutate: async (fields) => {
      await queryClient.cancelQueries({ queryKey: keys.items(tripId) });
      const previous = queryClient.getQueryData(keys.items(tripId));
      queryClient.setQueryData(keys.items(tripId), (old = []) => [
        ...old,
        {
          ...fields,
          id: `optimistic-${Date.now()}`,
          trip_id: tripId,
          is_purchased: false,
          added_by: user?.id ?? null,
          version: 1,
          created_at: new Date().toISOString(),
          __optimistic: true,
        },
      ]);
      return { previous };
    },
    onError: (_err, _fields, context) => {
      if (context?.previous) queryClient.setQueryData(keys.items(tripId), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.items(tripId) }),
  });
};

/**
 * Tick an item off, or back on.
 *
 * Kept separate from the general update because it is the one action that
 * happens while walking, one-handed, and it must never fail loudly: the worst
 * case is that someone else ticked the same item a second earlier, which is
 * not a conflict anyone cares about.
 */
export const useToggleItem = (tripId) => {
  const queryClient = useQueryClient();
  const user = useAuth((s) => s.user);

  return useMutation({
    mutationFn: async ({ id, is_purchased }) => {
      const { data, error } = await supabase
        .from('items')
        .update({
          is_purchased,
          purchased_by: is_purchased ? user?.id ?? null : null,
          purchased_at: is_purchased ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    onMutate: async ({ id, is_purchased }) => {
      await queryClient.cancelQueries({ queryKey: keys.items(tripId) });
      const previous = queryClient.getQueryData(keys.items(tripId));
      queryClient.setQueryData(keys.items(tripId), (old = []) =>
        old.map((item) =>
          item.id === id
            ? {
                ...item,
                is_purchased,
                purchased_by: is_purchased ? user?.id ?? null : null,
                purchased_at: is_purchased ? new Date().toISOString() : null,
              }
            : item
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(keys.items(tripId), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.items(tripId) }),
  });
};

/**
 * Edit an item's details.
 *
 * The version the editor read is part of the WHERE clause, so if someone else
 * saved first this updates nothing and we can say so, rather than silently
 * overwriting their change. This is the only collision in a shared list that
 * a person would actually notice.
 */
export const useUpdateItem = (tripId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, version, ...fields }) => {
      const { data, error } = await supabase
        .from('items')
        .update({ ...fields, version: version + 1 })
        .eq('id', id)
        .eq('version', version)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const conflict = new Error('version conflict');
        conflict.code = 'CONFLICT';
        throw conflict;
      }
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.items(tripId) }),
  });
};

export const useDeleteItem = (tripId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: keys.items(tripId) });
      const previous = queryClient.getQueryData(keys.items(tripId));
      queryClient.setQueryData(keys.items(tripId), (old = []) => old.filter((item) => item.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(keys.items(tripId), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.items(tripId) }),
  });
};

/** Close the shop. The RPC opens the next trip and carries unbought items over. */
export const useFinishTrip = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tripId, storeName, total }) => {
      const { data, error } = await supabase.rpc('finish_trip', {
        p_trip_id: tripId,
        p_store_name: storeName || null,
        p_total_ils: total == null || total === '' ? null : Number(total),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // The trip id changed, so every key derived from it is stale.
      queryClient.invalidateQueries();
    },
  });
};
