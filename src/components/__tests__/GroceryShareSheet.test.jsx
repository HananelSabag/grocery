import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { rotate } = vi.hoisted(() => ({
  rotate: { mutateAsync: vi.fn(async () => 'NEWCODE12345'), isPending: false },
}));

vi.mock('../../hooks/useSharing', () => ({
  useGrocerySharing: () => ({ removeMember: vi.fn(), leaveList: vi.fn(), disband: vi.fn() }),
  useRotateJoinCode: () => rotate,
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import GroceryShareSheet from '../GroceryShareSheet';

const LIST = { id: 9, name: null, owner_id: 'owner', join_code: 'ABCDEFGHJKLM' };
const MEMBERS = [
  { id: 1, user_id: 'owner', role: 'owner', first_name: 'Hananel' },
  { id: 2, user_id: 'wife', role: 'member', first_name: 'נופר' },
];

const renderSheet = (overrides = {}) => render(
  <GroceryShareSheet
    isOpen
    onClose={vi.fn()}
    members={MEMBERS}
    role="owner"
    currentUserId="owner"
    list={LIST}
    {...overrides}
  />
);

describe('GroceryShareSheet', () => {
  const link = `${window.location.origin}/join/ABCDEFGHJKLM`;

  beforeEach(() => {
    rotate.mutateAsync.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn(async () => {}),
    });
  });

  afterEach(() => {
    delete navigator.share;
  });

  it('is a link and nothing else — no code on the screen, no field to type one into', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: /שליחת הקישור/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /העתקת קישור/ })).toBeInTheDocument();
    expect(screen.queryByText('ABCDEFGHJKLM')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('copies the link', async () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: /העתקת קישור/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(link));
    expect(await screen.findByRole('button', { name: /הקישור הועתק/ })).toBeInTheDocument();
  });

  it('sends the link through the phone\'s share sheet', async () => {
    renderSheet({ list: { ...LIST, name: 'אילת' } });
    fireEvent.click(screen.getByRole('button', { name: /שליחת הקישור/ }));
    await waitFor(() => expect(navigator.share).toHaveBeenCalledWith(
      expect.objectContaining({ url: link, text: expect.stringContaining('אילת') })
    ));
  });

  it('offers only the copy where a device has no share sheet', () => {
    delete navigator.share;
    renderSheet();
    expect(screen.queryByRole('button', { name: /שליחת הקישור/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /העתקת קישור/ })).toBeInTheDocument();
  });

  it('asks before replacing the link, and only the owner can', async () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: /החלפת קישור/ }));
    expect(rotate.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/הקישור הנוכחי יפסיק לעבוד/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /כן, להחליף/ }));
    await waitFor(() => expect(rotate.mutateAsync).toHaveBeenCalledWith(9));
  });

  it('does not offer a member the replace', () => {
    renderSheet({ role: 'member', currentUserId: 'wife' });
    expect(screen.queryByRole('button', { name: /החלפת קישור/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /העתקת קישור/ })).toBeInTheDocument();
  });
});
