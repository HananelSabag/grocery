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
    changePicture: 'Change profile picture',
    removePicture: 'Remove picture',
    pictureSaved: 'Picture updated',
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

  /** The profile's own stat tile — a count of what you personally ticked off. */
  history: {
    ...grocery.history,
    statItems: 'Items you got',
  },

  /** Admin. Reachable only by an address in grocery.admins. */
  admin: {
    title: 'Admin',
    denied: "You don't have access to this screen.",
    users: 'Users',
    lists: 'Lists',
    sharedLists: 'Shared lists',
    activeItems: 'Open items',
    trips: 'Shops closed',
    pendingInvites: 'Pending invites',
    signups7d: 'Signed up this week',
    active7d: 'Active this week',
    archived: 'archived',
    empty: 'Nothing here yet',
    userLine: '{{lists}} lists · {{items}} items · {{trips}} shops',
    listLine: '{{members}} members · {{items}} items · {{trips}} shops',
    readOnlyNote: 'This screen is read-only. The grant is made in RLS and widens what can be seen, not what can be changed.',
    open: 'Admin panel',
  },

  /** Offer to install. Android gets a real button; iOS gets the gesture. */
  install: {
    title: 'Add to your home screen?',
    body: 'Opens like an app, without the address bar.',
    action: 'Install',
    iosBody: 'In Safari this is done from the share menu:',
    iosStep1: 'Share',
    iosStep2: 'Add to Home Screen',
  },

  /** Shown only when a new build could not install itself quietly. */
  update: {
    ready: 'New version',
    action: 'Refresh',
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
