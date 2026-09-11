import grocery from './he.grocery';

/**
 * Hebrew.
 *
 * `he.grocery.js` is the list's own vocabulary, carried over from SpendWise
 * unchanged — it is what the ported components already speak, and rewording it
 * would only make their strings drift. Kept as its own file so it stays easy
 * to diff against the original.
 *
 * Everything below is new to this app: it has its own front door and its own
 * settings, neither of which existed when the list lived inside SpendWise.
 */
export default {
  ...grocery,

  // BottomSheet was written against the 'common' namespace and reads these
  // two unqualified. Kept at the top level so it needs no edit.
  close: 'סגור',
  dialog: 'חלון',

  app: {
    name: 'רשימת קניות',
    tagline: 'רשימה אחת, לכל הבית',
  },

  auth: {
    signInTitle: 'רשימת קניות משותפת',
    signInSubtitle: 'כולם רואים את אותה רשימה, בזמן אמת',
    google: 'המשך עם Google',
    signingIn: 'מתחבר…',
    signOut: 'התנתקות',
    failed: 'ההתחברות נכשלה. נסה שוב.',
    // Why there is no password field, said once, where it is asked.
    noPassword: 'בלי סיסמאות — כניסה עם Google בלבד',
  },

  profile: {
    title: 'פרופיל',
    language: 'שפה',
    theme: 'מראה',
    themeLight: 'בהיר',
    themeDark: 'כהה',
    themeSystem: 'לפי המכשיר',
    listName: 'שם הרשימה',
  },

  common: {
    loading: 'טוען…',
    retry: 'נסה שוב',
    error: 'משהו השתבש',
    offline: 'אין חיבור',
    back: 'חזרה',
    close: 'סגור',
    confirm: 'אישור',
    cancel: 'ביטול',
    save: 'שמור',
    delete: 'מחק',
  },
};
