import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../stores/auth';
import { useToast } from './useToast';
import { useTranslation } from '../i18n';

/**
 * Completed shopping trips.
 *
 * Read-only by construction: a finished trip's items never change, so this
 * only reads — plus the one action that attaches something to a finished
 * trip, a receipt.
 *
 * SpendWise also had "push this trip into SpendWise as an expense". That is
 * gone with the split, and the data says nobody minds: across every trip ever
 * finished, it was used zero times.
 */

const listIdFor = async () => {
  const { data, error } = await supabase.rpc('ensure_list');
  return error ? null : data;
};

export function useGroceryHistory({ enabled = true, limit = 20 } = {}) {
  const userId = useAuth((s) => s.user?.id);

  const query = useQuery({
    queryKey: ['grocery', 'history', userId, limit],
    enabled: enabled && !!userId,
    staleTime: 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const listId = await listIdFor();
      if (!listId) return { trips: [], total: 0 };

      const { data, error, count } = await supabase
        .from('trips')
        .select(
          `id, store_name, total_ils, receipt_path, completed_at, completed_by,
           profiles:completed_by ( display_name, avatar_url ),
           items ( id )`,
          { count: 'exact' }
        )
        .eq('list_id', listId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // The panel wants a count, not the rows; flatten the embed so it never
      // has to know an item array was fetched to produce it.
      const trips = (data ?? []).map(({ items, profiles, ...trip }) => ({
        ...trip,
        item_count: items?.length ?? 0,
        completed_by_first_name: profiles?.display_name ?? null,
        completed_by_avatar: profiles?.avatar_url ?? null,
        has_receipt: !!trip.receipt_path,
      }));

      return { trips, total: count ?? trips.length };
    },
  });

  return {
    trips: query.data?.trips ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useGroceryTripDetail(tripId) {
  const query = useQuery({
    queryKey: ['grocery', 'trip', tripId],
    enabled: !!tripId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const [{ data: trip, error: tripError }, { data: items, error: itemsError }] = await Promise.all([
        supabase
          .from('trips')
          .select('id, store_name, total_ils, receipt_path, completed_at, completed_by, profiles:completed_by ( display_name, avatar_url )')
          .eq('id', tripId)
          .single(),
        supabase
          .from('items')
          .select('id, name, category_key, quantity, unit, note, image_url, is_purchased, purchased_by')
          .eq('trip_id', tripId)
          .order('category_key', { ascending: true }),
      ]);

      if (tripError) throw tripError;
      if (itemsError) throw itemsError;
      return { trip, items: items ?? [] };
    },
  });

  return {
    trip: query.data?.trip ?? null,
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
  };
}

/** Attach a receipt to a finished trip, and read it back. */
export function useGroceryTripActions() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const userId = useAuth((s) => s.user?.id);
  const { t } = useTranslation();
  const [busyTripId, setBusyTripId] = useState(null);

  const invalidate = useCallback((tripId) => {
    queryClient.invalidateQueries({ queryKey: ['grocery', 'history', userId] });
    if (tripId) queryClient.invalidateQueries({ queryKey: ['grocery', 'trip', tripId] });
  }, [queryClient, userId]);

  const uploadReceipt = useCallback(async (tripId, file) => {
    setBusyTripId(tripId);
    try {
      const listId = await listIdFor();
      if (!listId) return false;

      // The list id leads the path because that is what the storage policy
      // checks — a receipt belongs to the household, not to whoever happened
      // to be holding the phone at the till.
      const extension = (file.type?.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const path = `${listId}/${tripId}-${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('grocery-receipts')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        toast.error(t('errors.GROCERY_RECEIPT_UPLOAD', { fallback: t('errors.generic') }));
        return false;
      }

      const { error: saveError } = await supabase
        .from('trips')
        .update({ receipt_path: path, receipt_mime: file.type })
        .eq('id', tripId);

      if (saveError) {
        toast.error(t('errors.generic'));
        return false;
      }

      invalidate(tripId);
      toast.success(t('history.receiptSaved'));
      return true;
    } finally {
      setBusyTripId(null);
    }
  }, [invalidate, t, toast]);

  /** Receipts live in a private bucket — this mints a short-lived signed URL. */
  const openReceipt = useCallback(async (tripId) => {
    const { data: trip, error } = await supabase
      .from('trips')
      .select('receipt_path')
      .eq('id', tripId)
      .single();

    if (error || !trip?.receipt_path) {
      toast.error(t('errors.GROCERY_RECEIPT_MISSING', { fallback: t('errors.generic') }));
      return null;
    }

    const { data, error: signError } = await supabase.storage
      .from('grocery-receipts')
      .createSignedUrl(trip.receipt_path, 60);

    if (signError) {
      toast.error(t('errors.generic'));
      return null;
    }
    return data.signedUrl;
  }, [t, toast]);

  return { uploadReceipt, openReceipt, busyTripId };
}
