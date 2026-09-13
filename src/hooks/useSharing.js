import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { resolveAvatar } from '../lib/helpers';
import { api } from '../lib/api';
import { useAuth } from '../stores/auth';
import { useActiveList } from '../stores/activeList';
import { groceryKeys } from './useGroceryList';
import { useToast } from './useToast';
import { useTranslation } from '../i18n';

/**
 * Invitations and membership.
 *
 * Same surface as SpendWise's `useGrocerySharing`, so the sheets ported from
 * there call it unchanged — only what is underneath changed, from an Express
 * API to Supabase.
 */

/** Invitations addressed to me, waiting to be answered. */
export function useMyGroceryInvitations() {
  const user = useAuth((s) => s.user);
  const userId = user?.id;
  const email = user?.email;

  const query = useQuery({
    queryKey: ['grocery', 'my-invitations', user?.id],
    enabled: !!email,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('id, token, list_id, inviter_id, created_at, expires_at, lists:list_id ( name ), profiles:inviter_id ( display_name, avatar_url, custom_avatar_url )')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // The policy also returns the owner's own outgoing link invitations,
      // because they are allowed to manage them — but a link you created is
      // not an invitation *to* you, and showing it as one puts a "somebody
      // invited you" banner on your own screen.
      return (data ?? [])
        .filter((row) => row.inviter_id !== userId)
        .map((row) => ({
        ...row,
        list_name: row.lists?.name ?? null,
        inviter_name: row.profiles?.display_name ?? null,
        inviter_avatar: resolveAvatar(row.profiles),
      }));
    },
  });

  return {
    invitations: query.data ?? [],
    count: (query.data ?? []).length,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

/**
 * The lists this user can open.
 *
 * Usually one. A second appears when someone shares theirs.
 */
export function useGroceryLists() {
  const userId = useAuth((s) => s.user?.id);

  const query = useQuery({
    queryKey: ['grocery', 'lists', userId],
    enabled: !!userId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async () => {
      // The switcher renders whose list it is and how much is on it, so all of
      // that is fetched here. It used to return only id/name/owner_id/role,
      // and the component reads `isOwn`, `ownerName`, `openItems` and
      // `memberCount` — every one of them undefined, which is why every row
      // read "הרשימה של undefined" and claimed to be empty.
      // `.eq('user_id')` is the point of this query, not a belt-and-braces
      // extra. Without it this asked for every membership row in the database
      // and left RLS to narrow the answer — which it did, until an admin read
      // policy widened SELECT and the switcher started showing the owner every
      // household that had ever signed up. A query for "my lists" says so.
      const { data, error } = await supabase
        .from('list_members')
        .select(`role, joined_at,
                 lists:list_id (
                   id, name, owner_id, archived_at,
                   owner:owner_id ( display_name ),
                   members:list_members ( id ),
                   trips ( id, status, items ( id, is_purchased ) )
                 )`)
        .eq('user_id', userId)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      return (data ?? [])
        .filter((row) => row.lists && !row.lists.archived_at)
        .map((row) => {
          const list = row.lists;
          const active = (list.trips ?? []).find((t) => t.status === 'active');
          return {
            id: list.id,
            name: list.name,
            owner_id: list.owner_id,
            role: row.role,
            isOwn: list.owner_id === userId,
            ownerName: list.owner?.display_name || '',
            memberCount: (list.members ?? []).length,
            openItems: (active?.items ?? []).filter((i) => !i.is_purchased).length,
          };
        });
    },
  });

  const lists = query.data ?? [];

  return {
    lists,
    // One list is the normal case and needs no switcher at all.
    hasMultiple: lists.length > 1,
    isLoading: query.isLoading,
  };
}

export function useGrocerySharing() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const userId = useAuth((s) => s.user?.id);
  const setActiveList = useActiveList((s) => s.setListId);
  const { t } = useTranslation();

  const invalidate = useCallback(() => {
    // `['list']` and `['members']` used to be named here, and neither is a key
    // any query is stored under — so joining a list changed nothing on screen
    // until something else happened to refetch.
    queryClient.invalidateQueries({ queryKey: groceryKeys.allContexts });
    queryClient.invalidateQueries({ queryKey: groceryKeys.allItems });
    queryClient.invalidateQueries({ queryKey: ['grocery', 'my-invitations', userId] });
    // Accepting, leaving and disbanding change WHICH lists exist for this
    // user, not just what is on one of them.
    queryClient.invalidateQueries({ queryKey: ['grocery', 'lists', userId] });
  }, [queryClient, userId]);

  const reportFailure = useCallback((result) => {
    const code = result?.error?.code;
    toast.error(t(`errors.${code}`, { fallback: t('errors.generic') }));
    return null;
  }, [toast, t]);

  /**
   * Anything that changes which list you are on has to stop the client naming
   * the old one, or the next read would ask for a list you just left.
   */
  const forgetCurrentList = useCallback(() => {
    setActiveList(null);
    queryClient.removeQueries({ queryKey: groceryKeys.allContexts });
    queryClient.removeQueries({ queryKey: groceryKeys.allItems });
    queryClient.removeQueries({ queryKey: ['grocery', 'history', userId] });
  }, [queryClient, setActiveList, userId]);

  const inviteMutation = useMutation({
    mutationFn: async (email) => {
      const result = await api.grocery.invite(email);
      if (!result.success) throw result;
      return result.data;
    },
    onSuccess: invalidate,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ token, action }) => {
      if (action === 'accept') {
        const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
        if (error) throw { error: { code: 'GROCERY_INVITE_NOT_FOUND' } };
        return { listId: data };
      }
      const { error } = await supabase
        .from('invitations')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('token', token);
      if (error) throw { error: { code: 'GROCERY_INVITE_NOT_FOUND' } };
      return {};
    },
    onSuccess: (data, variables) => {
      // Accepting lands you on the list you just joined.
      if (variables?.action === 'accept') {
        forgetCurrentList();
        if (data?.listId) setActiveList(data.listId);
      }
      invalidate();
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (email) => {
      const result = await api.grocery.cancelInvite(email);
      if (!result.success) throw result;
      return result.data;
    },
    onSuccess: invalidate,
  });

  /** `memberId` is the list_members row id, not the user's. */
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId) => {
      const { error } = await supabase.from('list_members').delete().eq('id', memberId);
      if (error) throw { error: { code: 'GROCERY_OWNER_ONLY' } };
    },
    onSuccess: invalidate,
  });

  /**
   * Leave one list. The `list_id` is not optional: without it this deleted
   * every membership row belonging to the user — including the owner row of
   * their own list, which would have locked them out of it for good, since
   * reading a list requires being on it.
   */
  const leaveMutation = useMutation({
    mutationFn: async (listId) => {
      if (!listId) throw { error: { code: 'GROCERY_LEAVE_FAILED' } };
      const { error } = await supabase
        .from('list_members').delete().eq('user_id', userId).eq('list_id', listId);
      if (error) throw { error: { code: 'GROCERY_LEAVE_FAILED' } };
    },
    onSuccess: () => { forgetCurrentList(); invalidate(); },
  });

  /**
   * Stop sharing: everyone but the owner is removed and the code changes, so
   * nobody walks back in with the one they already have. The owner stays on the
   * list, with its history.
   *
   * This used to archive the list — hiding it from its owner as well, the
   * opposite of what its own confirmation promised — and then moved the owner
   * off to some other list.
   */
  const disbandMutation = useMutation({
    mutationFn: async (listId) => {
      const { error } = await supabase.rpc('stop_sharing', { p_list_id: listId });
      if (error) throw { error: { code: 'GROCERY_OWNER_ONLY' } };
    },
    onSuccess: invalidate,
  });

  const run = useCallback(async (mutation, arg) => {
    try {
      return await mutation.mutateAsync(arg);
    } catch (thrown) {
      return reportFailure(thrown?.error ? thrown : { error: {} });
    }
  }, [reportFailure]);

  return {
    invite: (email) => run(inviteMutation, email),
    respond: (token, action) => run(respondMutation, { token, action }),
    cancelInvite: (email) => run(cancelInviteMutation, email),
    removeMember: (memberId) => run(removeMemberMutation, memberId),
    leaveList: (listId) => run(leaveMutation, listId),
    disband: (listId) => run(disbandMutation, listId),

    isInviting: inviteMutation.isPending,
    isResponding: respondMutation.isPending,
    isDisbanding: disbandMutation.isPending,
  };
}

