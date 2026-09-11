import { create } from 'zustand';

const STORAGE_KEY = 'grocery_active_list';

const read = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : null;
  } catch {
    return null;
  }
};

/**
 * Which list this person is currently looking at.
 *
 * Usually there is only one and this stays null, meaning "whichever list the
 * server resolves me to". It matters the moment someone shares theirs: the
 * choice has to survive a reload, or every refresh would bounce you back to
 * your own list mid-shop.
 *
 * Only ever a hint. `ensure_list` resolves the id through membership, so
 * naming a list you are not on lands you on your own rather than on theirs.
 */
export const useActiveList = create((set) => ({
  listId: read(),

  setListId: (listId) => {
    try {
      if (listId == null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, String(listId));
    } catch {
      /* private mode — the choice still holds for this session */
    }
    set({ listId: listId == null ? null : Number(listId) });
  },
}));
