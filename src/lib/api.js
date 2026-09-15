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
 *
 * Sharing used to live here too — one-time invitation tokens and email
 * invitations, written straight into the invitations table. Sharing is a
 * permanent link now (hooks/useSharing.js), and that code is gone.
 */

const ok   = (data) => ({ success: true, data });
const fail = (code) => ({ success: false, error: { code } });

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
  },
};
