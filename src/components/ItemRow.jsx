import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

import { CATEGORY_BY_KEY, DEFAULT_CATEGORY } from '../lib/categories';
import { cn, formatQuantity } from '../lib/helpers';
import { useLanguage } from '../i18n';

/**
 * One line of the list.
 *
 * The whole row is the checkbox. In a shop the phone is held one-handed,
 * often in the hand that is also pushing a trolley, so the tap target is the
 * full width rather than a 20px box — and opening the editor is a deliberate
 * second gesture (the chevron) rather than a competing tap on the same pixels.
 */
export default function ItemRow({ item, onToggle, onOpen }) {
  const t = useLanguage((s) => s.t);
  const category = CATEGORY_BY_KEY[item.category_key] ?? CATEGORY_BY_KEY[DEFAULT_CATEGORY];
  const Icon = category.icon;
  const quantity = formatQuantity(item.quantity, item.unit, t);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'group flex items-stretch gap-1 border-b border-gray-100 last:border-0',
        'dark:border-gray-800',
        item.__optimistic && 'opacity-60'
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(item)}
        className="flex min-h-touch flex-1 items-center gap-3 px-4 py-3 text-start transition active:bg-gray-50 dark:active:bg-gray-900"
      >
        {/* The tick box reads as checked-or-not at a glance from arm's length,
            which is the distance a phone sits in a trolley. */}
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition',
            item.is_purchased
              ? 'border-brand-600 bg-brand-600'
              : 'border-gray-300 dark:border-gray-600'
          )}
        >
          {item.is_purchased && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
        </span>

        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', category.chip)}>
          <Icon className={cn('h-4 w-4', category.tint)} />
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-[15px] font-medium',
              item.is_purchased
                ? 'text-gray-400 line-through dark:text-gray-600'
                : 'text-gray-900 dark:text-gray-100'
            )}
          >
            {item.name}
          </span>
          {(quantity || item.note) && (
            <span className="mt-0.5 block truncate text-[13px] text-gray-400 dark:text-gray-500">
              {[quantity, item.note].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-label={t('list.edit')}
        className="flex min-h-touch w-11 shrink-0 items-center justify-center text-gray-300
                   transition active:bg-gray-50 dark:text-gray-600 dark:active:bg-gray-900"
      >
        <span className="text-xl leading-none">⋯</span>
      </button>
    </motion.li>
  );
}
