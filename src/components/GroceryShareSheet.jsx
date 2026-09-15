/**
 * GroceryShareSheet — who is on the list, and the link that gets someone on it.
 *
 * Sharing is a link, and only a link: send it or copy it. It went through a
 * one-time link that its first tap used up, and then a six-character code shown
 * on screen with a field to type one into — both answering questions nobody was
 * asking. What was asked for is these two buttons, so these two buttons are it.
 *
 * The link is permanent. It is the list's standing code in a URL, so it works in
 * a family chat, for whoever it gets forwarded to, and next month. The one way to
 * stop it is to replace it — owner-only, and it says what that breaks first.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Loader2, LogOut, RefreshCw, Share2, UserMinus } from 'lucide-react';

import BottomSheet from './BottomSheet';
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

const GroceryShareSheet = ({ isOpen, onClose, members, role, currentUserId, list }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { removeMember, leaveList, disband } = useGrocerySharing();
  const rotate = useRotateJoinCode();

  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [confirming, setConfirming] = useState(null);

  const isOwner = role === 'owner';
  const listId = list?.id ?? null;
  const link = list?.join_code ? `${window.location.origin}/join/${list.join_code}` : null;
  const sharable = canShare();

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setCopyFailed(false);
      setConfirming(null);
    }
  }, [isOpen]);

  const copy = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Some in-app browsers refuse the clipboard; the link is shown instead,
      // ready to select.
      setCopyFailed(true);
    }
  }, [link]);

  const share = useCallback(async () => {
    if (!link) return;
    const name = list?.name?.trim();
    try {
      await navigator.share({
        title: t('app.name'),
        text: name ? t('share.messageNamed', { name }) : t('share.message'),
        url: link,
      });
    } catch {
      /* dismissed */
    }
  }, [link, list?.name, t]);

  const replace = useCallback(async () => {
    if (confirming !== 'replace') {
      setConfirming('replace');
      return;
    }
    try {
      await rotate.mutateAsync(listId);
      setConfirming(null);
      setCopied(false);
      setCopyFailed(false);
      toast.success(t('share.linkReplaced'));
    } catch {
      toast.error(t('errors.GROCERY_OWNER_ONLY', { fallback: t('errors.generic') }));
    }
  }, [confirming, rotate, listId, toast, t]);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t('share.title')}>
      <div className="space-y-5 px-4 pb-6">

        {link && (
          <section>
            <div className="flex gap-2">
              {sharable && (
                <button
                  type="button"
                  onClick={share}
                  className="gradient-action gradient-glow flex min-h-[48px] flex-1 items-center justify-center
                             gap-2 rounded-2xl text-[15px] font-bold text-white transition active:scale-95"
                >
                  <Share2 className="h-4 w-4" />
                  {t('share.send')}
                </button>
              )}

              <button
                type="button"
                onClick={copy}
                className={cn(
                  'flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-bold',
                  'transition active:scale-95',
                  copied
                    ? 'bg-emerald-600 text-white'
                    : sharable
                      ? 'glass text-gray-800 dark:text-gray-100'
                      : 'gradient-action gradient-glow text-white'
                )}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t('share.copied') : t('share.copyLink')}
              </button>
            </div>

            {copyFailed && (
              <p
                dir="ltr"
                className="mt-2 select-all break-all rounded-xl bg-gray-100 px-3 py-2 text-xs text-gray-600
                           dark:bg-gray-800 dark:text-gray-300"
              >
                {link}
              </p>
            )}

            <p className="mt-2 px-1 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
              {t('share.linkHint')}
            </p>

            {isOwner && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={replace}
                  disabled={rotate.isPending}
                  className={cn(
                    'flex min-h-[36px] items-center gap-1.5 rounded-lg px-1 text-xs font-semibold transition',
                    confirming === 'replace' ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'
                  )}
                >
                  {rotate.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5" />}
                  {confirming === 'replace' ? t('share.replaceLinkConfirm') : t('share.replaceLink')}
                </button>

                <AnimatePresence>
                  {confirming === 'replace' && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-1 text-[11px] leading-relaxed text-red-500"
                    >
                      {t('share.replaceLinkWarning')}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}
          </section>
        )}

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
                      // The membership row's id, not the user's.
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

        {/* Leave / stop sharing — nothing to render for the owner of a list
            nobody else is on, and an empty bordered section is a visible seam. */}
        {(!isOwner || members.length > 1) && (
          <section className="border-t border-gray-100 pt-4 dark:border-gray-700/60">
            {isOwner ? (
              <button
                type="button"
                onClick={() => {
                  if (confirming !== 'disband') { setConfirming('disband'); return; }
                  disband(listId);
                  setConfirming(null);
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
