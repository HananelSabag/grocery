import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { resolveAvatar } from '../lib/helpers';
import { api } from '../lib/api';
import { useAuth } from '../stores/auth';
import { useActiveList } from '../stores/activeList';
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
    queryClient.invalidateQueries({ queryKey: ['list'] });
    queryClient.invalidateQueries({ queryKey: ['members'] });
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
    queryClient.removeQueries({ queryKey: ['list'] });
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

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId) => {
      const { error } = await supabase.from('list_members').delete().eq('id', memberId);
      if (error) throw { error: { code: 'GROCERY_OWNER_ONLY' } };
    },
    onSuccess: invalidate,
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('list_members').delete().eq('user_id', userId);
      if (error) throw { error: { code: 'GROCERY_LEAVE_FAILED' } };
    },
    onSuccess: () => { forgetCurrentList(); invalidate(); },
  });

  const disbandMutation = useMutation({
    mutationFn: async (listId) => {
      // Archived, not deleted: the history of what the household bought is
      // worth more than the row, and a disband is easy to regret.
      const { error } = await supabase
        .from('lists')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', listId);
      if (error) throw { error: { code: 'GROCERY_OWNER_ONLY' } };
    },
    onSuccess: () => { forgetCurrentList(); invalidate(); },
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
    leaveList: () => run(leaveMutation),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['list'] }),
  });
}
