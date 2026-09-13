/**
 * Guess a supermarket aisle from what the user typed.
 *
 * Purely a convenience: adding an item should cost one field, so we pick the
 * aisle for you and leave the dropdown one tap away if the guess is wrong. It
 * never blocks, and an unknown word lands in "other".
 *
 * Measured against src/lib/__tests__/groceryCorpus.js — what people actually
 * type into an Israeli shopping list — and asserted there, so a change here
 * that quietly breaks "בננה" fails a test instead of reaching somebody's list.
 *
 * ── How a guess is made ──────────────────────────────────────────────────────
 *
 * 1. Normalise both sides the same way: niqqud, geresh and every apostrophe a
 *    keyboard produces are dropped (צ'יפס = צ׳יפס = ציפס), final letters become
 *    their regular forms so a stem still matches its plural (לימון → לימונים),
 *    doubled ו/י collapse so spelling variants meet (עגבנייה = עגבניה), and
 *    hyphens become spaces (חד-פעמי = חד פעמי).
 *
 * 2. A few words decide the aisle outright, whatever else is written. Some say
 *    what state the item is in (anything "קפוא" is frozen, anything "חד פעמי"
 *    is disposable); the rest say who or what it is FOR, which beats what it is
 *    made of — שמפו לתינוקות is baby, קפסולות למדיח is household, and
 *    שמן לגוף is not cooking oil.
 *
 * 3. Otherwise every keyword is SCORED against every word, and the best wins.
 *    A whole-phrase keyword beats a word; a word, exactly or inflected
 *    (קרואסונים is קרואסון), beats a partial match; and a partial match that
 *    leaves a long tail is worth less than one that leaves none. That ordering
 *    is what stops a short stem from hijacking a longer word — "שוק" (a
 *    drumstick) is a prefix of "שוקו", and first-match-wins used to file
 *    chocolate milk under meat. A three-letter stem may only take an
 *    inflection, never an arbitrary tail: פרילי is not פרי, בקרדי is not בקר.
 *
 * 4. Hebrew glues ה ו ב ל מ ש כ onto the front of nouns (הלחם, וחלב, למדיח).
 *    Each word is tried as written AND with one or two of those peeled off,
 *    and the as-written form is never skipped. It used to be: any word starting
 *    with one of those letters lost it unconditionally, so "בננה" became "ננה",
 *    "מלפפונים" became "לפפונים", and neither matched anything.
 *
 * 5. The head noun decides a tie — the first word in Hebrew (עוגת שוקולד is a
 *    cake, מיץ לימון is a drink), the last in English (orange juice is a
 *    drink). A phrase that does not contain the head only counts as a word,
 *    so לביבות תפוחי אדמה is still latkes and not potatoes.
 *
 * 6. Hebrew inflections the dictionary does not spell out are derived from it:
 *    a construct form (ריבה → ריבת תות, חטיפים → חטיפי אנרגיה), and the stem a
 *    plural hangs off (גלידה → גלידות).
 */

// ── Normalisation ───────────────────────────────────────────────────────────

