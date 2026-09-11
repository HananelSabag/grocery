import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

import BottomSheet from './BottomSheet';
import { GROCERY_CATEGORIES, GROCERY_UNITS, DEFAULT_CATEGORY } from '../lib/categories';
import { guessCategory } from '../lib/guessCategory';
import { cn } from '../lib/helpers';
import { useLanguage } from '../i18n';

const EMPTY = { name: '', category_key: DEFAULT_CATEGORY, quantity: '', unit: '', note: '' };

/**
 * Add an item, or edit one.
 *
 * One sheet for both, because they are the same five fields and a separate
 * "edit" screen would only differ by its title. Adding is the hot path, so the
 * name field is focused on open and Enter saves: the common case is one field
 * and one key.
 *
 * The aisle is guessed from the name as it is typed, and stops guessing the
 * moment the user picks one themselves — a guess that keeps overriding a
 * deliberate choice is worse than no guess.
 */
export default function ItemSheet({ open, item, onClose, onSave, onDelete, saving }) {
  const t = useLanguage((s) => s.t);
  const [fields, setFields] = useState(EMPTY);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const nameRef = useRef(null);

  const isEdit = !!item;

  useEffect(() => {
    if (!open) return;
    setFields(
      item
        ? {
            name: item.name ?? '',
            category_key: item.category_key ?? DEFAULT_CATEGORY,
            quantity: item.quantity ?? '',
            unit: item.unit ?? '',
            note: item.note ?? '',
          }
        : EMPTY
    );
    setCategoryTouched(isEdit);
    // Let the sheet finish animating in before taking focus, or iOS opens the
    // keyboard mid-transition and the sheet lands in the wrong place.
    const id = setTimeout(() => nameRef.current?.focus(), 280);
    return () => clearTimeout(id);
  }, [open, item, isEdit]);

  const setName = (name) => {
    setFields((current) => {
      if (categoryTouched) return { ...current, name };
      const guess = guessCategory(name);
      return { ...current, name, category_key: guess ?? DEFAULT_CATEGORY };
    });
  };

  const submit = () => {
    const name = fields.name.trim();
    if (!name || saving) return;
    onSave({
      name,
      category_key: fields.category_key,
      quantity: fields.quantity === '' ? null : Number(fields.quantity),
      unit: fields.unit || null,
      note: fields.note.trim() || null,
    });
  };

  const field = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 ' +
    'placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 ' +
    'focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isEdit ? t('list.edit') : t('list.addItem')}
      footer={
        <div className="flex gap-3">
          {isEdit && (
            <button
              type="button"
              onClick={() => onDelete(item)}
              aria-label={t('list.delete')}
              className="flex min-h-touch w-12 items-center justify-center rounded-xl border
                         border-red-200 text-red-600 transition active:scale-95
                         dark:border-red-900/50 dark:text-red-400"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
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
            onClick={submit}
            disabled={!fields.name.trim() || saving}
            className={cn(
              'min-h-touch flex-1 rounded-xl bg-brand-600 px-4 font-semibold text-white',
              'transition active:scale-95',
              (!fields.name.trim() || saving) && 'opacity-50'
            )}
          >
            {t('list.save')}
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-4">
        <input
          ref={nameRef}
          value={fields.name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') submit(); }}
          placeholder={t('list.itemName')}
          enterKeyHint="done"
          className={cn(field, 'text-[17px] font-medium')}
        />

        <div className="flex gap-3">
          <input
            value={fields.quantity}
            onChange={(event) => setFields((c) => ({ ...c, quantity: event.target.value }))}
            placeholder={t('list.quantity')}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            className={cn(field, 'flex-1')}
          />
          <select
            value={fields.unit}
            onChange={(event) => setFields((c) => ({ ...c, unit: event.target.value }))}
            className={cn(field, 'flex-1')}
          >
            <option value="">{t('list.unit')}</option>
            {GROCERY_UNITS.map((unit) => (
              <option key={unit} value={unit}>{t(`units.${unit}`)}</option>
            ))}
          </select>
        </div>

        <input
          value={fields.note}
          onChange={(event) => setFields((c) => ({ ...c, note: event.target.value }))}
          placeholder={t('list.note')}
          className={field}
        />

        {/* Aisles as chips, not a dropdown: picking one is a correction of the
            guess, and a correction should cost one tap, not three. */}
        <div>
          <p className="mb-2 text-[13px] font-medium text-gray-500 dark:text-gray-400">
            {t('list.category')}
          </p>
          <div className="flex flex-wrap gap-2 pb-2">
            {GROCERY_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const active = fields.category_key === category.key;
              return (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => {
                    setCategoryTouched(true);
                    setFields((c) => ({ ...c, category_key: category.key }));
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium transition',
                    active
                      ? 'bg-brand-600 text-white'
                      : cn(category.chip, 'text-gray-700 dark:text-gray-300')
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', active ? 'text-white' : category.tint)} />
                  {t(`categories.${category.key}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
