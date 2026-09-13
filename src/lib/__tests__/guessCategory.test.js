import { describe, expect, it } from 'vitest';
import { guessCategory } from '../guessCategory';
import { CORPUS } from './groceryCorpus';

describe('guessCategory', () => {
  it('files common Hebrew items in the right aisle', () => {
    expect(guessCategory('חלב')).toBe('dairy_eggs');
    expect(guessCategory('לחם')).toBe('bakery');
    expect(guessCategory('עגבניות')).toBe('produce');
    expect(guessCategory('שניצל')).toBe('meat_fish');
  });

  it('scores whole words above prefixes, so שוקו is not meat', () => {
    // "שוק" (a drumstick) is a prefix of "שוקו" (chocolate milk). A first-
    // substring-wins match files chocolate milk under meat; this is the case
    // the scoring exists for.
    expect(guessCategory('שוקו')).toBe('dairy_eggs');
    expect(guessCategory('שוק עוף')).toBe('meat_fish');
  });

  it('sees through a glued one-letter Hebrew prefix', () => {
    expect(guessCategory('הלחם')).toBe('bakery');
    expect(guessCategory('וחלב')).toBe('dairy_eggs');
    expect(guessCategory('והביצים')).toBe('dairy_eggs');
  });

  it('reads a word that merely STARTS with a prefix letter as written', () => {
    // The bug that got reported: ב ה ו כ ל מ ש were peeled off every word that
    // began with one, unconditionally, so "בננה" was scored as "ננה" and
    // matched nothing. The live database had בננה twice, בננות and a typo
    // בננב — every one of them filed under "other".
    expect(guessCategory('בננה')).toBe('produce');
    expect(guessCategory('בננות')).toBe('produce');
    expect(guessCategory('מלפפונים')).toBe('produce');
    expect(guessCategory('משמשים')).toBe('produce');
    expect(guessCategory('לחמניות')).toBe('bakery');
    expect(guessCategory('שקדים')).toBe('pantry');
    expect(guessCategory('מעדנים')).toBe('dairy_eggs');
  });

  it('normalises the ways the same word gets typed', () => {
    // Every apostrophe a keyboard produces, and the Hebrew geresh.
    expect(guessCategory("צ'יפס")).toBe(guessCategory('צ׳יפס'));
    expect(guessCategory("קוטג'")).toBe('dairy_eggs');
    // Final letters, so a stem still meets its plural.
    expect(guessCategory('לימונים')).toBe('produce');
    expect(guessCategory('דובדבנים')).toBe('produce');
    // Doubled yod / vav.
    expect(guessCategory('עגבנייה')).toBe('produce');
    expect(guessCategory('וויסקי')).toBe('alcohol');
    // Gershayim and hyphens.
    expect(guessCategory('תפו"א')).toBe('produce');
    expect(guessCategory('כוסות חד-פעמיות')).toBe('disposables');
  });

  it('lets a deciding word overrule the rest of the item', () => {
    expect(guessCategory('שעועית ירוקה קפואה')).toBe('frozen');
    expect(guessCategory('ברוקולי קפוא')).toBe('frozen');
    expect(guessCategory('צלחות חד פעמיות')).toBe('disposables');
  });

  it('prefers the head noun when two words disagree', () => {
    // Hebrew puts the head first, English last.
    expect(guessCategory('עוגת שוקולד')).toBe('bakery');
    expect(guessCategory('מיץ לימון')).toBe('beverages');
    expect(guessCategory('רסק עגבניות')).toBe('pantry');
    expect(guessCategory('orange juice')).toBe('beverages');
    expect(guessCategory('chocolate milk')).toBe('dairy_eggs');
  });

  it('derives the construct forms the dictionary does not spell out', () => {
    expect(guessCategory('ריבת תות')).toBe('pantry');
    expect(guessCategory('חטיפי אנרגיה')).toBe('snacks_sweets');
    expect(guessCategory('מגשי אלומיניום')).toBe('disposables');
    expect(guessCategory('נורת לד')).toBe('household');
  });

  it('files an item by who or what it is for', () => {
    // What it is for beats what it is made of.
    expect(guessCategory('שמפו לתינוק')).toBe('baby');
    expect(guessCategory('קפסולות למדיח')).toBe('household');
    expect(guessCategory('שמן לגוף')).toBe('personal_care');
  });

  it('does not let a phrase outside the head noun take over', () => {
    expect(guessCategory('לביבות תפוחי אדמה')).toBe('frozen');
    expect(guessCategory('בורקס תפוחי אדמה')).toBe('bakery');
  });

  it('treats an inflected head noun as the word itself', () => {
    // A plural is the same word, so it keeps the head noun's say against an
    // exact modifier from another aisle.
    expect(guessCategory('קרואסונים חמאה')).toBe('bakery');
  });

  it('does not let a three-letter stem swallow an unrelated word', () => {
    expect(guessCategory('בקרדי')).toBe('alcohol');
    expect(guessCategory('פרילי')).not.toBe('produce');
  });

  it('handles English too', () => {
    expect(guessCategory('milk')).toBe('dairy_eggs');
    expect(guessCategory('tomatoes')).toBe('produce');
  });

  it('returns null rather than guessing at nothing', () => {
    expect(guessCategory('')).toBeNull();
    expect(guessCategory('x')).toBeNull();
    expect(guessCategory('זזזזז')).toBeNull();
  });

  it('files every item in the corpus', () => {
    // Collected rather than asserted one at a time, so a failure lists exactly
    // which items moved instead of stopping at the first.
    const misses = CORPUS
      .map(([text, expected]) => ({ text, expected, got: guessCategory(text) }))
      .filter(({ expected, got }) => expected !== got);

    expect(misses).toEqual([]);
  });
});
