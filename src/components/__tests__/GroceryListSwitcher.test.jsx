import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import GroceryListSwitcher, { listLabel } from '../GroceryListSwitcher';
import { useLanguage } from '../../i18n';

const LISTS = [
  { id: 9, name: null, isOwn: true, ownerName: 'Hananel Sabag', memberCount: 3, openItems: 5 },
  { id: 20, name: 'אילת', isOwn: true, ownerName: 'Hananel Sabag', memberCount: 1, openItems: 0 },
  { id: 12, name: null, isOwn: false, ownerName: 'נופר רומי', memberCount: 1, openItems: 2 },
  { id: 17, name: 'סופר', isOwn: false, ownerName: 'משה עקיבא', memberCount: 2, openItems: 12 },
];

const renderSwitcher = (overrides = {}) => {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    lists: LISTS,
    activeListId: 9,
    onSwitch: vi.fn(),
    busyId: null,
    onCreate: vi.fn(async () => 99),
    onRename: vi.fn(async () => true),
    onArchive: vi.fn(async () => true),
    ...overrides,
  };
  render(<GroceryListSwitcher {...props} />);
  return props;
};

describe('listLabel', () => {
  const { t } = useLanguage.getState();

  it('uses a name somebody chose', () => {
    expect(listLabel({ name: '  אילת ', isOwn: true }, t)).toBe('אילת');
  });

  it('calls your own unnamed list the default, and someone else\'s after them', () => {
    // Two lists with the same name cannot be told apart, which is what the
    // switcher is for — so an unnamed list of someone else's says whose it is.
    expect(listLabel({ name: null, isOwn: true }, t)).toBe('רשימת קניות');
    expect(listLabel({ name: null, isOwn: false, ownerName: 'נופר רומי' }, t)).toBe('הרשימה של נופר');
  });
});

describe('GroceryListSwitcher', () => {
  it('names every list, and says whose a named list of someone else\'s is', () => {
    renderSwitcher();
    expect(screen.getByText('רשימת קניות')).toBeInTheDocument();
    expect(screen.getByText('אילת')).toBeInTheDocument();
    expect(screen.getByText('הרשימה של נופר')).toBeInTheDocument();
    expect(screen.getByText('סופר')).toBeInTheDocument();
    expect(screen.getByText(/של משה/)).toBeInTheDocument();
  });

  it('creates a list under a numbered name when the field is left blank', async () => {
    const { onCreate } = renderSwitcher();
    fireEvent.click(screen.getByRole('button', { name: /יצירה/ }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('רשימה 5'));
  });

  it('creates a list under the name that was typed', async () => {
    const { onCreate } = renderSwitcher();
    fireEvent.change(screen.getByPlaceholderText(/למשל/), { target: { value: '  ים המלח ' } });
    fireEvent.click(screen.getByRole('button', { name: /יצירה/ }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('ים המלח'));
  });

  it('will not blank a name while there is more than one list of your own', async () => {
    const { onRename } = renderSwitcher();
    fireEvent.click(screen.getByRole('button', { name: /שינוי שם/ }));

    const field = screen.getByRole('textbox', { name: 'שינוי שם' });
    fireEvent.change(field, { target: { value: '' } });

    expect(screen.getByRole('button', { name: 'שמור' })).toBeDisabled();
    expect(screen.getByText('כשיש כמה רשימות, לכל אחת צריך שם')).toBeInTheDocument();
    fireEvent.submit(field.closest('form'));
    expect(onRename).not.toHaveBeenCalled();
  });

  it('asks before deleting a list', async () => {
    const { onArchive } = renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: /מחיקה/ }));
    expect(onArchive).not.toHaveBeenCalled();
    expect(screen.getByText(/תימחק גם אצל 2 אנשים נוספים/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /כן, למחוק/ }));
    await waitFor(() => expect(onArchive).toHaveBeenCalledWith(9));
  });

  it('offers no delete when it is the only list there is', () => {
    renderSwitcher({ lists: [LISTS[0]] });
    expect(screen.queryByRole('button', { name: /מחיקה/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /שינוי שם/ })).toBeInTheDocument();
  });
});
