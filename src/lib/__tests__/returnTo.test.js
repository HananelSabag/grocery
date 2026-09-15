import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rememberReturnTo, takeReturnTo } from '../returnTo';

describe('returnTo', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('brings a person back to the link they signed in from, once', () => {
    rememberReturnTo('/join/ABCDEFGHJKLM');
    expect(takeReturnTo()).toBe('/join/ABCDEFGHJKLM');
    // Read once: opening the app the next time must not bounce them back.
    expect(takeReturnTo()).toBeNull();
  });

  it('has nothing to remember for the list itself', () => {
    rememberReturnTo('/');
    expect(takeReturnTo()).toBeNull();
  });

  it('forgets a destination that has gone stale', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T10:00:00Z'));
    rememberReturnTo('/join/ABCDEFGHJKLM');
    vi.setSystemTime(new Date('2026-09-15T10:31:00Z'));
    expect(takeReturnTo()).toBeNull();
  });

  it('only ever sends a person somewhere on this site', () => {
    localStorage.setItem('grocery_return_to', JSON.stringify({ path: '//evil.example/x', at: Date.now() }));
    expect(takeReturnTo()).toBeNull();

    localStorage.setItem('grocery_return_to', JSON.stringify({ path: 'https://evil.example', at: Date.now() }));
    expect(takeReturnTo()).toBeNull();
  });
});
