import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../stores/auth';
import { useActiveList } from '../stores/activeList';
import { useToast } from './useToast';
import { useTranslation } from '../i18n';
import { categoryOrder, DEFAULT_CATEGORY } from '../lib/categories';

/**
 * The whole of the list's state and every action on it.
 *
 * One hook rather than a dozen, because the screen needs them together and
 * every mutation invalidates the same read. This is the same contract the page
 * had when it lived inside SpendWise — same names, same shapes — so the screen
 * ported across without being rewritten. What changed is underneath: an
 * Express API became Supabase, and the authorization that used to sit in
 * middleware now sits in RLS.
 */

const STATE_KEY = 'grocery-state';

/** How long an edit claim holds before anyone else may take the item. */
const CLAIM_SECONDS = 90;

export function useGroceryList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const activeListId = useActiveList((s) => s.listId);
  const setActiveList = useActiveList((s) => s.setListId);

  const query = useQuery({
    queryKey: [STATE_KEY, user?.id, activeListId],
    enabled: !!user,
    queryFn: async () => {
      // `ensure_list` resolves through membership and creates nothing that
      // already exists, so it is safe to call on every load — and it is what
      // makes a brand-new account land on a working list rather than an empty
      // screen with a "create one" button.
      const { data: resolved, error: rpcError } = await supabase.rpc('ensure_list');
      if (rpcError) throw rpcError;

      // A saved choice is only ever a hint: if it names a list this user is
      // not on, the select returns nothing and we fall back to their own
      // rather than erroring.
      let listId = resolved;
      if (activeListId) {
        const { data: chosen } = await supabase
          .from('lists').select('id').eq('id', activeListId).maybeSingle();
        if (chosen) listId = chosen.id;
      }

      const [listResult, tripResult, membersResult] = await Promise.all([
        supabase.from('lists').select('id, name, owner_id').eq('id', listId).single(),
        supabase.from('trips').select('id, list_id, status, created_at')
          .eq('list_id', listId).eq('status', 'active').single(),
        supabase.from('list_members')
          .select('id, user_id, role, joined_at, profiles:user_id ( id, display_name, avatar_url )')
          .eq('list_id', listId).order('joined_at', { ascending: true }),
      ]);

      if (listResult.error) throw listResult.error;
      if (tripResult.error) throw tripResult.error;
      if (membersResult.error) throw membersResult.error;

      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select(`id, trip_id, name, category_key, quantity, unit, note, image_url,
                 product_url, sort_order, is_purchased, added_by, purchased_by,
                 purchased_at, version, editing_user_id, editing_until, created_at,
                 added:added_by ( display_name, avatar_url ),
                 buyer:purchased_by ( display_name, avatar_url )`)
        .eq('trip_id', tripResult.data.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      // Flatten the embeds to the field names the row component reads, so it
      // never has to know these arrived as nested objects.
      const members = (membersResult.data ?? []).map((member) => ({
        ...member,
        first_name: member.profiles?.display_name ?? null,
        username:   member.profiles?.display_name ?? null,
        avatar_url: member.profiles?.avatar_url ?? null,
      }));

      return {
        list: listResult.data,
        trip: tripResult.data,
        members,
        role: members.find((m) => m.user_id === user?.id)?.role ?? 'member',
        items: (items ?? []).map(({ added, buyer, ...item }) => ({
          ...item,
          added_by_name:     added?.display_name ?? null,
          purchased_by_name: buyer?.display_name ?? null,
          purchased_by_avatar: buyer?.avatar_url ?? null,
        })),
      };
    },
  });

  const tripId = query.data?.trip?.id ?? null;
  const listId = query.data?.list?.id ?? null;

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: [STATE_KEY] }),
    [queryClient]
  );

  /**
   * Someone else is in the shop right now, and the point of a shared list is
   * seeing that happen. Postgres changes arrive over the socket; the refetch
   * defaults are only the fallback for when it never connects.
   */
  useEffect(() => {
    if (!tripId) return undefined;
    const channel = supabase
      .channel(`items:${tripId}`)
      .on('postgres_changes',
        { event: '*', schema: 'grocery', table: 'items', filter: `trip_id=eq.${tripId}` },
        refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tripId, refresh]);

  const fail = useCallback((code) => {
    toast.error(t(`errors.${code}`, { fallback: t('errors.generic') }));
    return null;
  }, [toast, t]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const addItem = useCallback(async (payload) => {
    if (!tripId) return null;
    const { data, error } = await supabase
      .from('items')
      .insert({
        name: payload.name,
        category_key: payload.category_key || DEFAULT_CATEGORY,
        quantity: payload.quantity === '' || payload.quantity == null ? null : Number(payload.quantity),
        unit: payload.unit || null,
        note: payload.note || null,
        image_url: payload.image_url || null,
        product_url: payload.product_url || null,
        trip_id: tripId,
        added_by: user?.id ?? null,
      })
      .select()
      .single();

    if (error) return fail('GROCERY_ADD_FAILED');
    refresh();
    return data;
  }, [tripId, user?.id, fail, refresh]);

  /**
   * The version the editor read is part of the WHERE clause, so if someone
   * saved first this matches nothing and we say so rather than silently
   * overwriting them.
   */
  const updateItem = useCallback(async (id, payload, version) => {
    const { data, error } = await supabase
      .from('items')
      .update({
        name: payload.name,
        category_key: payload.category_key || DEFAULT_CATEGORY,
        quantity: payload.quantity === '' || payload.quantity == null ? null : Number(payload.quantity),
        unit: payload.unit || null,
        note: payload.note || null,
        image_url: payload.image_url || null,
        product_url: payload.product_url || null,
        version: (version ?? 1) + 1,
        editing_user_id: null,
        editing_until: null,
      })
      .eq('id', id)
      .eq('version', version ?? 1)
      .select()
      .maybeSingle();

    if (error) return fail('GROCERY_UPDATE_FAILED');
    if (!data) return fail('GROCERY_ITEM_STALE');
    refresh();
    return data;
  }, [fail, refresh]);

  /**
   * Ticking off happens while walking through a shop one-handed, so it is
   * optimistic and never interrupts: two people ticking the same item a second
   * apart is not a conflict anyone cares about.
   */
  const togglePurchased = useCallback(async (item) => {
    const next = !item.is_purchased;
    const key = [STATE_KEY, user?.id, activeListId];

    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData(key);
    queryClient.setQueryData(key, (old) => old && ({
      ...old,
      items: old.items.map((row) => row.id === item.id
        ? { ...row, is_purchased: next, purchased_by: next ? user?.id : null }
        : row),
    }));

    const { error } = await supabase
      .from('items')
      .update({
        is_purchased: next,
        purchased_by: next ? user?.id ?? null : null,
        purchased_at: next ? new Date().toISOString() : null,
      })
      .eq('id', item.id);

    if (error) {
      queryClient.setQueryData(key, previous);
      return fail('GROCERY_UPDATE_FAILED');
    }
    refresh();
    return true;
  }, [queryClient, user?.id, activeListId, fail, refresh]);

  const deleteItem = useCallback(async (id) => {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) return fail('GROCERY_DELETE_FAILED');
    refresh();
    return true;
  }, [fail, refresh]);

  /**
   * A short soft claim, so two phones don't open the same item's editor.
   * A courtesy, not a lock — `version` is what actually prevents a lost
   * update, and an expired claim is simply taken over.
   */
  const claimItem = useCallback(async (id) => {
    const now = new Date();
    const { data, error } = await supabase
      .from('items')
      .update({
        editing_user_id: user?.id ?? null,
        editing_until: new Date(now.getTime() + CLAIM_SECONDS * 1000).toISOString(),
      })
      .eq('id', id)
      .or(`editing_until.is.null,editing_until.lt.${now.toISOString()},editing_user_id.eq.${user?.id}`)
      .select()
      .maybeSingle();

    if (error) return fail('GROCERY_UPDATE_FAILED');
    if (!data) { fail('GROCERY_ITEM_BUSY'); return false; }
    return true;
  }, [user?.id, fail]);

  const releaseItem = useCallback(async (id) => {
    await supabase
      .from('items')
      .update({ editing_user_id: null, editing_until: null })
      .eq('id', id)
      .eq('editing_user_id', user?.id ?? '')
      .then(() => {}, () => {});
  }, [user?.id]);

  const completeTrip = useCallback(async ({ storeName, store_name, total, total_ils } = {}) => {
    if (!tripId) return null;
    const carriedOver = (query.data?.items ?? []).filter((item) => !item.is_purchased).length;

    const { error } = await supabase.rpc('finish_trip', {
      p_trip_id: tripId,
      p_store_name: storeName ?? store_name ?? null,
      p_total_ils: total === '' || total == null ? (total_ils ?? null) : Number(total),
    });

    if (error) return fail('GROCERY_FINISH_FAILED');
    // The trip id changed, so history and everything keyed off it is stale.
    queryClient.invalidateQueries();
    return { carriedOver };
  }, [tripId, query.data?.items, fail, queryClient]);

  const switchList = useCallback(async (id) => {
    setActiveList(id);
    await queryClient.invalidateQueries();
    return true;
  }, [setActiveList, queryClient]);

  // ── Derived view ──────────────────────────────────────────────────────────

  const { sections, purchased, pendingCount, purchasedCount, progress } = useMemo(() => {
    const items = query.data?.items ?? [];
    const bought = items.filter((item) => item.is_purchased);
    const pending = items.filter((item) => !item.is_purchased);

    // Grouped by aisle, in the order a person walks a supermarket — which is
    // the whole reason the categories are ordered rather than alphabetical.
    const byCategory = new Map();
    for (const item of pending) {
      const key = item.category_key || DEFAULT_CATEGORY;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key).push(item);
    }

    return {
      sections: [...byCategory.entries()]
        .map(([key, entries]) => ({ key, items: entries }))
        .sort((a, b) => categoryOrder(a.key) - categoryOrder(b.key)),
      purchased: bought,
      pendingCount: pending.length,
      purchasedCount: bought.length,
      progress: items.length ? Math.round((bought.length / items.length) * 100) : 0,
    };
  }, [query.data?.items]);

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,

    list: query.data?.list ?? null,
    trip: query.data?.trip ?? null,
    members: query.data?.members ?? [],
    role: query.data?.role ?? 'member',
    listId,

    sections,
    purchased,
    pendingCount,
    purchasedCount,
    progress,

    addItem,
    updateItem,
    togglePurchased,
    deleteItem,
    claimItem,
    releaseItem,
    completeTrip,
    switchList,
  };
}
