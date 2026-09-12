import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../stores/auth';
import { useToast } from './useToast';
import { groceryKeys } from './useGroceryList';
import { useTranslation } from '../i18n';
import { compressImage } from '../lib/imageCompression';

const BUCKET = 'grocery-avatars';

/** Rendered at 56px at the largest; anything beyond this is bytes nobody sees. */
const AVATAR_PRESET = { maxDimension: 512, maxBytes: 200 * 1024, quality: 0.85 };

/**
 * Replace or clear your own profile picture.
 *
 * The uploaded file goes in its own column, so clearing it falls back to the
 * Google picture rather than to nothing — see `resolveAvatar`.
 *
 * Replacing deletes the previous object. SpendWise's profiles bucket collected
 * 40 orphans over a year because that delete failed silently, so the result is
 * checked here and a failure is reported rather than shrugged at.
 */
export function useAvatarUpload() {
  const queryClient = useQueryClient();
  const user = useAuth((s) => s.user);
  const toast = useToast();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  // A new face has to reach the members list and every row this person added
  // or ticked off, which are two separate queries.
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: groceryKeys.allContexts });
    queryClient.invalidateQueries({ queryKey: groceryKeys.allItems });
    queryClient.invalidateQueries({ queryKey: ['my-profile'] });
  }, [queryClient]);

  /** Remove whatever object a stored public URL points at. */
  const removeStored = useCallback(async (url) => {
    if (!url || !url.includes(`/${BUCKET}/`)) return;
    const path = url.split(`/${BUCKET}/`)[1]?.split('?')[0];
    if (!path) return;
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) {
      // Not fatal — the new picture is already in place. But say so, because
      // a silent failure here is exactly how a bucket fills with orphans.
      console.warn('[avatar] previous file left behind:', path, error.message);
    }
  }, []);

  const upload = useCallback(async (file) => {
    if (!file || !user?.id) return false;
    setBusy(true);
    try {
      // A phone camera file is 10-20MB and none of it survives a 56px circle.
      const compressed = await compressImage(file, AVATAR_PRESET);

      const { data: before } = await supabase
        .from('profiles').select('custom_avatar_url').eq('id', user.id).maybeSingle();

      const extension = (compressed.type?.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET).upload(path, compressed, { contentType: compressed.type, upsert: false });
      if (uploadError) {
        toast.error(t('errors.GROCERY_IMAGE_UPLOAD_FAILED', { fallback: t('errors.generic') }));
        return false;
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const { error: saveError } = await supabase
        .from('profiles').update({ custom_avatar_url: pub.publicUrl }).eq('id', user.id);
      if (saveError) {
        // The row still points at the old picture, so the new object is
        // already an orphan. Take it back out rather than leave it.
        await supabase.storage.from(BUCKET).remove([path]);
        toast.error(t('errors.generic'));
        return false;
      }

      await removeStored(before?.custom_avatar_url);
      refresh();
      toast.success(t('profile.pictureSaved'));
      return true;
    } finally {
      setBusy(false);
    }
  }, [user?.id, toast, t, removeStored, refresh]);

  /** Back to the Google picture, or to a letter if there is none. */
  const clear = useCallback(async () => {
    if (!user?.id) return false;
    setBusy(true);
    try {
      const { data: before } = await supabase
        .from('profiles').select('custom_avatar_url').eq('id', user.id).maybeSingle();

      const { error } = await supabase
        .from('profiles').update({ custom_avatar_url: null }).eq('id', user.id);
      if (error) {
        toast.error(t('errors.generic'));
        return false;
      }

      await removeStored(before?.custom_avatar_url);
      refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }, [user?.id, toast, t, removeStored, refresh]);

  return { upload, clear, busy };
}
