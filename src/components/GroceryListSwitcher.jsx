/**
 * GroceryListSwitcher — your lists, and the one place they are made, named and
 * removed.
 *
 * It used to appear only once you already had two lists, which in practice
 * meant only once somebody had shared theirs with you, and a list's name was
 * set somewhere else entirely, on the profile page. So the header changed shape
 * depending on data nobody could see, and naming the list you were on quietly
 * stopped the switcher telling other people whose list it was. Now the header
 * always opens this; every list says what it is called and, when it is not
 * yours, whose it is; and a new list is one line at the bottom.
 */

import React, { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Check, ListChecks, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';

import BottomSheet from './BottomSheet';
import { cn } from '../lib/helpers';
import { useTranslation } from '../i18n';

const MAX_NAME = 40;

const firstName = (full) => (full || '').trim().split(/\s+/)[0] || '';

/**
 * What to call a list. A name somebody chose wins. An unnamed list of your own
 * is simply "רשימת קניות"; an unnamed list of someone else's is called after
 * them, because two lists with the same name cannot be told apart.
 */
export const listLabel = (list, t) => {
  const name = list?.name?.trim();
  if (name) return name;
  if (list?.isOwn) return t('lists.defaultName');
  return t('lists.someones', { name: firstName(list?.ownerName) || t('lists.someone') });
};

const GroceryListSwitcher = ({
  isOpen, onClose, lists, activeListId, onSwitch, busyId, onCreate, onRename, onArchive,
}) => {
  const { t } = useTranslation();

  const [renamingId, setRenamingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);
  const [newName, setNewName] = useState('');
  const [working, setWorking] = useState(null);
  const renameRef = useRef(null);

  const ownCount = lists.filter((list) => list.isOwn).length;
  // Numbered by how many lists there are, so a second unnamed list is not a
  // second "רשימת קניות".
  const suggested = t('lists.newDefault', { n: lists.length + 1 });

  const reset = () => {
    setRenamingId(null);
    setDraftName('');
    setConfirmingId(null);
  };

  const close = () => {
    reset();
    setNewName('');
    onClose();
  };

  const startRename = (list) => {
    // Rendered synchronously so the field exists inside this tap: iOS only
    // raises the keyboard for a focus that happens during the gesture itself.
    flushSync(() => {
      setRenamingId(list.id);
      setDraftName(list.name ?? '');
      setConfirmingId(null);
    });
    renameRef.current?.focus();
    renameRef.current?.select();
  };

  // Blank is allowed only while this is your one list — it goes back to
  // "רשימת קניות". With several, a blank name is how two of them end up
  // called the same thing.
  const blankNotAllowed = (value) => !value.trim() && ownCount > 1;

  const saveRename = async (list) => {
    if (blankNotAllowed(draftName) || working) return;
    setWorking('rename');
    const ok = await onRename(list.id, draftName.trim());
    setWorking(null);
    if (ok) reset();
  };

  const create = async () => {
    if (working) return;
    setWorking('create');
    const id = await onCreate(newName.trim() || suggested);
    setWorking(null);
    if (id) setNewName('');
  };

  const archive = async (list) => {
    if (confirmingId !== list.id) {
      setConfirmingId(list.id);
      return;
    }
    if (working) return;
    setWorking('archive');
    const ok = await onArchive(list.id);
    setWorking(null);
    if (ok) reset();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={close} title={t('lists.title')}>
      <div className="space-y-4 px-4 pb-6 pt-1">
        <ul className="space-y-1.5">
          {lists.map((list) => {
            const active = String(list.id) === String(activeListId);
            const busy = String(list.id) === String(busyId);
            const renaming = renamingId === list.id;
            const confirming = confirmingId === list.id;
            const label = listLabel(list, t);
            const owner = firstName(list.ownerName);

            const details = [
              // An unnamed list of someone else's already says whose it is.
              !list.isOwn && list.name?.trim() && owner ? t('lists.ownedBy', { name: owner }) : null,
              list.openItems > 0 ? t('lists.openItems', { count: list.openItems }) : t('lists.empty'),
              list.memberCount > 1 ? t('lists.members', { count: list.memberCount }) : null,
            ].filter(Boolean).join(' · ');

            return (
              <li
                key={list.id}
                className={cn('glass overflow-hidden rounded-2xl', active && 'ring-2 ring-brand-500/70')}
              >
                {renaming ? (
                  <form
                    onSubmit={(event) => { event.preventDefault(); saveRename(list); }}
                    className="flex items-center gap-2 p-2"
                  >
                    <input
                      ref={renameRef}
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      maxLength={MAX_NAME}
                      placeholder={t('lists.defaultName')}
                      enterKeyHint="done"
                      aria-label={t('lists.rename')}
                      className="min-h-[44px] min-w-0 flex-1 rounded-xl bg-white/70 px-3 text-[16px] font-semibold
                                 text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-400
                                 focus:ring-2 focus:ring-brand-500/40 dark:bg-gray-800/60 dark:text-gray-50"
                    />
                    <button
                      type="submit"
                      disabled={blankNotAllowed(draftName) || working === 'rename'}
                      aria-label={t('common.save')}
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition active:scale-95',
                        blankNotAllowed(draftName)
                          ? 'bg-gray-200/60 text-gray-400 dark:bg-gray-700/50 dark:text-gray-600'
                          : 'gradient-action gradient-glow text-white'
                      )}
                    >
                      {working === 'rename' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={reset}
                      aria-label={t('common.cancel')}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-400
                                 transition active:scale-95 dark:text-gray-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => (active ? close() : onSwitch(list.id))}
                    disabled={!!busyId}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-3 text-start transition-opacity',
                      busyId && !busy && 'opacity-50'
                    )}
                  >
                    <span className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      active
                        ? 'gradient-action text-white'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    )}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {label}
                      </span>
                      <span className="block truncate text-xs text-gray-400 dark:text-gray-500">
                        {details}
                      </span>
                    </span>

                    {active && <Check className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />}
                  </button>
                )}

                {renaming && blankNotAllowed(draftName) && (
                  <p className="px-3 pb-2 text-[11px] text-amber-600 dark:text-amber-400">
                    {t('lists.nameRequired')}
                  </p>
                )}

                {/* Only the list you are on, and only if it is yours. Removing a
                    list is offered only while there is another one to land on. */}
                {active && list.isOwn && !renaming && (
                  <div className="border-t border-gray-200/60 px-2 py-1.5 dark:border-gray-700/50">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startRename(list)}
                        className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold
                                   text-gray-500 transition active:scale-95 dark:text-gray-400"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {t('lists.rename')}
                      </button>

                      {lists.length > 1 && (
                        <button
                          type="button"
                          onClick={() => archive(list)}
                          disabled={working === 'archive'}
                          className={cn(
                            'flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition active:scale-95',
                            confirming ? 'bg-red-500 text-white' : 'text-red-500'
                          )}
                        >
                          {working === 'archive'
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                          {confirming ? t('lists.archiveConfirmButton') : t('lists.archive')}
                        </button>
                      )}
                    </div>

                    {confirming && (
                      <p className="px-2.5 pb-1 pt-1 text-[11px] leading-snug text-red-500">
                        {list.memberCount > 1
                          ? t('lists.archiveConfirmShared', { name: label, count: list.memberCount - 1 })
                          : t('lists.archiveConfirm', { name: label })}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* A new list is one line, like adding an item: type, done. Always on
            screen rather than behind a "+" that opens it, so the tap that
            reaches for it is the tap that raises the keyboard. */}
        <form
          onSubmit={(event) => { event.preventDefault(); create(); }}
          className="border-t border-gray-100 pt-4 dark:border-gray-700/60"
        >
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {t('lists.create')}
          </h3>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              maxLength={MAX_NAME}
              placeholder={t('lists.createPlaceholder')}
              enterKeyHint="done"
              aria-label={t('lists.create')}
              className="glass min-h-[46px] min-w-0 flex-1 rounded-2xl bg-transparent px-4 text-[16px]
                         text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-50"
            />
            <button
              type="submit"
              disabled={working === 'create'}
              className="gradient-action gradient-glow flex min-h-[46px] shrink-0 items-center gap-1.5 rounded-2xl
                         px-4 text-sm font-bold text-white transition active:scale-95 disabled:opacity-70"
            >
              {working === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t('lists.createAction')}
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[11px] leading-snug text-gray-400 dark:text-gray-500">
            {t('lists.createHint', { name: suggested })}
          </p>
        </form>
      </div>
    </BottomSheet>
  );
};

export default GroceryListSwitcher;
