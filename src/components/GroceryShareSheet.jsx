/**
 * GroceryShareSheet — the link that gets someone onto this list, and who is on it.
 *
 * The link sits in a box of its own, shortened to fit, with the copy button
 * inside it; the phone's share sheet is the one big button under it. That is all
 * of sharing. It went through a one-time link that its first tap used up, and
 * then a code on screen with a field to type one into — both answering questions
 * nobody was asking.
 *
 * The link is permanent: the list's standing code in a URL, so it works in a
 * family chat, for whoever it gets forwarded to, and next month. Replacing it is
 * a small icon at the end of the box, because it is rarely needed — a link that
 * reached someone it should not have, or someone removed who should not walk
 * back in — and the tooltip it opens says what replacing breaks before anything
 * is replaced.
 *
 * Every list has its own link, and a person on two lists shares whichever one
 * is on screen. So the title says which list that is.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Loader2, LogOut, RefreshCw, Share2, UserMinus } from 'lucide-react';

import BottomSheet from './BottomSheet';
import { listLabel } from './GroceryListSwitcher';
import { cn } from '../lib/helpers';
import { useTranslation } from '../i18n';
import { useToast } from '../hooks/useToast';
import { useGrocerySharing, useRotateJoinCode } from '../hooks/useSharing';

const displayNameOf = (member) =>
  [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username;

const MemberAvatar = ({ member }) => (
  // `avatar_url` is what the hook resolves — uploaded picture first, then the
  // Google one.
  member.avatar_url
    ? <img src={member.avatar_url} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" />
    : (
      <span className="gradient-action flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white">
        {(member.first_name || member.username || '?').charAt(0).toUpperCase()}
      </span>
    )
);

/** The phone's own share sheet — the shortest way into WhatsApp. Absent on some desktops. */
const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/** The scheme is the one part of an address nobody reads, and the box is narrow. */
const withoutScheme = (link) => link.replace(/^https?:\/\//, '');

const COPIED_MS = 2500;

const GroceryShareSheet = ({ isOpen, onClose, members, role, currentUserId, list }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { removeMember, leaveList, disband } = useGrocerySharing();
  const rotate = useRotateJoinCode();
  const tipId = useId();

  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [confirming, setConfirming] = useState(null);

  const tipRef = useRef(null);
  const tipButtonRef = useRef(null);

  const isOwner = role === 'owner';
  const listId = list?.id ?? null;
  const link = list?.join_code ? `${window.location.origin}/join/${list.join_code}` : null;
  const sharable = canShare();

  const name = list
    ? listLabel({
      name: list.name,
      isOwn: list.owner_id === currentUserId,
      ownerName: members.find((member) => member.user_id === list.owner_id)?.first_name,
    }, t)
    : null;

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setCopyFailed(false);
      setTipOpen(false);
      setConfirming(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  // The tooltip goes away the way a tooltip does: a tap anywhere else, or Escape.
  useEffect(() => {
    if (!tipOpen) return undefined;
    const onPointerDown = (event) => {
      if (tipRef.current?.contains(event.target)) return;
      if (tipButtonRef.current?.contains(event.target)) return;
      setTipOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setTipOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [tipOpen]);

  const copy = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopyFailed(false);
      setCopied(true);
    } catch {
      // Some in-app browsers refuse the clipboard; the link is shown in full
      // instead, ready to select.
      setCopyFailed(true);
    }
  }, [link]);

  const share = useCallback(async () => {
    if (!link) return;
    const listName = list?.name?.trim();
    try {
      await navigator.share({
        title: t('app.name'),
        text: listName ? t('share.messageNamed', { name: listName }) : t('share.message'),
        url: link,
      });
    } catch {
      /* dismissed */
    }
  }, [link, list?.name, t]);

  const replace = useCallback(async () => {
    try {
      await rotate.mutateAsync(listId);
      setTipOpen(false);
      setCopied(false);
      setCopyFailed(false);
      toast.success(t('share.linkReplaced'));
    } catch {
      toast.error(t('errors.GROCERY_OWNER_ONLY', { fallback: t('errors.generic') }));
    }
  }, [rotate, listId, toast, t]);

  const remove = useCallback(async (member) => {
    const key = `member-${member.id}`;
    if (confirming !== key) {
      setConfirming(key);
      return;
    }
    setConfirming(null);
    // The membership row's id, not the user's. A failure comes back as null,
    // and the hook has already said so.
    const result = await removeMember(member.id);
    // Removed is not the same as kept out: the link still works for them.
    if (result !== null) toast.success(t('share.removed', { name: displayNameOf(member) }));
  }, [confirming, removeMember, toast, t]);

  const exit = useCallback(() => {
    if (confirming !== 'exit') {
      setConfirming('exit');
      return;
    }
    setConfirming(null);
    if (isOwner) {
      disband(listId);
    } else {
      // Which list — without it this removed every membership the user had,
      // their own list included.
      leaveList(listId);
      onClose();
    }
  }, [confirming, isOwner, disband, leaveList, listId, onClose]);

  const title = name ? (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span className="shrink-0">{t('share.title')}</span>
      {' '}
      <span aria-hidden="true" className="shrink-0 text-gray-400 dark:text-gray-500">·</span>
      {' '}
      <span dir="auto" className="truncate font-medium text-gray-500 dark:text-gray-400">{name}</span>
    </span>
  ) : t('share.title');

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-5 px-4 pb-6 pt-4">

        {link && (
          <section className="relative">
            <div
              className={cn(
                'flex h-12 items-stretch overflow-hidden rounded-2xl border transition-colors',
                copied
                  ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10'
                  : 'border-gray-200 bg-white/80 dark:border-gray-700 dark:bg-gray-900/40'
              )}
            >
              <button
                type="button"
                onClick={copy}
                aria-label={copied ? t('share.copied') : t('share.copyLink')}
                className="flex min-w-0 flex-1 items-stretch transition-colors active:bg-gray-100/80 dark:active:bg-gray-800/60"
              >
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 border-e px-3.5 text-[13px] font-bold',
                    copied
                      ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'border-gray-200 text-brand-600 dark:border-gray-700 dark:text-brand-400'
                  )}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? t('share.copiedShort') : t('share.copy')}
                </span>

                {/* Keyed on the link, so a replaced one visibly arrives. */}
                <motion.span
                  key={link}
                  dir="ltr"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="flex min-w-0 flex-1 items-center px-3 text-[13px] text-gray-600 dark:text-gray-300"
                >
                  <span className="truncate">{withoutScheme(link)}</span>
                </motion.span>
              </button>

              {isOwner && (
                <button
                  ref={tipButtonRef}
                  type="button"
                  onClick={() => setTipOpen((open) => !open)}
                  aria-label={t('share.replaceLink')}
                  aria-expanded={tipOpen}
                  aria-controls={tipId}
                  title={t('share.replaceLink')}
                  className={cn(
                    'flex w-11 shrink-0 items-center justify-center border-s transition-colors',
                    'border-gray-200 dark:border-gray-700',
                    tipOpen
                      ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                      : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                  )}
                >
                  <RefreshCw className={cn('h-4 w-4', rotate.isPending && 'animate-spin')} />
                </button>
              )}
            </div>

            {/* Floats over what is under it rather than pushing it down: it is
                a second's reading, and the sheet should not jump for it. */}
            <AnimatePresence>
              {tipOpen && (
                <motion.div
                  ref={tipRef}
                  id={tipId}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute end-0 top-14 z-20 w-72 max-w-full rounded-2xl bg-gray-900 p-3.5 text-white
                             shadow-2xl dark:bg-gray-700"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 end-4 h-3 w-3 rotate-45 rounded-[2px] bg-gray-900 dark:bg-gray-700"
                  />
                  <p className="text-[13px] font-bold">{t('share.replaceLink')}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-gray-300 dark:text-gray-200">
                    {t('share.replaceLinkTip')}
                  </p>
                  <button
                    type="button"
                    onClick={replace}
                    disabled={rotate.isPending}
                    className="mt-3 flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl bg-white
                               text-[13px] font-bold text-red-600 transition active:scale-[0.98] disabled:opacity-70"
                  >
                    {rotate.isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />}
                    {t('share.replaceLinkConfirm')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {sharable && (
              <button
                type="button"
                onClick={share}
                className="gradient-action gradient-glow mt-3 flex min-h-[48px] w-full items-center justify-center
                           gap-2 rounded-2xl text-[15px] font-bold text-white transition active:scale-[0.98]"
              >
                <Share2 className="h-4 w-4" />
                {t('share.send')}
              </button>
            )}

            {copyFailed && (
              <div className="mt-3">
                <p className="px-1 text-xs text-amber-700 dark:text-amber-300">{t('share.copyFailed')}</p>
                <p
                  dir="ltr"
                  className="mt-1 select-all break-all rounded-xl bg-gray-100 px-3 py-2 text-xs text-gray-700
                             dark:bg-gray-800 dark:text-gray-200"
                >
                  {link}
                </p>
              </div>
            )}

            <p className="mt-2 px-1 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
              {t('share.linkHint')}
            </p>
          </section>
        )}

        <section className={cn(link && 'border-t border-gray-100 pt-4 dark:border-gray-700/60')}>
          <h3 className="mb-2 text-xs font-bold tracking-wide text-gray-400 dark:text-gray-500">
            {t('share.manage')}
          </h3>

          <ul className="space-y-1.5">
            {members.map((member) => {
              const armed = confirming === `member-${member.id}`;
              return (
                <li key={member.user_id} className="glass flex items-center gap-3 rounded-xl px-3 py-2">
                  <MemberAvatar member={member} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {displayNameOf(member)}
                      {member.user_id === currentUserId && (
                        <span className="ms-1.5 text-xs font-medium text-gray-400">
                          ({t('share.you')})
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                      {member.role === 'owner' ? t('share.roleOwner') : t('share.roleMember')}
                    </p>
                  </div>

                  {isOwner && member.role !== 'owner' && (
                    <button
                      type="button"
                      onClick={() => remove(member)}
                      aria-label={t('share.remove')}
                      className={cn(
                        'flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors',
                        armed ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-red-500'
                      )}
                    >
                      <UserMinus className="h-4 w-4" />
                      {armed && t('share.remove')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {members.length <= 1 && (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{t('share.alone')}</p>
          )}

          {/* Leaving, or for the owner stopping the share. Quiet on purpose, and
              absent for the owner of a list nobody else is on. */}
          {(!isOwner || members.length > 1) && (
            <button
              type="button"
              onClick={exit}
              className={cn(
                'mt-3 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2',
                'text-center text-[13px] font-semibold leading-snug transition',
                confirming === 'exit' ? 'bg-red-500 text-white' : 'text-red-500'
              )}
            >
              {isOwner
                ? <UserMinus className="h-4 w-4 shrink-0" />
                : <LogOut className="h-4 w-4 shrink-0 rtl:-scale-x-100" />}
              {confirming === 'exit'
                ? t(isOwner ? 'share.disbandConfirm' : 'share.leaveConfirm')
                : t(isOwner ? 'share.disband' : 'share.leave')}
            </button>
          )}
        </section>
      </div>
    </BottomSheet>
  );
};

export default GroceryShareSheet;
