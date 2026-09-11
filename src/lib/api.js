import { supabase } from './supabase';

/**
 * The shape SpendWise's grocery components call, backed by Supabase.
 *
 * Those components were written against an Express API that returned
 * `{ success, data, error }`, and they handle that envelope carefully —
 * distinguishing a failure code from a generic one, falling back to manual
 * entry when a fetch fails. Rewriting them to throw instead would mean
 * rewriting all of that too, so the envelope is kept and this module is what
 * produces it.
 */

const ok   = (data) => ({ success: true, data });
const fail = (code) => ({ success: false, error: { code } });

/** The caller's list. Every share operation is scoped to it. */
const currentListId = async () => {
  const { data, error } = await supabase.rpc('ensure_list');
  return error ? null : data;
};

export const api = {
  grocery: {
    /**
     * Store an item photo and hand back a public URL.
     *
     * Each user writes inside a folder named for their own id, which is what
     * the storage policy checks — so one account cannot overwrite another's
     * uploads even though the bucket is world-readable.
     */
    uploadItemImage: async (file) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) return fail('GROCERY_NOT_AUTHENTICATED');

      const extension = (file.type?.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const path = `${userId}/${crypto.randomUUID()}.${extension}`;

      const { error } = await supabase.storage
        .from('grocery-items')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) return fail('GROCERY_IMAGE_UPLOAD_FAILED');

      const { data } = supabase.storage.from('grocery-items').getPublicUrl(path);
      return ok({ imageUrl: data.publicUrl });
    },

    /**
     * Read a title and picture off a product page.
     *
     * Not supported here, and it cannot be: a browser cannot fetch a shop's
     * page cross-origin, and this app has no server to do it from. Reporting
     * the failure is the honest move — the editor already handles it by
     * telling the user to fill the fields in themselves, which is exactly
     * what should happen.
     *
     * Restoring it would mean a Supabase Edge Function doing the fetch.
     */
    scrapeUrl: async () => fail('GROCERY_SCRAPE_UNSUPPORTED'),

    // ─── Sharing ────────────────────────────────────────────────────────────
    // One recipient-less link per list, created on demand. An invitation row
    // with no email is exactly that: a token anybody holding the link can
    // redeem, until it is revoked or expires.

    getShareLink: async () => {
      const listId = await currentListId();
      if (!listId) return fail('GROCERY_NO_LIST');

      const { data, error } = await supabase
        .from('invitations')
        .select('token')
        .eq('list_id', listId)
        .eq('status', 'pending')
        .is('invitee_email', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return fail('GROCERY_LINK_READ');
      return ok({ inviteUrl: data ? inviteUrl(data.token) : null });
    },

    createShareLink: async () => {
      const listId = await currentListId();
      if (!listId) return fail('GROCERY_NO_LIST');

      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('invitations')
        .insert({ list_id: listId, inviter_id: auth?.user?.id, invitee_email: null })
        .select('token')
        .single();

      // The insert policy is owner-only, so this is also where a member who
      // somehow reached the button is turned away.
      if (error) return fail('GROCERY_OWNER_ONLY');
      return ok({ inviteUrl: inviteUrl(data.token) });
    },

    revokeShareLink: async () => {
      const listId = await currentListId();
      if (!listId) return fail('GROCERY_NO_LIST');

      const { error } = await supabase
        .from('invitations')
        .update({ status: 'revoked', responded_at: new Date().toISOString() })
        .eq('list_id', listId)
        .eq('status', 'pending')
        .is('invitee_email', null);

      if (error) return fail('GROCERY_OWNER_ONLY');
      return ok({});
    },

    invite: async (email) => {
      const listId = await currentListId();
      if (!listId) return fail('GROCERY_NO_LIST');

      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('invitations')
        .insert({
          list_id: listId,
          inviter_id: auth?.user?.id,
          invitee_email: email.trim().toLowerCase(),
        })
        .select('token')
        .single();

      if (error) return fail('GROCERY_OWNER_ONLY');
      return ok({ inviteUrl: inviteUrl(data.token) });
    },

    cancelInvite: async (email) => {
      const listId = await currentListId();
      if (!listId) return fail('GROCERY_NO_LIST');

      const { error } = await supabase
        .from('invitations')
        .update({ status: 'revoked', responded_at: new Date().toISOString() })
        .eq('list_id', listId)
        .eq('status', 'pending')
        .eq('invitee_email', email.trim().toLowerCase());

      if (error) return fail('GROCERY_OWNER_ONLY');
      return ok({});
    },
  },
};

function inviteUrl(token) {
  return `${window.location.origin}/invite/${token}`;
}