/**
 * Set or clear a list's nickname. Owner-only, enforced by policy rather than
 * by hiding the field.
 *
 * An emptied field stores NULL, not an empty string: unnamed is a real state
 * that the switcher reads to decide between showing the nickname and showing
 * whose list it is, and `''` would satisfy neither.
 */
export function useRenameList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, name }) => {
      const trimmed = (name ?? '').trim();
      const { error } = await supabase
        .from('lists').update({ name: trimmed || null }).eq('id', listId);
      if (error) throw error;
    },
    onSuccess: () => {
      // The name shows in the header and in the switcher, which are two
      // different queries.
      queryClient.invalidateQueries({ queryKey: groceryKeys.allContexts });
      queryClient.invalidateQueries({ queryKey: ['grocery', 'lists'] });
    },
  });
}

/* ── Joining by code ───────────────────────────────────────────────────────
 *
 * The list carries a standing code rather than handing out one-time links.
 * See supabase/migrations/0008_join_code.sql for why; the short version is
 * that a link which is spent the first time it works cannot be sent to a
 * family chat, and nobody could answer how long one lasted or how to change
 * it.
 */

/**
 * Turn a code into enough to recognise the household before joining it.
 * Returns null when there is no such list.
 *
 * A signed-out caller cannot reach this at all: the function is not granted
 * to `anon`, so it fails at the database rather than in a check here.
 */
