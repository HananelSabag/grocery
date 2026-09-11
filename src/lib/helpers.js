import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Conditional classes, with later Tailwind utilities winning over earlier. */
export const cn = (...inputs) => twMerge(clsx(inputs));

/**
 * "2 ק\"ג", "500 גרם", "" — the quantity line under an item's name.
 * Both parts are optional, and an item with neither shows nothing rather than
 * an empty bullet.
 */
export const formatQuantity = (quantity, unit, t) => {
  if (quantity == null && !unit) return '';
  const amount = quantity == null ? '' : String(Number(quantity));
  const label = unit ? t(`units.${unit}`) : '';
  return [amount, label].filter(Boolean).join(' ');
};

/** ₪ with no decimals when it is a round number — prices here are casual. */
export const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
};

/** "היום" / "אתמול" / a short date — history rows, where the year is noise. */
export const formatTripDate = (iso, language) => {
  if (!iso) return '';
  const date = new Date(iso);
  const today = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(today) - startOfDay(date)) / 86400000);

  if (days === 0) return language === 'he' ? 'היום' : 'Today';
  if (days === 1) return language === 'he' ? 'אתמול' : 'Yesterday';

  return new Intl.DateTimeFormat(language === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  }).format(date);
};
