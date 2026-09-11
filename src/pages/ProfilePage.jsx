import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, LogOut, UserPlus, X } from 'lucide-react';

import { useProfile } from '../stores/auth';
import { useTheme } from '../stores/theme';
import { useLanguage } from '../i18n';
import { signOut } from '../lib/supabase';
import { useList, useMembers } from '../hooks/useGroceryList';
import { useCreateInvite, useRemoveMember, useRenameList } from '../hooks/useSharing';
import { cn } from '../lib/helpers';

const Section = ({ title, children }) => (
  <section className="mt-6">
    <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
      {title}
    </h2>
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-gray-900">{children}</div>
  </section>
);

export default function ProfilePage() {
  const t        = useLanguage((s) => s.t);
  const language = useLanguage((s) => s.language);
  const setLanguage = useLanguage((s) => s.setLanguage);
  const { theme, setTheme } = useTheme();

  const me = useProfile();
  const { data } = useList();
  const listId = data?.list?.id;
  const isOwner = data?.list?.owner_id === me.id;

  const { data: members = [] } = useMembers(listId);
  const createInvite  = useCreateInvite(listId);
  const removeMember  = useRemoveMember(listId);
  const renameList    = useRenameList();

  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const BackIcon = language === 'he' ? ArrowRight : ArrowLeft;

  const invite = async () => {
    const link = await createInvite.mutateAsync(email).catch(() => null);
    if (!link) return;
    setEmail('');
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked in some in-app browsers; the invite still exists,
      // and prompting is better than losing it silently.
      window.prompt(t('members.inviteLink'), link);
    }
  };

  const row = 'flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 last:border-0 dark:border-gray-800';
  const field = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 ' +
    'placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 ' +
    'focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-16 dark:bg-gray-950">
      <header className="flex items-center gap-3 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          to="/"
          aria-label={t('common.back')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500
                     shadow-sm transition active:scale-95 dark:bg-gray-900 dark:text-gray-400"
        >
          <BackIcon className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">{t('profile.title')}</h1>
      </header>

      {/* Who you are — read-only: the name and picture come from Google, and
          an editable copy here would only drift from it. */}
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
        {me.avatar ? (
          <img src={me.avatar} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg
                          font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            {me.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{me.name}</p>
          <p className="truncate text-[13px] text-gray-500 dark:text-gray-400">{me.email}</p>
        </div>
      </div>

      <Section title={t('profile.language')}>
        <div className="flex p-2">
          {['he', 'en'].map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
              className={cn(
                'min-h-touch flex-1 rounded-xl text-[15px] font-medium transition',
                language === code
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-600 dark:text-gray-300'
              )}
            >
              {code === 'he' ? 'עברית' : 'English'}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('profile.theme')}>
        <div className="flex p-2">
          {[['light', 'themeLight'], ['dark', 'themeDark'], ['system', 'themeSystem']].map(([value, key]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={cn(
                'min-h-touch flex-1 rounded-xl px-2 text-[13px] font-medium transition',
                theme === value ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-300'
              )}
            >
              {t(`profile.${key}`)}
            </button>
          ))}
        </div>
      </Section>

      {isOwner && (
        <Section title={t('profile.listName')}>
          <div className="flex gap-2 p-3">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={data?.list?.name || ''}
              className={field}
            />
            <button
              type="button"
              disabled={!name.trim() || renameList.isPending}
              onClick={() => renameList.mutate({ listId, name }, { onSuccess: () => setName('') })}
              className={cn(
                'min-h-touch shrink-0 rounded-xl bg-brand-600 px-4 font-semibold text-white transition active:scale-95',
                (!name.trim() || renameList.isPending) && 'opacity-50'
              )}
            >
              {t('list.save')}
            </button>
          </div>
        </Section>
      )}

      <Section title={t('members.title')}>
        {members.map((member) => {
          const profile = member.profiles ?? {};
          const isMe = member.user_id === me.id;
          const canRemove = (isOwner && !isMe) || isMe;
          return (
            <div key={member.id} className={row}>
              <div className="flex min-w-0 items-center gap-3">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100
                                  text-sm font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {(profile.display_name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-gray-900 dark:text-gray-100">
                    {profile.display_name || '—'}
                  </p>
                  <p className="text-[13px] text-gray-400 dark:text-gray-500">
                    {t(member.role === 'owner' ? 'members.owner' : 'members.member')}
                  </p>
                </div>
              </div>

              {canRemove && member.role !== 'owner' && (
                <button
                  type="button"
                  aria-label={isMe ? t('members.leave') : t('members.remove')}
                  onClick={() => {
                    const message = isMe ? t('members.leaveConfirm') : t('list.deleteConfirm', { name: profile.display_name || '' });
                    if (window.confirm(message)) removeMember.mutate(member.id);
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400
                             transition active:scale-95 dark:text-gray-500"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}

        {isOwner && (
          <div className="flex gap-2 p-3">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('members.inviteEmail')}
              type="email"
              inputMode="email"
              autoComplete="off"
              className={field}
            />
            <button
              type="button"
              onClick={invite}
              disabled={createInvite.isPending}
              className={cn(
                'flex min-h-touch shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-4',
                'font-semibold text-white transition active:scale-95',
                createInvite.isPending && 'opacity-50'
              )}
            >
              {copied ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {copied ? t('members.inviteCopied') : t('members.invite')}
            </button>
          </div>
        )}
      </Section>

      <button
        type="button"
        onClick={() => signOut()}
        className="mt-6 flex min-h-touch w-full items-center justify-center gap-2 rounded-2xl
                   bg-white font-medium text-red-600 shadow-sm transition active:scale-[0.99]
                   dark:bg-gray-900 dark:text-red-400"
      >
        <LogOut className="h-4 w-4" />
        {t('auth.signOut')}
      </button>
    </div>
  );
}