export const lookupListByCode = async (code) => {
  const { data, error } = await supabase.rpc('lookup_list_by_code', { p_code: code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
};

/** Join, and land on the list you just joined rather than on your own. */
export function useJoinList() {
  const queryClient = useQueryClient();
  const setActiveList = useActiveList((s) => s.setListId);

  return useMutation({
    mutationFn: async (code) => {
      const { data, error } = await supabase.rpc('join_by_code', { p_code: code });
      if (error) throw error;
      return data;
    },
    onSuccess: (listId) => {
      // Without this the next read calls ensure_list, which answers with the
      // list you joined *first* — your own — and the list you were invited to
      // never appears. This is what made sharing look broken.
      if (listId) setActiveList(listId);
      queryClient.invalidateQueries();
    },
  });
}

/** Replace the code. The only revocation there is, and owner-only. */
export function useRotateJoinCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listId) => {
      const { data, error } = await supabase.rpc('rotate_join_code', { p_list_id: listId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groceryKeys.allContexts }),
  });
}

/* ── More than one list ───────────────────────────────────────────────────── */

/**
 * Make another list — for a trip, a party, anything kept apart from the weekly
 * shop — and land on it. The caller names it, falling back to a numbered
 * default in the user's own language; the database refuses an unnamed one.
 */
export function useCreateList() {
  const queryClient = useQueryClient();
  const setActiveList = useActiveList((s) => s.setListId);

  return useMutation({
    mutationFn: async (name) => {
      const { data, error } = await supabase.rpc('create_list', { p_name: name });
      if (error) throw error;
      return data;
    },
    onSuccess: (listId) => {
      if (listId) setActiveList(listId);
      queryClient.invalidateQueries({ queryKey: ['grocery', 'lists'] });
    },
  });
}

/**
 * Remove a list. Archived rather than deleted, like everything else here: what a
 * household bought is worth more than the row. If it was the list on screen,
 * the page moves to another one.
 */
export function useArchiveList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listId) => {
      const { error } = await supabase
        .from('lists').update({ archived_at: new Date().toISOString() }).eq('id', listId);
      if (error) throw error;
    },
    onSuccess: (_, listId) => {
      const { listId: chosen, setListId } = useActiveList.getState();
      if (String(chosen) === String(listId)) setListId(null);
      // Refetching the context is what moves the page: ensure_list skips an
      // archived list, so it answers with the next one this user is on.
      queryClient.invalidateQueries({ queryKey: groceryKeys.allContexts });
      queryClient.invalidateQueries({ queryKey: groceryKeys.allItems });
      queryClient.invalidateQueries({ queryKey: ['grocery', 'lists'] });
    },
  });
}
