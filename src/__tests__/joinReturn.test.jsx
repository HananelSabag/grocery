import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * How a new person gets onto a list: they open /join/<code> signed out, sign in
 * with Google, and Google puts them down on "/". Before the way back existed,
 * that is where it ended — on the empty list sign-up had just made for them —
 * and the person the link was sent to never joined. That happened to real
 * people, so the whole round trip is held here, not one helper at a time.
 */

const { auth, signInWithGoogle } = vi.hoisted(() => ({
  auth: { user: null, ready: true },
  signInWithGoogle: vi.fn(async () => ({ error: null })),
}));

const page = (text) => async () => {
  const { createElement } = await import('react');
  return { default: () => createElement('p', null, text) };
};

vi.mock('../lib/supabase', () => ({ signInWithGoogle }));
vi.mock('../lib/pwa', () => ({ checkForUpdate: vi.fn() }));
vi.mock('../stores/auth', () => ({ useAuth: () => auth }));
vi.mock('../components/InstallPrompt', () => ({ default: () => null }));
vi.mock('../components/UpdateGate', () => ({ default: () => null }));
vi.mock('../pages/ListPage', () => page('list page')());
vi.mock('../pages/JoinPage', () => page('join page')());
vi.mock('../pages/ProfilePage', () => ({ default: () => null }));
vi.mock('../pages/InvitePage', () => ({ default: () => null }));
vi.mock('../pages/AdminPage', () => ({ default: () => null }));

import App from '../App';
import SignIn from '../pages/SignIn';
import { useLanguage } from '../i18n';

const KEY = 'grocery_return_to';

describe('following a link as somebody new', () => {
  beforeEach(() => {
    localStorage.clear();
    signInWithGoogle.mockClear();
    auth.user = null;
    auth.ready = true;
    useLanguage.setState({ language: 'he' });
  });

  it('writes the link down before leaving for Google', () => {
    window.history.pushState({}, '', '/join/SMBRC8');
    try {
      render(<SignIn intent="join" />);
      fireEvent.click(screen.getByRole('button', { name: useLanguage.getState().t('auth.google') }));

      expect(signInWithGoogle).toHaveBeenCalled();
      expect(JSON.parse(localStorage.getItem(KEY)).path).toBe('/join/SMBRC8');
    } finally {
      window.history.pushState({}, '', '/');
    }
  });

  it('is taken back to the link when Google returns them to "/"', async () => {
    localStorage.setItem(KEY, JSON.stringify({ path: '/join/SMBRC8', at: Date.now() }));
    auth.user = { id: 'oriya' };

    render(
      <MemoryRouter initialEntries={['/?code=from-google']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText('join page')).toBeInTheDocument();
    // Once: opening the app tomorrow must not put them back on the link.
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('leaves somebody who simply opened the app on their list', async () => {
    auth.user = { id: 'nissim' };

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText('list page')).toBeInTheDocument();
    expect(screen.queryByText('join page')).not.toBeInTheDocument();
  });
});
