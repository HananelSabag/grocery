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

/**
 * The two helpers the ported components expect, kept at the names they call.
 *
 * SpendWise backs `dateHelpers.format` with date-fns and its full pattern
 * language. The grocery screens use exactly two of those patterns, so they are
 * implemented here against Intl rather than pulling in the library for them.
 */
export const currency = {
  format: (amount, currencyCode = 'ILS', locale = 'he-IL') =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0),
};

const LOCALES = { he: 'he-IL', en: 'en-GB' };

const PATTERNS = {
  // date-fns 'PPP' — a long date. 'PPp' — long date plus the time.
  PPP: { day: 'numeric', month: 'long', year: 'numeric' },
  PPp: { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  PP:  { day: 'numeric', month: 'short', year: 'numeric' },
  p:   { hour: '2-digit', minute: '2-digit' },
};

export const dateHelpers = {
  format: (date, pattern = 'PP', language = 'he') => {
    if (!date) return '';
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return '';
    const locale = LOCALES[language] || LOCALES.he;
    return new Intl.DateTimeFormat(locale, PATTERNS[pattern] || PATTERNS.PP).format(parsed);
  },
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

/**
 * Which picture to show for a person.
 *
 * Three sources, in order: one they uploaded here, the one Google supplied at
 * sign-in, and then nothing — at which point the caller draws a letter. Kept
 * in one function so a row, a sheet, the profile header and the admin table
 * cannot drift into disagreeing about whose face is whose.
 */
export const resolveAvatar = (person) =>
  person?.custom_avatar_url || person?.avatar_url || person?.avatar || null;

/** The letter drawn when there is no picture at all. */
export const avatarInitial = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?';