const NIQQUD = /[֑-ׇ]/g;
const QUOTES = /["'׳״`’‘]/g;
const FINAL_LETTERS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const HEBREW = /[א-ת]/;
const LETTER = /[a-zא-ת]/;

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(NIQQUD, '')
    .replace(QUOTES, '')
    .replace(/[ךםןףץ]/g, (letter) => FINAL_LETTERS[letter])
    .replace(/וו/g, 'ו')
    .replace(/יי/g, 'י')
    .replace(/[\s,./\\\-–—+()&]+/g, ' ')
    .trim();

// ── Vocabulary ──────────────────────────────────────────────────────────────
//
// Written the way people spell things, with final letters and apostrophes —
// everything is normalised when the table is built. Organised by the aisles
// Israeli supermarkets actually use. Plurals and construct forms are listed
// only where neither the prefix rule nor the derivations reach them.

/**
 * Words that decide the aisle on their own. Checked in this order, so an item
 * for a baby that also mentions laundry goes to the baby aisle.
 */
const MARKERS = {
  frozen: ['קפוא', 'frozen'],
  disposables: ['חד פעמי', 'disposable'],
  baby: ['תינוק'],
  household: ['מדיח', 'כביסה'],
  personal_care: ['גוף'],
};

const KEYWORDS = {
  produce: [
    // ירקות
    'עגבני', 'עגבניה', 'עגבניות', 'עגבניות שרי', 'מלפפון', 'מלפפונים', 'חסה', 'חסות',
    'חסה ערבית', 'חסת', 'לבבות חסה', 'גזר', 'בצל', 'בצלים', 'בצל ירוק', 'שום', 'פלפל',
    'פלפלים', 'גמבה', 'צ׳ילי', 'חלפיניו', 'קישוא', 'קישואים', 'חציל', 'חצילים', 'בטטה',
    'בטטות', 'תפוח אדמה', 'תפוחי אדמה', 'תפוד', 'תפודים', 'תפוא', 'ברוקולי', 'כרובית',
    'כרוב', 'כרוב אדום', 'כרוב לבן', 'כרוב ניצנים', 'תרד', 'עלי תרד', 'מנגולד', 'סלרי',
    'שורש סלרי', 'סלק', 'צנון', 'צנונית', 'דלעת', 'דלורית', 'קולורבי', 'קולרבי', 'לפת',
    'במיה', 'ארטישוק', 'אספרגוס', 'שעועית ירוקה', 'אפונה טרי', 'תירס טרי', 'קלח תירס',
    'קלחי תירס', 'פטרי', 'פטריות', 'שמפיניון', 'פורטובלו', 'שיטאקי', 'נבטים', 'כרישה',
    'כרישות', 'שאלוט', 'ג׳ינג׳ר', 'זנגביל', 'עירית', 'שמיר', 'פטרוזיל', 'פטרוזיליה',
    'כוסבר', 'כוסברה', 'נענע', 'בזיליקום', 'רוקט', 'ארוגולה', 'עלי בייבי', 'תימין',
    'טימין', 'רוזמרין', 'מרווה', 'לואיזה', 'עשבי תיבול', 'שומר', 'ירק', 'ירקות', 'סלט',
    'זיתים טרי',
    // פירות
    'תפוח', 'תפוחים', 'תפוחי עץ', 'בננ', 'בננה', 'בננות', 'תפוז', 'תפוזים', 'קלמנטינ',
    'קלמנטינה', 'קלמנטינות', 'מנדרינ', 'מנדרינה', 'אשכולית', 'אשכוליות', 'פומלה',
    'פומלית', 'לימון', 'לימונים', 'ליים', 'אבוקדו', 'תות', 'תותים', 'ענב', 'ענבים',
    'אבטיח', 'אבטיחים', 'מלון', 'מלונים', 'אפרסק', 'אפרסקים', 'נקטרינ', 'נקטרינה',
    'נקטרינות', 'שזיף', 'שזיפים', 'אגס', 'אגסים', 'רימון', 'רימונים', 'מנגו', 'קיווי',
    'אננס', 'תמר', 'תמרים', 'תאנ', 'תאנה', 'תאנים', 'משמש', 'משמשים', 'דובדבן',
    'דובדבנים', 'ליצ', 'ליצ׳י', 'פסיפלור', 'קרמבול', 'אפרסמון', 'אוכמניות', 'פטל',
    'פפאיה', 'גויאבה', 'פיטאיה', 'פרי דרקון', 'שסק', 'חבוש', 'סברס', 'פרי', 'פירות',
    'פירות יער',
    // English
    'tomato', 'cucumber', 'lettuce', 'carrot', 'onion', 'garlic', 'apple', 'banana',
    'orange', 'lemon', 'lime', 'avocado', 'pepper', 'strawberr', 'strawberries',
    'blueberr', 'blueberries', 'raspberr', 'raspberries', 'berries', 'grape', 'watermelon',
    'melon', 'spinach', 'broccoli', 'cauliflower', 'cabbage', 'zucchini', 'eggplant',
    'potato', 'sweet potato', 'parsley', 'cilantro', 'coriander', 'mint', 'basil', 'dill',
    'thyme', 'rosemary', 'ginger', 'mushroom', 'salad', 'fruit', 'vegetable', 'veggie',
    'peach', 'nectarine', 'apricot', 'pear', 'plum', 'mango', 'kiwi', 'pineapple', 'date',
    'fig', 'pomegranate', 'papaya', 'guava', 'grapefruit', 'clementine', 'tangerine',
    'celery', 'beet', 'radish', 'leek', 'scallion', 'asparagus', 'kale', 'arugula',
    'corn on the cob', 'chili', 'jalapeno', 'herbs', 'cherries',
  ],

  bakery: [
    'לחם', 'לחמים', 'לחמני', 'לחמניה', 'לחמניות', 'לחם מלא', 'מחמצת', 'פית', 'פיתה',
    'פיתות', 'חלה', 'חלות', 'בגט', 'באגט', 'בגטים', 'באגטים', 'קרואסון', 'רוגלך', 'רוגלעך',
    'בורק', 'בורקס', 'מאפה', 'מאפים', 'טורטיה', 'טורטיל', 'טורטיות', 'לאפ', 'לאפה', 'לאפות',
    'פוקאצ', 'פוקאצ׳ה', 'ציאבט', 'ציאבטה', 'בייגל', 'ביסקוויט שמרים', 'עוגת שמרים',
    'קרקר לחם', 'מצה', 'מצות', 'פרוסות', 'שיפון', 'כוסמין', 'דגנים לחם', 'עוגה', 'עוגת',
    'עוגות', 'מאפין', 'מאפינס', 'דונאטס', 'סופגני', 'סופגניה', 'סופגניות', 'בראוניז',
    'בריוש', 'כעך', 'כעכים', 'ג׳בטה', 'לחם קל', 'פרנה', 'טוסט',
    'bread', 'pita', 'challah', 'roll', 'baguette', 'croissant', 'pastry', 'pastri',
    'tortilla', 'bun', 'bagel', 'focaccia', 'ciabatta', 'muffin', 'donut', 'doughnut',
    'cake', 'cupcake', 'brioche', 'sourdough', 'wraps', 'naan', 'toast',
  ],

  dairy_eggs: [
    'חלב', 'שוקו', 'גבינה', 'גבינת', 'גבינות', 'גבינת ברי', 'קוטג', 'קוטג׳', 'יוגורט',
    'יוגורטים', 'יופלה', 'אקטיביה', 'אקטימל', 'דנונה', 'דני', 'מילקי', 'גמדים', 'פודינג',
    'מלבי', 'מעדן', 'מעדנים', 'שמנת', 'שמנת מתוקה', 'שמנת חמוצה', 'שמנת לבישול', 'חמאה',
    'מרגרינה', 'ביצה', 'ביצים', 'לבן', 'לאבנה', 'אשל', 'קפיר', 'צהובה', 'מוצרלה', 'פטה',
    'בולגרית', 'צפתית', 'ריקוטה', 'מסקרפונה', 'פרמזן', 'קממבר', 'גאודה', 'עמק',
    'גבינה מגורדת', 'קצפת', 'תנובה', 'טרה', 'יטבתה', 'משקה סויה', 'משקה חלב', 'חלב שקדים',
    'חלב שיבולת', 'חלב שיבולת שועל', 'חלב סויה', 'חלב אורז', 'אלפרו', 'טופו', 'קרם גבינה',
    'ממרח גבינה', 'כשקד',
    'milk', 'cheese', 'cottage', 'yogurt', 'yoghurt', 'cream', 'butter', 'egg',
    'mozzarella', 'feta', 'ricotta', 'tofu', 'gouda', 'camembert', 'kefir', 'parmesan',
    'cheddar', 'sour cream', 'whipped cream', 'margarine', 'pudding', 'labneh', 'halloumi',
    'brie',
  ],

  meat_fish: [
    'בשר', 'בשרים', 'עוף', 'עופות', 'הודו', 'שניצל', 'שניצלים', 'קציצ', 'קציצות', 'נקניק',
    'נקניקי', 'נקניקיות', 'סלמון', 'טונה טרי', 'טונה אדומה', 'דג', 'דגים', 'טחון',
    'אנטריקוט', 'סינטה', 'פילה', 'כבד', 'כבדים', 'פרגית', 'פרגיות', 'חזה עוף', 'כנפיים',
    'כנפי עוף', 'שוקיים', 'שוק עוף', 'כרעיים', 'ירכיים', 'עוף שלם', 'המבורגר',
    'המבורגרים', 'קבב', 'קבבים', 'דניס', 'לברק', 'מושט', 'בקלה', 'אמנון', 'בורי', 'מוסר ים',
    'לוקוס', 'פלמידה', 'שרימפס', 'קלמרי', 'פירות ים', 'שווארמה', 'אסאדו', 'צלעות', 'צלע',
    'לשון', 'כתף', 'צלי', 'צלי כתף', 'סטייק', 'סטייקים', 'פסטרמה', 'סלמי', 'מרגז',
    'קבנוס', 'שייטל', 'פילה בקר', 'בקר', 'בשר עגל', 'כבש', 'טלה', 'לבבות', 'קורקבנים',
    'גולש', 'אונטריב', 'פיקניה', 'נתחי עוף', 'חזה אווז',
    'meat', 'chicken', 'turkey', 'schnitzel', 'sausage', 'salmon', 'fish', 'beef', 'steak',
    'lamb', 'burger', 'hamburger', 'mince', 'liver', 'brisket', 'ribs', 'thigh', 'wing',
    'drumstick', 'veal', 'duck', 'shrimp', 'prawn', 'cod', 'tilapia', 'sea bass', 'hot dog',
    'meatball', 'kebab', 'shawarma', 'fillet', 'ham', 'bacon', 'pork',
  ],

  pantry: [
    'אורז', 'אורז בסמטי', 'אורז יסמין', 'אורז מלא', 'פסטה', 'ספגטי', 'פנה', 'פוזילי',
    'פרפלה', 'מקרוני', 'לזניה', 'ניוקי', 'נודלס', 'אטריות', 'אטריות אורז', 'קמח', 'סוכר',
    'סוכר חום', 'אבקת סוכר', 'מלח', 'מלח גס', 'פלפל שחור', 'פלפל לבן', 'שמן', 'שמן זית',
    'שמן קנולה', 'שמן חמניות', 'שמן קוקוס', 'תרסיס שמן', 'חומץ', 'חומץ בלסמי',
    'חומץ תפוחים', 'רוטב', 'רוטב סויה', 'רוטב עגבניות', 'רוטב פסטה', 'רוטב ברביקיו', 'סלסה',
    'קטשופ', 'מיונז', 'חרדל', 'טחינה', 'חומוס', 'שימור', 'שימורים', 'שימורי', 'תירס',
    'אפונה', 'קטניות', 'עדש', 'עדשים', 'שעועית', 'שעועית לבנה', 'שעועית אדומה', 'גרגירי',
    'גרגרי חומוס', 'קוסקוס', 'בורגול', 'קינואה', 'פתיתים', 'גריסים', 'כוסמת', 'שקד',
    'שקדים', 'אגוז', 'אגוזים', 'אגוזי מלך', 'אגוזי לוז', 'קשיו', 'פקאן', 'צימוק', 'צימוקים',
    'חמוציות', 'פירות יבשים', 'משמש מיובש', 'דבש', 'ריבה', 'ריבות', 'תבלין', 'תבלינים',
    'פפריקה', 'כמון', 'כורכום', 'קינמון', 'זעתר', 'סומק', 'אורגנו', 'בהרט', 'חוואיג',
    'אבקת שום', 'אבקת מרק', 'מרק', 'מרקים', 'שקדי מרק', 'קרוטונים', 'קפה', 'נס קפה',
    'קפה נמס', 'קפה טורקי', 'קפסולות', 'תה', 'תיונים', 'סוכרזית', 'ממתיק', 'סטיביה',
    'שמרים', 'אבקת אפייה', 'סודה לשתייה', 'קורנפלור', 'עמילן', 'וניל', 'תמצית', 'תמצית וניל',
    'קקאו', 'אבקת קקאו', 'רסק', 'פסטו', 'סילאן', 'ממרח', 'ממרח שוקולד', 'שוקולד למריחה',
    'חמאת בוטנים', 'נוטלה', 'חלבה', 'גרנולה', 'קורנפלקס', 'דגני בוקר', 'כריות',
    'שיבולת שועל', 'קוואקר', 'קוקוס', 'חלב קוקוס', 'קרם קוקוס', 'חלב מרוכז', 'סירופ',
    'סירופ מייפל', 'טונה', 'סרדינים', 'זיתים', 'חמוצים', 'מלפפון חמוץ', 'מלפפונים חמוצים',
    'כבושים', 'עגבניות מרוסקות', 'עגבניות משומרות', 'עגבניות מיובשות', 'פטריות שימורים',
    'פירורי לחם', 'פירורים', 'פנקו', 'אבקת פודינג', 'אבקת ג׳לי', 'סויה', 'אצות', 'נורי',
    'rice', 'pasta', 'spaghetti', 'noodles', 'macaroni', 'lasagna', 'flour', 'sugar', 'salt',
    'oil', 'olive oil', 'vinegar', 'sauce', 'ketchup', 'mayo', 'mayonnaise', 'mustard',
    'tahini', 'hummus', 'canned', 'corn', 'cornflakes', 'lentil', 'bean', 'chickpea',
    'couscous', 'quinoa', 'bulgur', 'barley', 'almond', 'walnut', 'nut', 'cashew', 'pecan',
    'raisin', 'dried fruit', 'honey', 'jam', 'spice', 'cinnamon', 'paprika', 'cumin',
    'oregano', 'black pepper', 'cereal', 'coffee', 'tea', 'tea bags', 'oats', 'oatmeal',
    'granola', 'syrup', 'yeast', 'baking powder', 'baking soda', 'cornstarch', 'vanilla',
    'cocoa', 'breadcrumbs', 'soup', 'broth', 'tuna', 'sardines', 'olives', 'pickles',
    'peanut butter', 'salad dressing', 'pancake', 'soy sauce', 'seaweed',
  ],

  frozen: [
    'קפואים', 'גלידה', 'גלידות', 'גלידת', 'ארטיק', 'ארטיקים', 'קרטיב', 'קרטיבים', 'שלגון',
    'שלגונים', 'סורבה', 'מלאווח', 'ג׳חנון', 'בורקס קפוא', 'פיצה', 'פיצות', 'פיצה קפואה',
    'בצק עלים', 'בצק פילו', 'ירקות קפואים', 'אפונה קפואה', 'צ׳יפס קפוא', 'שניצל קפוא', 'קרח',
    'קוביות קרח', 'אדממה', 'כופתאות', 'כיסונים', 'פירוגי', 'נאגטס', 'נגטס', 'קובה',
    'לביבות', 'בלינצ׳ס',
    'ice cream', 'icecream', 'popsicle', 'fries', 'pizza', 'nuggets', 'ice', 'dumplings',
    'pierogi', 'sorbet', 'gelato',
  ],

  snacks_sweets: [
    'חטיף', 'חטיפים', 'ביסלי', 'במבה', 'דוריטוס', 'צ׳יטוס', 'אפרופו', 'שוקולד', 'שוקולדים',
    'סוכרי', 'סוכריה', 'סוכריות', 'ממתק', 'ממתקים', 'עוגי', 'עוגיה', 'עוגיות', 'ופל',
    'ופלים', 'קרקר', 'קרקרים', 'פיצוחים', 'גרעינים', 'גרעיני', 'בוטנים', 'פיסטוק',
    'פיסטוקים', 'מסטיק', 'טופי', 'מרשמלו', 'קליק', 'פסק זמן', 'מקופלת', 'תות במבה',
    'חטיף אנרגיה', 'חלבון', 'צ׳יפס', 'תפוצ׳יפס', 'פרינגלס', 'נשנוש', 'נשנושים', 'קינדר',
    'מילקה', 'סניקרס', 'טוויקס', 'מארס', 'בונבונים', 'בונבוניירה', 'פררו', 'טובלרון',
    'לינדט', 'כיף כף', 'פופקורן', 'בייגלה', 'פריכיות', 'פתי בר', 'חטיף גרנולה', 'פרלינים',
    'מנטוס', 'טיק טק', 'לקריץ', 'דובונים', 'גומי דובים', 'אוראו', 'קרמבו',
    'snack', 'chocolate', 'candy', 'cookie', 'biscuit', 'wafer', 'chips', 'crisps',
    'cracker', 'gum', 'sweets', 'peanut', 'pistachio', 'popcorn', 'pretzel', 'marshmallow',
    'lollipop', 'gummy', 'gummies', 'oreo', 'granola bar', 'protein bar', 'energy bar',
    'rice cakes', 'nachos', 'trail mix',
  ],

  beverages: [
    'מים', 'מים מינרלים', 'סודה', 'קולה', 'קוקה', 'פפסי', 'ספרייט', 'פאנטה', 'שוופס', 'מיץ',
    'מיצים', 'נקטר', 'תרכיז', 'סירופ פטל', 'משקה', 'משקאות', 'אנרגיה', 'משקה אנרגיה',
    'רד בול', 'איס טי', 'נסטי', 'תה קר', 'נביעות', 'עין גדי', 'מי עדן', 'פריגת', 'פרימור',
    'ספרינג', 'טמפו', 'סן פלגרינו', 'לימונענע', 'לימונדה', 'קפה קר', 'שייק', 'סמודי',
    'בירה שחורה',
    'water', 'cola', 'coke', 'pepsi', 'sprite', 'fanta', 'juice', 'soda', 'club soda',
    'seltzer', 'sparkling', 'drink', 'soft drink', 'lemonade', 'iced tea', 'energy drink',
    'smoothie', 'kombucha', 'ginger ale', 'nectar',
  ],

  alcohol: [
    'בירה', 'בירות', 'יין', 'יינות', 'ערק', 'עראק', 'וודקה', 'ויסקי', 'רום', 'ג׳ין', 'טקילה',
    'ליקר', 'קוניאק', 'ברנדי', 'שמפניה', 'פרוסקו', 'קאווה', 'למברוסקו', 'קברנה', 'מרלו',
    'שרדונה', 'סוביניון', 'מוסקטו', 'גולדסטאר', 'טובורג', 'הייניקן', 'קורונה', 'קרלסברג',
    'סטלה', 'גינס', 'מכבי בירה', 'אלכוהול', 'סאקה', 'סיידר', 'מרטיני', 'קמפרי', 'אפרול',
    'ג׳ק דניאלס', 'ג׳וני ווקר', 'שיבס', 'ג׳יימסון', 'בקרדי', 'אבסולוט', 'סמירנוף', 'בייליס',
    'beer', 'wine', 'vodka', 'whiskey', 'whisky', 'rum', 'gin', 'tequila', 'liqueur',
    'champagne', 'prosecco', 'arak', 'cider', 'sake', 'brandy', 'cognac', 'martini',
    'aperol', 'bourbon', 'scotch', 'cava', 'lager',
  ],

  baby: [
    'חיתול', 'חיתולים', 'טיטול', 'טיטולים', 'האגיס', 'פמפרס', 'מגבונ', 'מגבונים', 'תינוקות',
    'מטרנה', 'סימילק', 'סימילאק', 'נוטרילון', 'תמ״ל', 'פורמולה', 'מוצץ', 'מוצצים',
    'בקבוק תינוק', 'בקבוק האכלה', 'האכלה', 'מחית', 'מחית פירות', 'גרבר', 'דייסה', 'דייס',
    'משחת החתלה', 'קרם החתלה', 'החתלה', 'שמיניות',
    'diaper', 'nappy', 'wipe', 'baby', 'formula', 'pacifier', 'puree', 'baby food',
  ],

  household: [
    'ניקוי', 'חומר ניקוי', 'אקונומיקה', 'כלור', 'סבון כלים', 'נוזל כלים', 'פיירי', 'כלים',
    'מרכך', 'מסיר כתמים', 'כתמים', 'מסיר שומנים', 'מסיר אבנית', 'אבנית', 'רצפה', 'רצפות',
    'סנו', 'ג׳אוול', 'ניקול', 'בדין', 'אג׳קס', 'טאץ', 'פרסיל', 'טייד', 'אריאל', 'וואנש',
    'מנקה', 'חלונות', 'אסלה', 'נייר טואלט', 'גלילי נייר', 'מגבות נייר', 'נייר סופג',
    'טישו', 'ממחטות', 'מגבוני ניקוי', 'שקיות אשפה', 'שקיות זבל', 'זבל', 'אשפה', 'שקיות',
    'שקיות הקפאה', 'שקיות סנדוויץ׳', 'ניילון נצמד', 'נייר כסף', 'נייר אפייה', 'אלומיניום',
    'ספוג', 'ספוגים', 'צמר פלדה', 'סקוץ׳', 'מטהר', 'ריח', 'סמרטוט', 'סמרטוטים', 'מגב',
    'מטלית', 'מטליות', 'כפפות', 'סוללה', 'סוללות', 'נורה', 'נורות', 'גפרורים', 'מצית',
    'נרות', 'יתושים', 'קוטל חרקים', 'אבקת ריצוף',
    'clean', 'bleach', 'dish soap', 'laundry', 'softener', 'toilet paper', 'toilet roll',
    'paper towel', 'garbage', 'trash', 'sponge', 'detergent', 'foil', 'aluminum', 'tissues',
    'dishwasher', 'stain remover', 'zip bags', 'plastic wrap', 'cling film',
    'baking paper', 'parchment', 'battery', 'batteries', 'light bulb', 'candles',
    'air freshener', 'gloves', 'cleaning wipes',
  ],

  disposables: [
    'צלחות', 'כוסות', 'סכום', 'סכו״ם', 'מזלגות', 'סכינים', 'כפות', 'כפיות', 'מפיות',
    'קשיות', 'מגש', 'מגשים', 'קערות', 'תבנית', 'תבניות', 'שיפודים', 'קיסמים', 'מפה', 'מפות',
    'קופסאות', 'מכסים',
    'plates', 'cups', 'napkin', 'cutlery', 'straw', 'forks', 'spoons', 'toothpicks',
    'skewers', 'tablecloth', 'containers',
  ],

  personal_care: [
    'שמפו', 'מרכך שיער', 'סבון', 'ג׳ל רחצה', 'תחליב רחצה', 'רחצה', 'משחת שיניים',
    'מברשת שיניים', 'שיניים', 'מי פה', 'מי פנים', 'מי מיסלר', 'חוט דנטלי', 'דאודורנט',
    'רול און', 'תחבושות', 'טמפונים', 'פדים', 'פד', 'קרם', 'קרם הגנה', 'קרם שיזוף', 'שיער',
    'גילוח', 'סכיני גילוח', 'אפטר שייב', 'אפטרשייב', 'תער', 'בושם', 'לק', 'מסיר לק',
    'איפור', 'מסיר איפור', 'צמר גפן', 'מקלוני אוזניים', 'מקלונים', 'אקמול', 'נורופן',
    'אדוויל', 'אופטלגין', 'דקסמול', 'ויטמין', 'אומגה', 'מגנזיום', 'פלסטר', 'תרופה',
    'תרופות', 'עדשות מגע', 'תמיסה לעדשות', 'קרם לחות', 'ניר לחות', 'קונדומים', 'קולגייט',
    'סנסודיין', 'ניוואה', 'הד אנד שולדרס', 'פנטן', 'אולוויז',
    'shampoo', 'conditioner', 'soap', 'toothpaste', 'toothbrush', 'floss', 'mouthwash',
    'deodorant', 'pad', 'tampon', 'face cream', 'hand cream', 'body wash', 'shower gel',
    'shave', 'shaving', 'razor', 'vitamin', 'sunscreen', 'lotion', 'perfume', 'makeup',
    'nail polish', 'cotton', 'band aid', 'bandaid', 'painkiller', 'ibuprofen',
    'paracetamol', 'medicine', 'condom', 'hair',
  ],
};

// ── The table ───────────────────────────────────────────────────────────────

const PHRASE_SCORE = 1200;
/** A phrase that does not contain the head noun competes as a word would. */
const PHRASE_OFF_HEAD_SCORE = 1000;
const HEAD_BONUS = 15;

/**
 * Inflections of a normalised keyword that it does not spell out itself. Only
 * single Hebrew words, and only where the stem is long enough not to swallow
 * something else — a three-letter stem like חל would take חלב.
 */
const derivedOf = (word) => {
  if (word.includes(' ') || !HEBREW.test(word)) return [];
  const forms = [];

  if (word.endsWith('ה')) {
    // The stem a plural hangs off: גלידה → גליד, so גלידות still matches.
    if (word.length - 1 >= 4) forms.push(word.slice(0, -1));
    // Construct state: ריבה → ריבת (ריבת תות), נורה → נורת (נורת לד).
    if (word.length >= 3) forms.push(`${word.slice(0, -1)}ת`);
  }

  // -ית → the stem of its ות plural: אשכולית → אשכולי.
  if (word.endsWith('ית') && word.length - 1 >= 5) forms.push(word.slice(0, -1));

  // Masculine plural construct: חטיפים → חטיפי (חטיפי אנרגיה), מגשים → מגשי.
  // Normalised, the final ם of ים is already מ.
  if (word.endsWith('ימ') && word.length - 1 >= 4) forms.push(word.slice(0, -1));

  return forms;
};

const ENTRIES = (() => {
  const owner = new Map();
  const entries = [];

  const add = (category, word, derived) => {
    if (!word) return;
    const existing = owner.get(word);
    if (existing === category) return;
    // A derived form never overrides a word some aisle listed outright.
    if (derived && existing) return;
    if (!existing) owner.set(word, category);
    entries.push({ category, word, span: word.split(' ').length });
  };

  const lists = Object.entries(KEYWORDS);
  for (const [category, words] of lists) {
    for (const raw of words) add(category, normalize(raw), false);
  }
  for (const [category, words] of lists) {
    for (const raw of words) {
      for (const form of derivedOf(normalize(raw))) add(category, form, true);
    }
  }

  // Longer keywords are more specific; the sort is stable, so within a length
  // the aisle order above breaks the tie.
  return entries.sort((a, b) => b.word.length - a.word.length);
})();

const MARKER_ENTRIES = Object.entries(MARKERS).flatMap(([category, words]) =>
  words.map((raw) => {
    const word = normalize(raw);
    return { category, word, span: word.split(' ').length };
  })
);

// ── Scoring ─────────────────────────────────────────────────────────────────

const PREFIX = /^[הובלמשכ]/;

/**
 * Endings that make another form of the SAME word — a plural, a construct, a
 * feminine — rather than a different word that happens to start the same way.
 * Normalised, so ים is ימ.
 */
const INFLECTIONS = new Set(['ימ', 'ות', 'ית', 'יות', 'יה', 'י', 'ה', 'ת', 's', 'es', 'ies']);

/**
 * The word as written, then with up to two glued-on prefix letters peeled off
 * (והלחם → הלחם → לחם). Each peel costs a little, so a word that means
 * something as written keeps that meaning.
 */
const formsOf = (word) => {
  const forms = [[word, 0]];
  if (word.length > 3 && PREFIX.test(word)) {
    const once = word.slice(1);
    forms.push([once, 30]);
    if (once.length > 3 && PREFIX.test(once)) forms.push([once.slice(1), 60]);
  }
  return forms;
};

/** One form against one keyword. Higher is better; 0 is no match. */
const scoreForm = (form, keyword) => {
  if (form === keyword) return 1000 + keyword.length;

  if (keyword.length >= 3 && form.startsWith(keyword)) {
    const tail = form.slice(keyword.length);
    // The same word, inflected — קרואסונים is קרואסון. Scored as all but exact,
    // so a plural head noun can still outrank an exact modifier by being the head.
    if (INFLECTIONS.has(tail)) return 995 + keyword.length;
    // One stray letter: בורקס off בורק, or a typo like בננב.
    if (tail.length === 1) return 560 + keyword.length;
    // A longer tail on a three-letter stem is a different word — פרילי is not
    // פרי and בקרדי is not בקר. Longer stems are distinctive enough to allow it.
    if (tail.length <= 3 && keyword.length >= 4) return 600 + keyword.length - tail.length * 40;
    return 0;
  }

  // Mid-word matches are only trustworthy for long, distinctive keywords.
  if (keyword.length >= 5 && form.includes(keyword)) return 200 + keyword.length;

  return 0;
};

const scoreWord = (word, keyword) => {
  let best = 0;
  for (const [form, cost] of formsOf(word)) {
    const score = scoreForm(form, keyword);
    if (score > 0) best = Math.max(best, score - cost);
  }
  return best;
};

/**
 * The word a phrase starts at, or -1 when it is not there. A phrase must begin
 * on a word boundary, but its last word may inflect (חד פעמי → חד פעמיות).
 */
const phraseStart = (text, phrase) => {
  const padded = ` ${text}`;
  const at = padded.indexOf(` ${phrase}`);
  if (at === -1) return -1;
  return (padded.slice(0, at).match(/ /g) || []).length;
};

/**
 * Which word is the head noun: the first in Hebrew, the last in English.
 * Only meaningful with two or more words, so -1 otherwise.
 */
const headOf = (words, text) => {
  const lettered = words.flatMap((word, index) => (LETTER.test(word) ? [index] : []));
  if (lettered.length < 2) return -1;
  return HEBREW.test(text) ? lettered[0] : lettered[lettered.length - 1];
};

/** How well one keyword matches this item, given its words and head noun. */
const scoreKeyword = ({ word: keyword, span }, text, words, head) => {
  if (span > 1) {
    const start = phraseStart(text, keyword);
    if (start === -1) return 0;
    const coversHead = head === -1 || (head >= start && head < start + span);
    return (coversHead ? PHRASE_SCORE : PHRASE_OFF_HEAD_SCORE) + keyword.length;
  }

  let score = 0;
  for (let index = 0; index < words.length; index += 1) {
    const hit = scoreWord(words[index], keyword);
    if (hit > 0) score = Math.max(score, hit + (index === head ? HEAD_BONUS : 0));
  }
  return score;
};

/**
 * @param {string} name what the user typed
 * @returns {string|null} a category key, or null when nothing looks like a match
 */
export function guessCategory(name) {
  const text = normalize(name);
  if (text.length < 2) return null;

  const words = text.split(' ');
  const head = headOf(words, text);

  for (const marker of MARKER_ENTRIES) {
    if (scoreKeyword(marker, text, words, head) > 0) return marker.category;
  }

  let best = { score: 0, category: null };
  for (const entry of ENTRIES) {
    const score = scoreKeyword(entry, text, words, head);
    if (score > best.score) best = { score, category: entry.category };
  }

  return best.category;
}
