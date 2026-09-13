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

  /**
   * Sharing moved from a one-time link to a standing code, so the link's own
   * wording stays in the ported file and the code's is added here.
   */
  share: {
    ...grocery.share,
    codeTitle: 'List code',
    codeHint: 'Anyone with the code can join. It does not expire — if you want to shut it off, change it.',
    copyCode: 'Copy the code',
    send: 'Send',
    message: 'Join our shopping list. Code: {{code}}',
    changeCode: 'Change',
    changeCodeConfirm: 'Sure?',
    changeCodeWarning: 'The old code stops working, and so do links sent with it. Anyone already on the list stays.',
    codeChanged: 'Code changed',
    // "Stop sharing" used to archive the whole list, for its owner too. It now
    // does what this sentence says, so the sentence can finally be true.
    disband: 'Stop sharing',
    disbandConfirm: 'Remove everyone from this list? The code will change, and the list stays with you.',
  },

  /**
   * More than one list: the switcher in the header is now also where a list is
   * made, named and removed. Naming moved here from the profile page.
   */
  lists: {
    ...grocery.lists,
    ownedBy: "{{name}}'s",
    create: 'New list',
    createPlaceholder: 'e.g. Eilat, Friday dinner',
    createHint: 'Left blank, it will be called "{{name}}"',
    createAction: 'Create',
    created: 'Created "{{name}}"',
    newDefault: 'List {{n}}',
    rename: 'Rename',
    renamed: 'Name updated',
    nameRequired: 'With more than one list, each one needs a name',
    archive: 'Delete',
    archiveConfirmButton: 'Yes, delete',
    archiveConfirm: '"{{name}}" and its items will be deleted.',
    archiveConfirmShared: '"{{name}}" will also be gone for {{count}} other people.',
    archiveConfirmShared_one: '"{{name}}" will also be gone for one other person.',
    archived: 'List deleted',
  },

  /** Joining somebody else's list — by code, or by a link carrying one. */
  join: {
    title: 'Join a list',
    placeholder: '6-character code',
    action: 'Join',
    joined: 'You joined the list',
    notFound: 'No list with that code',
    notFoundHint: 'Worth asking for the code again — it may have been changed.',
    toMyList: 'To my list',
    invitedTo: "You're invited to",
    memberCount: '{{count}} people on it',
    memberCount_one: 'one person on it',
    confirm: 'Join this list',
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
