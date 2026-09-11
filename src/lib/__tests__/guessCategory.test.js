import { describe, expect, it } from 'vitest';
import { guessCategory } from '../guessCategory';

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
});
