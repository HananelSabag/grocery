import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Plus, ShoppingBasket, Flag, User } from 'lucide-react';

import {
  useList, useItems, useAddItem, useToggleItem,
  useUpdateItem, useDeleteItem, useFinishTrip,
} from '../hooks/useGroceryList';
import { categoryOrder } from '../lib/categories';
import { cn } from '../lib/helpers';
import { useLanguage } from '../i18n';

import ItemRow from '../components/ItemRow';
import ItemSheet from '../components/ItemSheet';
import FinishSheet from '../components/FinishSheet';
import Splash from '../components/Splash';

export default function ListPage() {
  const t = useLanguage((s) => s.t);

  const { data, isLoading, isError, refetch } = useList();
  const tripId = data?.trip?.id;
  const { data: items = [] } = useItems(tripId);

  const addItem    = useAddItem(tripId);
  const toggleItem = useToggleItem(tripId);
  const updateItem = useUpdateItem(tripId);
  const deleteItem = useDeleteItem(tripId);
  const finishTrip = useFinishTrip();

  const [sheetOpen, setSheetOpen]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [conflict, setConflict]     = useState(false);

  /**
   * Unbought first, then by aisle.
   *
   * Bought items stay on screen rather than disappearing — seeing the cart
   * fill up is the feedback that the shop is going well, and an item ticked
   * by mistake has to be findable to untick.
   */
  const ordered = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.is_purchased !== b.is_purchased) return a.is_purchased ? 1 : -1;
      const aisle = categoryOrder(a.category_key) - categoryOrder(b.category_key);
      if (aisle !== 0) return aisle;
      return (a.sort_order - b.sort_order) || (a.id > b.id ? 1 : -1);
    });
  }, [items]);

  const left = items.filter((item) => !item.is_purchased).length;
  const done = items.length - left;
  const progress = items.length ? (done / items.length) * 100 : 0;

  const openAdd  = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (item) => { setEditing(item); setSheetOpen(true); };

  const save = async (fields) => {
    setConflict(false);
    try {
      if (editing) {
        await updateItem.mutateAsync({ id: editing.id, version: editing.version, ...fields });
      } else {
        await addItem.mutateAsync(fields);
      }
      setSheetOpen(false);
      setEditing(null);
    } catch (error) {
      // A lost update is the only failure worth interrupting for; everything
      // else has already been rolled back optimistically.
      if (error?.code === 'CONFLICT') setConflict(true);
      else setSheetOpen(false);
    }
  };

  const remove = async (item) => {
    setSheetOpen(false);
    setEditing(null);
    await deleteItem.mutateAsync(item.id).catch(() => {});
  };

  const finish = async ({ storeName, total }) => {
    await finishTrip.mutateAsync({ tripId, storeName, total }).catch(() => {});
    setFinishOpen(false);
  };

  if (isLoading) return <Splash />;

  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">{t('common.error')}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="min-h-touch rounded-xl bg-brand-600 px-6 font-semibold text-white"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* One scrolling header row. Nothing here is sticky: a sticky header plus
          a floating button plus the system chrome left too little of a phone
          screen for the list itself, which is the only thing that matters. */}
      <header className="px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900 dark:text-gray-50">
              {data?.list?.name || t('list.title')}
            </h1>
            <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">
              {left > 0 ? t('list.itemsLeft', { count: left }) : items.length ? t('list.allDone') : ''}
            </p>
          </div>

          <Link
            to="/profile"
            aria-label={t('profile.title')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                       bg-white text-gray-500 shadow-sm transition active:scale-95
                       dark:bg-gray-900 dark:text-gray-400"
          >
            <User className="h-5 w-5" />
          </Link>
        </div>

        {items.length > 0 && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </header>

      <main className="flex-1 px-4 pb-40">
        {ordered.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 text-center">
            <ShoppingBasket className="h-12 w-12 text-gray-300 dark:text-gray-700" />
            <p className="mt-4 font-medium text-gray-500 dark:text-gray-400">{t('list.empty')}</p>
            <p className="mt-1 text-[13px] text-gray-400 dark:text-gray-500">{t('list.emptyHint')}</p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-gray-900">
            <AnimatePresence initial={false}>
              {ordered.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={(target) =>
                    toggleItem.mutate({ id: target.id, is_purchased: !target.is_purchased })
                  }
                  onOpen={openEdit}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </main>

      {/* Two actions, both within thumb reach of the bottom edge. Finishing is
          secondary and only appears once something is actually in the cart. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 flex items-end justify-between
                      gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {done > 0 ? (
          <button
            type="button"
            onClick={() => setFinishOpen(true)}
            className="pointer-events-auto flex min-h-touch items-center gap-2 rounded-full
                       bg-white px-5 text-[15px] font-semibold text-gray-700 shadow-lg
                       transition active:scale-95 dark:bg-gray-800 dark:text-gray-200"
          >
            <Flag className="h-4 w-4" />
            {t('trip.finish')}
          </button>
        ) : <span />}

        <button
          type="button"
          onClick={openAdd}
          aria-label={t('list.addItem')}
          className={cn(
            'pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full',
            'bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition active:scale-95'
          )}
        >
          <Plus className="h-7 w-7" />
        </button>
      </div>

      <ItemSheet
        open={sheetOpen}
        item={editing}
        onClose={() => { setSheetOpen(false); setEditing(null); setConflict(false); }}
        onSave={save}
        onDelete={remove}
        saving={addItem.isPending || updateItem.isPending}
      />

      <FinishSheet
        open={finishOpen}
        leftoverCount={left}
        onClose={() => setFinishOpen(false)}
        onConfirm={finish}
        saving={finishTrip.isPending}
      />

      {conflict && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-28 z-[60] rounded-xl bg-gray-900 px-4 py-3
                     text-center text-[13px] text-white shadow-xl dark:bg-gray-100 dark:text-gray-900"
        >
          {t('list.conflict')}
        </div>
      )}
    </div>
  );
}
