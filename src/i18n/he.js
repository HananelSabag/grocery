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
    changePicture: 'החלפת תמונת פרופיל',
    removePicture: 'הסר תמונה',
    pictureSaved: 'התמונה עודכנה',
  },

  /**
   * Failure codes this app raises that SpendWise's server never did — mostly
   * because the failure is now a Supabase one. Merged into the carried-over
   * block rather than replacing it, so both halves survive.
   */
  errors: {
    ...grocery.errors,
    GROCERY_NOT_AUTHENTICATED: 'צריך להתחבר מחדש',
    GROCERY_NO_LIST: 'לא מצאנו רשימה פעילה',
    GROCERY_ADD_FAILED: 'לא הצלחנו להוסיף את הפריט',
    GROCERY_UPDATE_FAILED: 'לא הצלחנו לשמור את השינוי',
    GROCERY_DELETE_FAILED: 'לא הצלחנו למחוק את הפריט',
    GROCERY_FINISH_FAILED: 'לא הצלחנו לסגור את הקנייה',
    GROCERY_LEAVE_FAILED: 'לא הצלחנו לעזוב את הרשימה',
    GROCERY_LINK_READ: 'לא הצלחנו לקרוא את קישור השיתוף',
    // There is no server to fetch the page from — see lib/api.js.
    GROCERY_SCRAPE_UNSUPPORTED: 'לא ניתן לקרוא את הדף — מלאו ידנית',
  },

  /** The profile's own stat tile — a count of what you personally ticked off. */
  history: {
    ...grocery.history,
    statItems: 'פריטים שלקחת',
  },

  /** Admin. Reachable only by an address in grocery.admins. */
  admin: {
    title: 'ניהול',
    denied: 'אין לך גישה למסך הזה.',
    users: 'משתמשים',
    lists: 'רשימות',
    sharedLists: 'רשימות משותפות',
    activeItems: 'פריטים פתוחים',
    trips: 'קניות שנסגרו',
    pendingInvites: 'הזמנות ממתינות',
    signups7d: 'נרשמו השבוע',
    active7d: 'פעילים השבוע',
    archived: 'בארכיון',
    empty: 'אין עדיין נתונים',
    userLine: '{{lists}} רשימות · {{items}} פריטים · {{trips}} קניות',
    listLine: '{{members}} חברים · {{items}} פריטים · {{trips}} קניות',
    readOnlyNote: 'המסך הזה לקריאה בלבד. ההרשאה ניתנת ב-RLS ומאפשרת לראות, לא לשנות.',
    open: 'מסך ניהול',
  },

  /** Offer to install. Android gets a real button; iOS gets the gesture. */
  install: {
    title: 'להוסיף למסך הבית?',
    body: 'ייפתח כמו אפליקציה, בלי שורת הכתובת.',
    action: 'התקנה',
    iosBody: 'בספארי זה נעשה מתפריט השיתוף:',
    iosStep1: 'שיתוף',
    iosStep2: 'הוספה למסך הבית',
  },

  /** מופיע רק כשגרסה חדשה לא הצליחה להיכנס בשקט. */
  update: {
    ready: 'גרסה חדשה',
    action: 'רענון',
  },

  /**
   * השיתוף עבר מקישור חד-פעמי לקוד קבוע, אז המילים של הקישור נשארות בקובץ
   * המקורי ואלה שמתארות את הקוד נוספות כאן.
   */
  share: {
    ...grocery.share,
    codeTitle: 'קוד הרשימה',
    codeHint: 'כל מי שיש לו את הקוד יכול להצטרף. הקוד קבוע ולא פג — ואם בא לכם לסגור אותו, פשוט מחליפים.',
    copyCode: 'העתקת הקוד',
    send: 'שליחה',
    message: 'הצטרפו לרשימת הקניות שלנו. הקוד: {{code}}',
    changeCode: 'החלפה',
    changeCodeConfirm: 'בטוח?',
    changeCodeWarning: 'הקוד הישן יפסיק לעבוד, וגם קישורים שנשלחו איתו. מי שכבר ברשימה נשאר בה.',
    codeChanged: 'הקוד הוחלף',
    // "הפסקת שיתוף" נהגה להעביר את כל הרשימה לארכיון, גם אצל הבעלים. עכשיו
    // היא עושה מה שהמשפט הזה אומר, אז המשפט יכול סוף סוף להיות נכון.
    disband: 'הפסקת שיתוף',
    disbandConfirm: 'להוציא את כולם מהרשימה? הקוד יוחלף, והרשימה נשארת אצלך.',
  },

  /**
   * כמה רשימות: המתג בכותרת הוא עכשיו גם המקום שבו רשימה נוצרת, מקבלת שם
   * ונמחקת. השם עבר לכאן מדף הפרופיל.
   */
  lists: {
    ...grocery.lists,
    ownedBy: 'של {{name}}',
    create: 'רשימה חדשה',
    createPlaceholder: 'למשל: אילת, ארוחת שישי',
    // בלי מירכאות סביב שמות: בטקסט מימין לשמאל, מירכאה אחרי שם שמסתיים
    // במספר ("רשימה 5") נוחתת בצד הלא נכון.
    createHint: 'אם לא תבחרו שם: {{name}}',
    createAction: 'יצירה',
    created: 'נוצרה הרשימה {{name}}',
    newDefault: 'רשימה {{n}}',
    rename: 'שינוי שם',
    renamed: 'השם עודכן',
    nameRequired: 'כשיש כמה רשימות, לכל אחת צריך שם',
    archive: 'מחיקה',
    archiveConfirmButton: 'כן, למחוק',
    archiveConfirm: 'הרשימה {{name}} והפריטים בה יימחקו.',
    archiveConfirmShared: 'הרשימה {{name}} תימחק גם אצל {{count}} אנשים נוספים.',
    archiveConfirmShared_one: 'הרשימה {{name}} תימחק גם אצל עוד אדם אחד.',
    archived: 'הרשימה נמחקה',
  },

  /** הצטרפות לרשימה של מישהו אחר — דרך קוד או דרך קישור שמכיל אותו. */
  join: {
    title: 'הצטרפות לרשימה',
    placeholder: 'קוד בן 6 תווים',
    action: 'הצטרפות',
    joined: 'הצטרפתם לרשימה',
    notFound: 'לא מצאנו רשימה עם הקוד הזה',
    notFoundHint: 'שווה לבקש את הקוד שוב — ייתכן שהוא הוחלף.',
    toMyList: 'לרשימה שלי',
    invitedTo: 'הוזמנתם אל',
    memberCount: '{{count}} אנשים ברשימה',
    memberCount_one: 'אדם אחד ברשימה',
    confirm: 'הצטרפות לרשימה',
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
