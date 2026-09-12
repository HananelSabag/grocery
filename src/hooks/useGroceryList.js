import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { resolveAvatar } from '../lib/helpers';
import { useAuth } from '../stores/auth';
import { useActiveList } from '../stores/activeList';
import { useToast } from './useToast';
import { useTranslation } from '../i18n';
import { categoryOrder, DEFAULT_CATEGORY } from '../lib/categories';

/**
 * The whole of the list's state and every action on it.
 *
 * One hook rather than a dozen, because the screen needs all of it together.
 * This is the same contract the page had when it lived inside SpendWise — same
 * names, same shapes — so the screen ported across without being rewritten.
 * What changed is underneath: an Express API became Supabase, and the
 * authorization that used to sit in middleware now sits in RLS.
 */

/**
 * Two queries, not one, because the two halves of this screen change at
 * completely different rates.
 *
 * The context — which list, whose trip, who is on it — moves when somebody
 * joins or a shop is closed: a few times a month. The items move every few
 * seconds while somebody is walking an aisle. They used to share one key, so
 * ticking a single box re-ran the whole chain: an ensure_list RPC, then the
 * list, the trip and the members, then the items. Five round trips, three of
 * them one after another — and the realtime echo of our own write ran the
 * whole thing a second time. Eleven requests and a second and a half to add a
 * cucumber. Split, an item change costs the one request it should.
 */
const CONTEXT_KEY = 'grocery-context';
const ITEMS_KEY = 'grocery-items';

export const groceryKeys = {
  context: (userId, listId) => [CONTEXT_KEY, userId ?? null, listId ?? null],
  items: (tripId) => [ITEMS_KEY, tripId ?? null],
  /** Whoever they belong to — what an outside change should invalidate. */
  allContexts: [CONTEXT_KEY],
  allItems: [ITEMS_KEY],
};

/** How long an edit claim holds before anyone else may take the item. */
const CLAIM_SECONDS = 90;

/** A row that exists on screen but not yet in the database. */
const isPending = (id) => typeof id !== 'number';

