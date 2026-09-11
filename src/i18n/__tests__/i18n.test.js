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
    expect(t('list.addItem')).toBe(he.list.addItem);
  });

  it('interpolates', () => {
    const { t } = useLanguage.getState();
    expect(t('list.itemsLeft', { count: 3 })).toContain('3');
  });

  it('switches language', () => {
    useLanguage.getState().setLanguage('en');
    expect(useLanguage.getState().t('list.addItem')).toBe(en.list.addItem);
  });

  it('returns the key itself when a string is missing, so gaps are visible', () => {
    const { t } = useLanguage.getState();
    expect(t('nope.not.here')).toBe('nope.not.here');
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
