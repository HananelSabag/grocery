import React, { useEffect, useState } from 'react';

import BottomSheet from './BottomSheet';
import { cn } from '../lib/helpers';
import { useLanguage } from '../i18n';

/**
 * Close the shop.
 *
 * Both fields are optional on purpose. The moment this is used is standing at
 * a till or walking to the car, and a required field there means the trip
 * never gets closed at all. What matters is that the list resets; the shop
 * name and total are for the history screen, later.
 */
export default function FinishSheet({ open, leftoverCount, onClose, onConfirm, saving }) {
  const t = useLanguage((s) => s.t);
  const [storeName, setStoreName] = useState('');
  const [total, setTotal] = useState('');

  useEffect(() => {
    if (open) {
      setStoreName('');
      setTotal('');
    }
  }, [open]);

  const field = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 ' +
    'placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 ' +
    'focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('trip.finishTitle')}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-touch flex-1 rounded-xl border border-gray-200 px-4 font-medium
                       text-gray-600 transition active:scale-95 dark:border-gray-700 dark:text-gray-300"
          >
            {t('list.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ storeName, total })}
            disabled={saving}
            className={cn(
              'min-h-touch flex-1 rounded-xl bg-brand-600 px-4 font-semibold text-white',
              'transition active:scale-95',
              saving && 'opacity-50'
            )}
          >
            {t('trip.confirm')}
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-4">
        <input
          value={storeName}
          onChange={(event) => setStoreName(event.target.value)}
          placeholder={t('trip.storeName')}
          className={field}
        />
        <div>
          <input
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            placeholder={t('trip.total')}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            className={field}
          />
          <p className="mt-1.5 px-1 text-[13px] text-gray-400 dark:text-gray-500">
            {t('trip.totalHint')}
          </p>
        </div>

        {/* Say what happens to what is still unticked, before it happens —
            the carry-over is the part people would otherwise be surprised by. */}
        {leftoverCount > 0 && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800
                        dark:bg-amber-500/10 dark:text-amber-300">
            {t('trip.leftoverNote', { count: leftoverCount })}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