export function useGroceryList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const activeListId = useActiveList((s) => s.listId);
  const setActiveList = useActiveList((s) => s.setListId);

  const contextQuery = useQuery({
    queryKey: groceryKeys.context(user?.id, activeListId),
    enabled: !!user,
    // Membership and the open trip change on the order of days, so this does
    // not need re-asking every time the window is focused.
    staleTime: 5 * 60_000,
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
        // join_code comes along because the share sheet needs it the instant it
        // opens, and it is one column on a row already being fetched.
        supabase.from('lists').select('id, name, owner_id, join_code').eq('id', listId).single(),
        supabase.from('trips').select('id, list_id, status, created_at')
          .eq('list_id', listId).eq('status', 'active').single(),
        supabase.from('list_members')
          .select('id, user_id, role, joined_at, profiles:user_id ( id, display_name, avatar_url, custom_avatar_url )')
          .eq('list_id', listId).order('joined_at', { ascending: true }),
      ]);

      if (listResult.error) throw listResult.error;
      if (tripResult.error) throw tripResult.error;
      if (membersResult.error) throw membersResult.error;

      const members = (membersResult.data ?? []).map((member) => ({
        ...member,
        first_name: member.profiles?.display_name ?? null,
        username:   member.profiles?.display_name ?? null,
        avatar_url: resolveAvatar(member.profiles),
      }));

      return {
        list: listResult.data,
        trip: tripResult.data,
        members,
        role: members.find((m) => m.user_id === user?.id)?.role ?? 'member',
      };
    },
  });

  const tripId = contextQuery.data?.trip?.id ?? null;
  const listId = contextQuery.data?.list?.id ?? null;

  const itemsQuery = useQuery({
    queryKey: groceryKeys.items(tripId),
    enabled: !!tripId,
    queryFn: async () => {
      // This used to embed the adder's and the buyer's profile on every row.
      // Nothing has ever displayed either of them — not here and not in the
      // version this screen was ported from — so it was two joins and two
      // extra objects per item, on the one query that runs constantly. Whoever
      // ticked a row is still recorded in purchased_by; the day something
      // wants to show a face, it can ask for one.
      const { data, error } = await supabase
        .from('items')
        .select(`id, trip_id, name, category_key, quantity, unit, note, image_url,
                 product_url, sort_order, is_purchased, added_by, purchased_by,
                 purchased_at, version, editing_user_id, editing_until, created_at`)
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  const itemsKey = useMemo(() => groceryKeys.items(tripId), [tripId]);

  /** One request. This is what changing an item costs now. */
  const refreshItems = useCallback(
    () => queryClient.invalidateQueries({ queryKey: groceryKeys.allItems }),
    [queryClient]
  );

  /**
   * Someone else is in the shop right now, and the point of a shared list is
   * seeing that happen. Postgres changes arrive over the socket; the refetch
   * defaults are only the fallback for when it never connects.
   */
  useEffect(() => {
    if (!tripId) return undefined;

    // Our own writes come back over this socket too, and someone ticking off a
    // shelf fires an event per row. A trailing beat collapses the burst — and
    // the echo of a write we have already applied — into one refetch.
    let timer = null;
    const nudge = () => {
      clearTimeout(timer);
      timer = setTimeout(refreshItems, 300);
    };

    const channel = supabase
      .channel(`items:${tripId}`)
      .on('postgres_changes',
        { event: '*', schema: 'grocery', table: 'items', filter: `trip_id=eq.${tripId}` },
        nudge)
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [tripId, refreshItems]);

  const fail = useCallback((code) => {
    toast.error(t(`errors.${code}`, { fallback: t('errors.generic') }));
    return null;
  }, [toast, t]);

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Optimistic, because this is the one action that happens mid-sentence:
   * somebody types "milk", hits enter and is already typing "bread". Waiting
   * for the round trip put a second and a half between those two words. If the
   * insert fails the row is taken back off the screen and they are told.
   */
  const addItem = useCallback(async (payload) => {
    if (!tripId) return null;

    const row = {
      name: payload.name,
      category_key: payload.category_key || DEFAULT_CATEGORY,
      quantity: payload.quantity === '' || payload.quantity == null ? null : Number(payload.quantity),
      unit: payload.unit || null,
      note: payload.note || null,
      image_url: payload.image_url || null,
      product_url: payload.product_url || null,
      trip_id: tripId,
      added_by: user?.id ?? null,
    };

    const draft = {
      ...row,
      // A string id, so anything that would act on this row can tell it is not
      // saved yet — see isPending.
      id: `draft-${Date.now()}`,
      is_purchased: false,
      purchased_by: null,
      purchased_at: null,
      sort_order: null,
      version: 1,
      editing_user_id: null,
      editing_until: null,
      created_at: new Date().toISOString(),
    };

    queryClient.setQueryData(itemsKey, (old) => [...(old ?? []), draft]);

    const { data, error } = await supabase.from('items').insert(row).select().single();

    if (error) {
      queryClient.setQueryData(itemsKey, (old) =>
        (old ?? []).filter((item) => item.id !== draft.id));
      return fail('GROCERY_ADD_FAILED');
    }

    // The insert handed back the saved row, so there is nothing left to go and
    // fetch: swap it in where the draft was standing.
    queryClient.setQueryData(itemsKey, (old) =>
      (old ?? []).map((item) => (item.id === draft.id ? { ...draft, ...data } : item)));

    return data;
  }, [tripId, user?.id, queryClient, itemsKey, fail]);

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

    // The update returned the saved row; writing it straight into the cache
    // saves the refetch that used to follow.
    queryClient.setQueryData(itemsKey, (old) =>
      (old ?? []).map((item) => (item.id === id ? { ...item, ...data } : item)));

    return data;
  }, [queryClient, itemsKey, fail]);

  /**
   * Ticking off happens while walking through a shop one-handed, so it is
   * optimistic and never interrupts: two people ticking the same item a second
   * apart is not a conflict anyone cares about.
   */
  const togglePurchased = useCallback(async (item) => {
    // A row that has not come back from its insert yet has no id to update.
    // It will be a real row within the round trip; the tap is simply early.
    if (isPending(item.id)) return false;

    const next = !item.is_purchased;

    await queryClient.cancelQueries({ queryKey: itemsKey });
    const previous = queryClient.getQueryData(itemsKey);

    queryClient.setQueryData(itemsKey, (old) => (old ?? []).map((row) => row.id === item.id
      ? {
        ...row,
        is_purchased: next,
        purchased_by: next ? user?.id ?? null : null,
        purchased_at: next ? new Date().toISOString() : null,
      }
      : row));

    const { error } = await supabase
      .from('items')
      .update({
        is_purchased: next,
        purchased_by: next ? user?.id ?? null : null,
        purchased_at: next ? new Date().toISOString() : null,
      })
      .eq('id', item.id);

    if (error) {
      queryClient.setQueryData(itemsKey, previous);
      return fail('GROCERY_UPDATE_FAILED');
    }
    return true;
  }, [queryClient, itemsKey, user?.id, fail]);

  const deleteItem = useCallback(async (id) => {
    if (isPending(id)) return false;

    await queryClient.cancelQueries({ queryKey: itemsKey });
    const previous = queryClient.getQueryData(itemsKey);
    queryClient.setQueryData(itemsKey, (old) => (old ?? []).filter((item) => item.id !== id));

    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) {
      queryClient.setQueryData(itemsKey, previous);
      return fail('GROCERY_DELETE_FAILED');
    }
    return true;
  }, [queryClient, itemsKey, fail]);

  /**
   * A short soft claim, so two phones don't open the same item's editor.
   * A courtesy, not a lock — `version` is what actually prevents a lost
   * update, and an expired claim is simply taken over.
   */
  const claimItem = useCallback(async (id) => {
    // Nobody else can be editing a row that is still on its way to the server.
    if (isPending(id)) return true;

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
    const carriedOver = (itemsQuery.data ?? []).filter((item) => !item.is_purchased).length;

    const { error } = await supabase.rpc('finish_trip', {
      p_trip_id: tripId,
      p_store_name: storeName ?? store_name ?? null,
      p_total_ils: total === '' || total == null ? (total_ils ?? null) : Number(total),
    });

    if (error) return fail('GROCERY_FINISH_FAILED');
    // The trip id changed, so history and everything keyed off it is stale.
    queryClient.invalidateQueries();
    return { carriedOver };
  }, [tripId, itemsQuery.data, fail, queryClient]);

  const switchList = useCallback(async (id) => {
    setActiveList(id);
    await queryClient.invalidateQueries();
    return true;
  }, [setActiveList, queryClient]);

  // ── Derived view ──────────────────────────────────────────────────────────

  const { sections, purchased, pendingCount, purchasedCount, progress } = useMemo(() => {
    // The row shows "so-and-so is editing this" off `editing_by_name`, and
    // nothing ever set it, so the claim has been invisible since the port —
    // two people could open the same item and only find out on save. The name
    // is already on screen in the members list; it does not need fetching.
    const nameOf = new Map((contextQuery.data?.members ?? []).map((m) => [m.user_id, m.first_name]));
    const now = Date.now();

    const items = (itemsQuery.data ?? []).map((item) => {
      const held = item.editing_user_id
        && item.editing_user_id !== user?.id
        && item.editing_until
        && new Date(item.editing_until).getTime() > now;

      return held
        ? { ...item, editing_by_name: nameOf.get(item.editing_user_id) ?? null }
        : item;
    });

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
  }, [itemsQuery.data, contextQuery.data?.members, user?.id]);

  const refetch = useCallback(
    () => Promise.all([contextQuery.refetch(), itemsQuery.refetch()]),
    [contextQuery, itemsQuery]
  );

  return {
    // The items query is disabled until the context names a trip, so the
    // screen is loading while either of them has never resolved.
    isLoading: contextQuery.isLoading || itemsQuery.isLoading,
    isError: contextQuery.isError || itemsQuery.isError,
    refetch,

    list: contextQuery.data?.list ?? null,
    trip: contextQuery.data?.trip ?? null,
    members: contextQuery.data?.members ?? [],
    role: contextQuery.data?.role ?? 'member',
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
