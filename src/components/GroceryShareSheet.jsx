/**
 * GroceryShareSheet — who is on the list, and how someone else gets on it.
 *
 * Sharing is a code, not a link that gets used up.
 *
 * The previous version handed out a one-time token in a URL: the first person
 * to open it was added and the link was spent. Send it to a family chat, have
 * your wife open it, then open it yourself to check it arrived, and the second
 * tap says "invitation not found". It also expired after fourteen days without
 * saying so, and there was no answer to "what is this link, how long does it
 * last, how do I change it" — which is what got asked.
 *
 * The code answers all three by existing. It is the same code tomorrow. Anyone
 * holding it can join. Replacing it is the only revocation anyone wants, and
 * it is one button. The link still exists — it is just the code in a URL — so
 * one tap still works for the person who prefers that.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Loader2, LogOut, RefreshCw, Share2, UserMinus, UserPlus } from 'lucide-react';

import BottomSheet from './BottomSheet';
import { cn } from '../lib/helpers';
import { useTranslation } from '../i18n';
import { useToast } from '../hooks/useToast';
import {
  useGrocerySharing,
  useJoinList,
  useMyGroceryInvitations,
  useRotateJoinCode,
} from '../hooks/useSharing';

const displayNameOf = (member) =>
  [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username;

const MemberAvatar = ({ member }) => (
  // `avatar_url` is what the hook resolves — uploaded picture first, then the
  // Google one. It used to read `member.avatar`, which nothing ever set, so
  // every member wore an initial even when they had a face.
  member.avatar_url
    ? <img src={member.avatar_url} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" />
    : (
      <span className="gradient-action flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white">
        {(member.first_name || member.username || '?').charAt(0).toUpperCase()}
      </span>
    )
);

const CODE_LENGTH = 6;

const GroceryShareSheet = ({ isOpen, onClose, members, role, currentUserId, list }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { removeMember, leaveList, disband, respond } = useGrocerySharing();
  const { invitations: myInvitations } = useMyGroceryInvitations();
  const rotate = useRotateJoinCode();
  const join = useJoinList();

  const [copied, setCopied] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [entered, setEntered] = useState('');

  const isOwner = role === 'owner';
  const code = list?.join_code ?? null;
  const listId = list?.id ?? null;
  const joinUrl = code ? `${window.location.origin}/join/${code}` : null;

  useEffect(() => {
    if (!isOpen) { setCopied(null); setConfirming(null); setEntered(''); }
  }, [isOpen]);

  const copy = useCallback(async (text, which) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      // Clipboard access can be blocked; the code is on screen and selectable.
      toast.error(t('share.copyFailed'));
    }
  }, [t, toast]);

  /**
   * The phone's own share sheet when there is one — that is the shortest path
   * to WhatsApp, which is where this actually gets sent. Desktop has no such
   * thing, so there it becomes a copy.
   */
  const handleShare = useCallback(async () => {
    if (!joinUrl) return;
    const text = t('share.message', { code });

    if (navigator.share) {
      try {
        await navigator.share({ title: t('app.name'), text, url: joinUrl });
        return;
      } catch {
        // Cancelled, or refused by the browser — fall through to the clipboard
        // rather than leaving the tap with nothing to show for it.
      }
    }
    await copy(`${text}\n${joinUrl}`, 'link');
  }, [joinUrl, code, copy, t]);

  const handleRotate = useCallback(async () => {
    if (!listId) return;
    try {
      await rotate.mutateAsync(listId);
      setConfirming(null);
      toast.success(t('share.codeChanged'));
    } catch {
      toast.error(t('errors.GROCERY_OWNER_ONLY', { fallback: t('errors.generic') }));
    }
  }, [listId, rotate, t, toast]);

  const handleJoin = useCallback(async () => {
    const value = entered.trim().toUpperCase();
    if (value.length !== CODE_LENGTH) return;
    try {
      await join.mutateAsync(value);
      setEntered('');
      toast.success(t('join.joined'));
      onClose();
    } catch {
      toast.error(t('join.notFound'));
    }
  }, [entered, join, onClose, t, toast]);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t('share.title')}>
      <div className="space-y-5 px-4 pb-6">

        {/* Invitations addressed to me — only ever from a link sent before
            codes existed. Kept so those are still answerable. */}
        {myInvitations.length > 0 && (
          <section className="space-y-2">
            {myInvitations.map((invitation) => (
              <div
                key={invitation.token}
                className="glass-brand rounded-2xl p-3"
              >
                <p className="text-sm font-semibold text-brand-900 dark:text-brand-200">
                  {t('banner.invitation', {
                    name: invitation.inviter_name || t('lists.someone'),
                  })}
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => respond(invitation.token, 'accept')}
                    className="gradient-action h-10 flex-1 rounded-xl text-xs font-bold text-white"
                  >
                    {t('invite.accept')}
                  </button>
                  <button
                    type="button"
                    onClick={() => respond(invitation.token, 'decline')}
                    className="glass h-10 flex-1 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300"
                  >
                    {t('invite.decline')}
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* The code. Every member can pass it on — they are on the list, and
            the row it lives on is one they can already read. Only the owner
            can replace it. */}
        {code && (
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {t('share.codeTitle')}
            </h3>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => copy(code, 'code')}
                aria-label={t('share.copyCode')}
                className="glass flex min-h-[56px] flex-1 items-center justify-center rounded-2xl
                           transition active:scale-[0.98]"
              >
                {/* dir=ltr because the code is Latin characters and would
                    otherwise be laid out right-to-left inside a Hebrew page. */}
                <span
                  dir="ltr"
                  className="font-mono text-2xl font-bold tracking-[0.35em] text-gray-900 dark:text-gray-50"
                >
                  {code}
                </span>
                <span className="ms-2 text-gray-400">
                  {copied === 'code' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </span>
              </button>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
              {t('share.codeHint')}
            </p>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleShare}
                className={cn(
                  'flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-2xl',
                  'text-sm font-bold text-white transition active:scale-95',
                  copied === 'link' ? 'bg-emerald-600' : 'gradient-action gradient-glow'
                )}
              >
                {copied === 'link' ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                {copied === 'link' ? t('share.copied') : t('share.send')}
              </button>

              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirming !== 'rotate') { setConfirming('rotate'); return; }
                    handleRotate();
                  }}
                  disabled={rotate.isPending}
                  className={cn(
                    'flex min-h-[46px] items-center justify-center gap-1.5 rounded-2xl px-3',
                    'text-sm font-bold transition active:scale-95',
                    confirming === 'rotate'
                      ? 'bg-red-500 text-white'
                      : 'glass text-gray-500 dark:text-gray-400'
                  )}
                >
                  {rotate.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <RefreshCw className="h-4 w-4" />}
                  {confirming === 'rotate' ? t('share.changeCodeConfirm') : t('share.changeCode')}
                </button>
              )}
            </div>

            <AnimatePresence>
              {confirming === 'rotate' && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 text-xs leading-relaxed text-red-500"
                >
                  {t('share.changeCodeWarning')}
                </motion.p>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* Joining someone else's. The other half of the same idea, and it has
            to live somewhere a person who was told a code can find it. */}
        <section className="border-t border-gray-100 pt-4 dark:border-gray-700/60">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {t('join.title')}
          </h3>
          <div className="flex gap-2">
            <input
              value={entered}
              onChange={(event) => setEntered(event.target.value.toUpperCase().slice(0, CODE_LENGTH))}
              onKeyDown={(event) => { if (event.key === 'Enter') handleJoin(); }}
              placeholder={t('join.placeholder')}
              dir="ltr"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              /* 16px: anything smaller and iOS zooms the page on focus and
                 gives you no way back out. */
              className="glass min-h-[46px] min-w-0 flex-1 rounded-2xl bg-transparent px-4 text-center
                         font-mono text-[16px] font-bold tracking-[0.3em] text-gray-900
                         placeholder:font-sans placeholder:tracking-normal placeholder:text-gray-400
                         focus:outline-none dark:text-gray-50"
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={entered.trim().length !== CODE_LENGTH || join.isPending}
              className={cn(
                'flex min-h-[46px] shrink-0 items-center justify-center gap-1.5 rounded-2xl px-4',
                'text-sm font-bold transition active:scale-95',
                entered.trim().length === CODE_LENGTH && !join.isPending
                  ? 'gradient-action gradient-glow text-white'
                  : 'bg-gray-200/60 text-gray-400 dark:bg-gray-700/50 dark:text-gray-600'
              )}
            >
              {join.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <UserPlus className="h-4 w-4" />}
              {t('join.action')}
            </button>
          </div>
        </section>

        {/* Members */}
        <section className="border-t border-gray-100 pt-4 dark:border-gray-700/60">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {t('share.members')}
          </h3>
          <ul className="space-y-1.5">
            {members.map((member) => (
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
                    onClick={() => {
                      if (confirming !== `member-${member.id}`) {
                        setConfirming(`member-${member.id}`);
                        return;
                      }
                      // The membership row id, not the user id — this used to
                      // pass the user's uuid to a query filtering on a bigint.
                      removeMember(member.id);
                      setConfirming(null);
                    }}
                    aria-label={t('share.remove')}
                    className={cn(
                      'flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors',
                      confirming === `member-${member.id}`
                        ? 'bg-red-500 text-white'
                        : 'text-gray-400 hover:text-red-500'
                    )}
                  >
                    <UserMinus className="h-4 w-4" />
                    {confirming === `member-${member.id}` && t('share.remove')}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {members.length <= 1 && (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{t('share.alone')}</p>
          )}
        </section>

        {/* Leave / disband — nothing to render for the owner of a list nobody
            else is on, and an empty bordered section is a visible seam. */}
        {(!isOwner || members.length > 1) && (
          <section className="border-t border-gray-100 pt-4 dark:border-gray-700/60">
            {isOwner ? (
              <button
                type="button"
                onClick={() => {
                  if (confirming !== 'disband') { setConfirming('disband'); return; }
                  // The id was missing here, so this filtered on `undefined`
                  // and disbanding silently did nothing.
                  disband(listId);
                  setConfirming(null);
                  onClose();
                }}
                className={cn(
                  'flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition',
                  confirming === 'disband' ? 'bg-red-500 text-white' : 'glass text-red-500'
                )}
              >
                <UserMinus className="h-4 w-4" />
                {confirming === 'disband' ? t('share.disbandConfirm') : t('share.disband')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (confirming !== 'leave') { setConfirming('leave'); return; }
                  // Which list — without it this removed every membership the
                  // user had, their own list included.
                  leaveList(listId);
                  setConfirming(null);
                  onClose();
                }}
                className={cn(
                  'flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition',
                  confirming === 'leave' ? 'bg-red-500 text-white' : 'glass text-red-500'
                )}
              >
                <LogOut className="h-4 w-4 rtl:-scale-x-100" />
                {confirming === 'leave' ? t('share.leaveConfirm') : t('share.leave')}
              </button>
            )}
          </section>
        )}
      </div>
    </BottomSheet>
  );
};

export default GroceryShareSheet;
