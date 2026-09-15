import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { rotate, sharing, toast } = vi.hoisted(() => ({
  rotate: { mutateAsync: vi.fn(async () => 'NEWCODE12345'), isPending: false },
  sharing: { removeMember: vi.fn(async () => undefined), leaveList: vi.fn(), disband: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../hooks/useSharing', () => ({
  useGrocerySharing: () => sharing,
  useRotateJoinCode: () => rotate,
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => toast,
}));

import GroceryShareSheet from '../GroceryShareSheet';

const LIST = { id: 13, name: null, owner_id: 'nissim', join_code: 'ABCDEFGHJKLM' };
const MEMBERS = [
  { id: 1, user_id: 'nissim', role: 'owner', first_name: 'Nissim' },
  { id: 2, user_id: 'oriya', role: 'member', first_name: 'אוריה' },
];

const props = (overrides = {}) => ({
  isOpen: true,
  onClose: vi.fn(),
  members: MEMBERS,
  role: 'owner',
  currentUserId: 'nissim',
  list: LIST,
  ...overrides,
});

const renderSheet = (overrides) => render(<GroceryShareSheet {...props(overrides)} />);

/** A phrase from the tooltip that explains replacing the link. */
const TIP = /הישן מפסיק לעבוד/;

describe('GroceryShareSheet', () => {
  const link = `${window.location.origin}/join/ABCDEFGHJKLM`;
  const copyButton = () => screen.getByRole('button', { name: /העתקת קישור/ });
  const replaceButton = () => screen.getByRole('button', { name: 'החלפת קישור' });

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('shows the link in a box with the copy button inside it, and no code on its own', () => {
    renderSheet();
    expect(copyButton()).toHaveTextContent(link.replace(/^https?:\/\//, ''));
    expect(copyButton()).toHaveTextContent('העתקה');
    expect(screen.queryByText('ABCDEFGHJKLM')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('copies the whole link, scheme and all', async () => {
    renderSheet();
    fireEvent.click(copyButton());
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(link));
    expect(await screen.findByRole('button', { name: /הקישור הועתק/ })).toHaveTextContent('הועתק');
  });

  it('puts the link out to select by hand when the clipboard is refused', async () => {
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
    renderSheet();
    fireEvent.click(copyButton());
    expect(await screen.findByText(link)).toBeInTheDocument();
  });

  it("sends the link through the phone's share sheet, from the button under the box", async () => {
    renderSheet({ list: { ...LIST, name: 'אילת' } });
    fireEvent.click(screen.getByRole('button', { name: /שליחת הקישור/ }));
    await waitFor(() => expect(navigator.share).toHaveBeenCalledWith(
      expect.objectContaining({ url: link, text: expect.stringContaining('אילת') })
    ));
  });

  it('leaves copying to itself where a device has no share sheet', () => {
    delete navigator.share;
    renderSheet();
    expect(screen.queryByRole('button', { name: /שליחת הקישור/ })).not.toBeInTheDocument();
    expect(copyButton()).toBeInTheDocument();
  });

  it('says which list it shares, because every list has a link of its own', () => {
    // Somebody on a friend's list as well as their own must be able to tell
    // which of the two they are about to send.
    const { rerender } = renderSheet({ role: 'member', currentUserId: 'oriya' });
    expect(screen.getByRole('heading', { name: /הרשימה של Nissim/ })).toBeInTheDocument();

    rerender(<GroceryShareSheet {...props({ list: { ...LIST, name: 'אילת' } })} />);
    expect(screen.getByRole('heading', { name: /אילת/ })).toBeInTheDocument();
  });

  it('replaces the link only from its tooltip, which first says what that breaks', async () => {
    renderSheet();
    fireEvent.click(replaceButton());
    expect(rotate.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(TIP)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /להחליף את הקישור/ }));
    await waitFor(() => expect(rotate.mutateAsync).toHaveBeenCalledWith(13));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('closes the tooltip on a tap anywhere else, replacing nothing', () => {
    renderSheet();
    fireEvent.click(replaceButton());
    expect(replaceButton()).toHaveAttribute('aria-expanded', 'true');

    fireEvent.pointerDown(document.body);
    expect(replaceButton()).toHaveAttribute('aria-expanded', 'false');
    expect(rotate.mutateAsync).not.toHaveBeenCalled();
  });

  it('offers a member no replace', () => {
    renderSheet({ role: 'member', currentUserId: 'oriya' });
    expect(screen.queryByRole('button', { name: 'החלפת קישור' })).not.toBeInTheDocument();
    expect(copyButton()).toBeInTheDocument();
  });

  it('after removing someone, says the link would still let them back in', async () => {
    renderSheet();
    const remove = screen.getByRole('button', { name: 'הסר' });
    fireEvent.click(remove);
    expect(sharing.removeMember).not.toHaveBeenCalled();

    fireEvent.click(remove);
    await waitFor(() => expect(sharing.removeMember).toHaveBeenCalledWith(2));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('אוריה')));
  });
});
