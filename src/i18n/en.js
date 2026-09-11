import grocery from './en.grocery';

/** English. See he.js — same shape, same reasoning. */
export default {
  ...grocery,

  // BottomSheet was written against the 'common' namespace and reads these
  // two unqualified. Kept at the top level so it needs no edit.
  close: 'Close',
  dialog: 'Dialog',

  app: {
    name: 'Grocery',
    tagline: 'One list, for the whole house',
  },

  auth: {
    signInTitle: 'A shared grocery list',
    signInSubtitle: 'Everyone sees the same list, as it changes',
    google: 'Continue with Google',
    signingIn: 'Signing in…',
    signOut: 'Sign out',
    failed: 'Sign-in failed. Try again.',
    noPassword: 'No passwords — Google sign-in only',
  },

  profile: {
    title: 'Profile',
    language: 'Language',
    theme: 'Appearance',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'Match device',
    listName: 'List name',
  },

  /** See he.js — the failures that are Supabase's rather than a server's. */
  errors: {
    ...grocery.errors,
    GROCERY_NOT_AUTHENTICATED: 'Please sign in again',
    GROCERY_NO_LIST: 'No active list found',
    GROCERY_ADD_FAILED: "Couldn't add that item",
    GROCERY_UPDATE_FAILED: "Couldn't save that change",
    GROCERY_DELETE_FAILED: "Couldn't delete that item",
    GROCERY_FINISH_FAILED: "Couldn't close the shop",
    GROCERY_LEAVE_FAILED: "Couldn't leave the list",
    GROCERY_LINK_READ: "Couldn't read the share link",
    GROCERY_SCRAPE_UNSUPPORTED: "Can't read that page — fill it in yourself",
  },

  common: {
    loading: 'Loading…',
    retry: 'Try again',
    error: 'Something went wrong',
    offline: 'No connection',
    back: 'Back',
    close: 'Close',
    confirm: 'OK',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
  },
};
