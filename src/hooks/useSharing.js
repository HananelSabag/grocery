import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { keys } from '../lib/queryClient';
import { useAuth } from '../stores/auth';

/** Invitations this list's owner has sent and not yet had answered. */
export const useInvitations = (listId) =>
  useQuery({
    queryKey: keys.invitations(listId),
    enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('id, invitee_email, token, status, expires_at, created_at')
        .eq('list_id', listId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

/**
 * Create an invitation and hand back its link.
 *
 * No email is sent: there is no server to send one from, and a link the owner
 * pastes into whatever they already use to talk to this person (WhatsApp, in
 * practice) arrives more reliably than mail would. The email field is stored
 * so the invitee can also find the invitation waiting when they sign in.
 */
export const useCreateInvite = (listId) => {
  const queryClient = useQueryClient();
  const user = useAuth((s) => s.user);

  return useMutation({
    mutationFn: async (email) => {
      const { data, error } = await supabase
        .from('invitations')
        .insert({
          list_id: listId,
          inviter_id: user?.id,
          invitee_email: email?.trim() ? email.trim().toLowerCase() : null,
        })
        .select('token')
        .single();
      if (error) throw error;
      return `${window.location.origin}/invite/${data.token}`;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.invitations(listId) }),
  });
};

export const useRevokeInvite = (listId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('invitations').update({ status: 'revoked' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.invitations(listId) }),
  });
};

/** Remove someone from the list — or, when it is you, leave it. */
export const useRemoveMember = (listId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId) => {
      const { error } = await supabase.from('list_members').delete().eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.members(listId) }),
  });
};

/** Rename the list. Owner-only, enforced by policy rather than by hiding the field. */
export const useRenameList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, name }) => {
      const { error } = await supabase.from('lists').update({ name: name.trim() }).eq('id', listId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.list }),
  });
};
