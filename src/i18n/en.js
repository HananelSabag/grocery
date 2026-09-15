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
    // Sharing is a link, and only a link: send it or copy it. No code on screen.
    send: 'Send the link',
    copyLink: 'Copy link',
    linkHint: 'Anyone who gets the link can join this list. It is permanent — it works in a group chat, and next month.',
    message: 'Join our shopping list',
    messageNamed: 'Join our shopping list: {{name}}',
    replaceLink: 'Replace link',
    replaceLinkConfirm: 'Yes, replace it',
    replaceLinkWarning: 'The current link stops working, even for people who already have it. Anyone already on the list stays.',
    linkReplaced: 'Link replaced',
    // "Stop sharing" used to archive the whole list, for its owner too. It now
    // does what this sentence says, so the sentence can finally be true.
    disband: 'Stop sharing',
    disbandConfirm: 'Remove everyone from this list? The link will change, and the list stays with you.',
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

  /** Joining somebody else's list, through a link. */
  join: {
    // The sign-in screen when arriving from a link: someone who has never used
    // the app needs to know they are in the right place, not at a generic login.
    signInTitle: "You're invited to a shared shopping list",
    signInSubtitle: 'To join, sign in with Google. That is all — no password, no sign-up form.',
    embeddedBrowser: "Google won't sign anyone in from inside this app's browser. Copy the link and open it in Chrome or Safari.",
    notFound: 'This link no longer works',
    notFoundHint: 'It may have been replaced — worth asking for a new one.',
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
