import { create } from 'zustand';
import he from './he';
import en from './en';

const BUNDLES = { he, en };
const STORAGE_KEY = 'grocery_lang';

/**
 * Hebrew is the default, not English.
 *
 * The people this is for read Hebrew; falling back to English when a browser
 * reports an unfamiliar locale would put the wrong language in front of most
 * of them. English is opt-in, either by preference or by an explicitly
 * English browser.
 */
const detectLanguage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'he' || saved === 'en') return saved;
  } catch {
    /* private mode — fall through to the browser hint */
  }
  const nav = (navigator.language || '').toLowerCase();
  return nav.startsWith('en') ? 'en' : 'he';
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

  /** t('list.itemsLeft', { count: 3 }) */
  t: (path, vars) => {
    const { language } = get();
    const hit = lookup(BUNDLES[language], path) ?? lookup(BUNDLES.he, path);
    return hit === undefined ? path : interpolate(hit, vars);
  },
}));

/** Call once at boot so <html lang/dir> matches the stored choice. */
export const initLanguage = () => applyToDocument(useLanguage.getState().language);

export const useT = () => useLanguage((s) => s.t);
