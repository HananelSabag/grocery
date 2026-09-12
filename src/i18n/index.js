import { create } from 'zustand';
import he from './he';
import en from './en';

const BUNDLES = { he, en };
const STORAGE_KEY = 'grocery_lang';

/**
 * Hebrew unless the user has said otherwise.
 *
 * Deliberately not derived from `navigator.language`. This is a household
 * app for a Hebrew-speaking house, and phones here are routinely set to
 * English while the people holding them want Hebrew — so the browser's locale
 * is a worse signal than the plain default. English is one tap away and, once
 * tapped, is remembered.
 */
const detectLanguage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'he' || saved === 'en') return saved;
  } catch {
    /* private mode — the default still applies */
  }
  return 'he';
};

/** Walk a dotted key. Returns the key itself when missing, so gaps are visible. */
const lookup = (bundle, path) => {
  const value = path.split('.').reduce((node, part) => (node == null ? undefined : node[part]), bundle);
  return typeof value === 'string' ? value : undefined;
};

const interpolate = (template, vars) =>
  vars
    ? template.replace(/\{\{(\w+)\}\}/g, (_, name) => (name in vars ? String(vars[name]) : `{{${name}}}`))
    : template;

const applyToDocument = (language) => {
  const dir = language === 'he' ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
  document.documentElement.dir = dir;
};

export const useLanguage = create((set, get) => ({
  language: detectLanguage(),

  setLanguage: (language) => {
    if (language !== 'he' && language !== 'en') return;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      /* the choice still applies for this session */
    }
    applyToDocument(language);
    set({ language });
  },

  get isRTL() {
    return get().language === 'he';
  },

  /**
   * t('progress.remaining', { count: 3 })
   *
   * `fallback` is a reserved variable, not an interpolation: the ported
   * components look up server error codes by name — t(`errors.${code}`, {
   * fallback: t('errors.generic') }) — and most codes have no string of their
   * own. Without it every unmapped code would render as the raw key.
   */
  t: (path, vars) => {
    const { language } = get();

    // Hebrew and English both read badly at one: "נשארו 1" and "1 items left".
    // A `_one` sibling is used when count is exactly 1, which is the only
    // distinction either language needs here.
    const candidates = vars?.count === 1 ? [`${path}_one`, path] : [path];

    let hit;
    for (const key of candidates) {
      hit = lookup(BUNDLES[language], key) ?? lookup(BUNDLES.he, key);
      if (hit !== undefined) break;
    }

    if (hit === undefined) return vars?.fallback ?? path;
    return interpolate(hit, vars);
  },
}));

/** Call once at boot so <html lang/dir> matches the stored choice. */
export const initLanguage = () => applyToDocument(useLanguage.getState().language);

export const useT = () => useLanguage((s) => s.t);

/**
 * The shape SpendWise's components expect: `const { t } = useTranslation()`.
 *
 * Kept deliberately, so the components ported from there need no edit on the
 * line that reads their strings. The namespace argument is accepted and
 * ignored — every grocery string is top-level in this app's bundle, because
 * this app is only the grocery list.
 */
export const useTranslation = () => {
  const t = useLanguage((s) => s.t);
  const language = useLanguage((s) => s.language);
  return { t, language, isRTL: language === 'he' };
};
