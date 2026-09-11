import { create } from 'zustand';

const STORAGE_KEY = 'grocery_theme';
const QUERY = '(prefers-color-scheme: dark)';

const read = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    /* private mode */
  }
  return 'system';
};

const resolve = (theme) =>
  theme === 'system' ? (window.matchMedia(QUERY).matches ? 'dark' : 'light') : theme;

const apply = (theme) => {
  document.documentElement.classList.toggle('dark', resolve(theme) === 'dark');
};

export const useTheme = create((set) => ({
  theme: read(),

  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* the choice still applies for this session */
    }
    apply(theme);
    set({ theme });
  },
}));

/**
 * Call once at boot. Also follows the OS while the choice is "system" — a
 * phone that flips to dark at sunset should take the app with it without a
 * reload.
 */
export const initTheme = () => {
  apply(useTheme.getState().theme);
  window.matchMedia(QUERY).addEventListener('change', () => {
    if (useTheme.getState().theme === 'system') apply('system');
  });
};
