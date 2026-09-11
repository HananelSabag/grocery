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
