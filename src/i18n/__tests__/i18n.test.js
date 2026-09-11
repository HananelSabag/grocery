import { beforeEach, describe, expect, it } from 'vitest';
import { useLanguage } from '../index';
import he from '../he';
import en from '../en';

describe('translations', () => {
  beforeEach(() => {
    useLanguage.setState({ language: 'he' });
  });

  it('resolves a dotted key', () => {
    const { t } = useLanguage.getState();
    expect(t('quickAdd.placeholder')).toBe(he.quickAdd.placeholder);
  });

  it('interpolates', () => {
    const { t } = useLanguage.getState();
    expect(t('progress.remaining', { count: 3 })).toContain('3');
  });

  it('switches language', () => {
    useLanguage.getState().setLanguage('en');
    expect(useLanguage.getState().t('quickAdd.placeholder')).toBe(en.quickAdd.placeholder);
  });

  it('returns the key itself when a string is missing, so gaps are visible', () => {
    const { t } = useLanguage.getState();
    expect(t('nope.not.here')).toBe('nope.not.here');
  });

  it('prefers an explicit fallback over the raw key', () => {
    // How the ported components render server error codes: most codes have no
    // string of their own and must land on the generic message, not on
    // "errors.GROCERY_SOMETHING_UNMAPPED".
    const { t } = useLanguage.getState();
    expect(t('errors.NOT_A_REAL_CODE', { fallback: 'בעיה' })).toBe('בעיה');
    // A key that DOES exist still wins over the fallback.
    expect(t('quickAdd.add', { fallback: 'nope' })).toBe(he.quickAdd.add);
  });

  it('keeps he and en in step', () => {
    // A key present in one bundle and not the other is a half-translated
    // feature, and the only way to notice is to compare the shapes.
    const flatten = (object, prefix = '') =>
      Object.entries(object).flatMap(([key, value]) =>
        typeof value === 'string'
          ? [`${prefix}${key}`]
          : flatten(value, `${prefix}${key}.`)
      );

    expect(flatten(en).sort()).toEqual(flatten(he).sort());
  });
});
