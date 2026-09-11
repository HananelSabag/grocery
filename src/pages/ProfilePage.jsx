import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, LogOut, ShoppingBag, PackageCheck, Users, Check } from 'lucide-react';

import { useProfile } from '../stores/auth';
import { useTheme } from '../stores/theme';
import { useTranslation, useLanguage } from '../i18n';
import { signOut } from '../lib/supabase';
import { useGroceryList } from '../hooks/useGroceryList';
import { useHouseholdStats } from '../hooks/useHouseholdStats';
import { useRenameList } from '../hooks/useSharing';
import { cn } from '../lib/helpers';
import GroceryShareSheet from '../components/GroceryShareSheet';

/**
 * Settings, and the way out.
 *
 * It opened as a bare settings list, which is a thin thing to walk into. What
 * it needed was not more switches but a reason to be a screen: what the
 * household has actually done, and who is in it. The switches then read as
 * what they are — a short tail, not the whole page.
 */

const Section = ({ title, children, className }) => (
  <section className="mt-5">
    {title && (
      <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {title}
      </h2>
    )}
    <div className={cn('glass overflow-hidden rounded-2xl', className)}>{children}</div>
  </section>
);

const Stat = ({ icon: Icon, value, label }) => (
  <div className="flex flex-1 flex-col items-center gap-1 py-4">
    <Icon className="h-4 w-4 text-brand-500" />
    <span className="text-xl font-bold tabular-nums text-gray-900 dark:text-gray-50">{value}</span>
    <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{label}</span>
  </div>
);

export default function ProfilePage() {
  const { t } = useTranslation();
  const language = useLanguage((s) => s.language);
  const setLanguage = useLanguage((s) => s.setLanguage);
  const { theme, setTheme } = useTheme();

  const me = useProfile();
  const { list, members, role } = useGroceryList();
  const { data: stats } = useHouseholdStats(list?.id);
  const renameList = useRenameList();

  const [name, setName] = useState('');
  const [shareOpen, setShareOpen] = useState(false);

  const isOwner = role === 'owner';
  const BackIcon = language === 'he' ? ArrowRight : ArrowLeft;

  const field = 'w-full rounded-xl border border-gray-200/70 bg-white/60 px-4 py-2.5 text-gray-900 ' +
    'placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 ' +
    'focus:ring-brand-500/20 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-100';

  const segment = (active) => cn(
    'relative min-h-[44px] flex-1 rounded-xl px-2 text-[13px] font-bold transition-all',
    active
      ? 'gradient-action gradient-glow text-white'
      : 'text-gray-600 active:scale-95 dark:text-gray-300'
  );

  return (
    <div className="app-bg min-h-screen px-4 pb-16">
      <header className="flex items-center gap-3 pb-1 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          to="/"
          aria-label={t('common.back')}
          className="glass flex h-11 w-11 items-center justify-center rounded-xl
                     text-gray-600 transition-all active:scale-95 dark:text-gray-300"
        >
          <BackIcon className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">{t('profile.title')}</h1>
      </header>

      {/* Who you are — read-only: the name and picture come from Google, and an
          editable copy here would only drift from it. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="glass mt-4 flex items-center gap-3 rounded-2xl p-4"
      >
        {me.avatar ? (
          <img src={me.avatar} alt="" className="h-14 w-14 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="gradient-action flex h-14 w-14 items-center justify-center rounded-full
                          text-xl font-bold text-white">
            {me.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-[17px] font-bold text-gray-900 dark:text-gray-100">{me.name}</p>
          <p className="truncate text-[13px] text-gray-500 dark:text-gray-400">{me.email}</p>
          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400">
            <Check className="h-3 w-3" />
            {t(isOwner ? 'share.roleOwner' : 'share.roleMember')}
          </p>
        </div>
      </motion.div>

      {/* The reason this is a screen rather than a menu. */}
      <div className="glass mt-3 flex divide-x divide-gray-200/60 rounded-2xl rtl:divide-x-reverse dark:divide-gray-700/50">
        <Stat icon={ShoppingBag}  value={stats?.shops ?? '—'}       label={t('history.statTrips')} />
        <Stat icon={PackageCheck} value={stats?.itemsBought ?? '—'} label={t('history.statItems')} />
        <Stat icon={Users}        value={stats?.members ?? '—'}     label={t('share.members')} />
      </div>

      {/* Who is on the list, and the way to add someone. */}
      <Section title={t('share.members')}>
        <ul>
          {members.map((member) => (
            <li
              key={member.user_id}
              className="flex items-center gap-3 border-b border-gray-100/70 px-4 py-3 last:border-0 dark:border-gray-700/40"
            >
              {member.avatar_url ? (
                <img src={member.avatar_url} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full" />
              ) : (
                <span className="gradient-action flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold text-white">
                  {(member.first_name || '?').charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-gray-800 dark:text-gray-100">
                {member.first_name || member.username}
              </span>
              {member.role === 'owner' && (
                <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold
                                 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  {t('share.roleOwner')}
                </span>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="min-h-[44px] w-full text-[13px] font-bold text-brand-600 transition-colors
                     active:bg-brand-50/60 dark:text-brand-400 dark:active:bg-brand-500/10"
        >
          {t('share.title')}
        </button>
      </Section>

      <Section title={t('profile.language')}>
        <div className="flex gap-1 p-2">
          {['he', 'en'].map((code) => (
            <button key={code} type="button" onClick={() => setLanguage(code)} className={segment(language === code)}>
              {code === 'he' ? 'עברית' : 'English'}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('profile.theme')}>
        <div className="flex gap-1 p-2">
          {[['light', 'themeLight'], ['dark', 'themeDark'], ['system', 'themeSystem']].map(([value, key]) => (
            <button key={value} type="button" onClick={() => setTheme(value)} className={segment(theme === value)}>
              {t(`profile.${key}`)}
            </button>
          ))}
        </div>
      </Section>

      {isOwner && list && (
        <Section title={t('profile.listName')}>
          <div className="flex gap-2 p-3">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={list.name || ''}
              className={field}
            />
            <button
              type="button"
              disabled={!name.trim() || renameList.isPending}
              onClick={() => renameList.mutate({ listId: list.id, name }, { onSuccess: () => setName('') })}
              className={cn(
                'min-h-[44px] shrink-0 rounded-xl px-4 font-bold text-white transition-all',
                name.trim() && !renameList.isPending
                  ? 'gradient-action gradient-glow active:scale-95'
                  : 'bg-gray-200/60 text-gray-400 dark:bg-gray-700/50 dark:text-gray-600'
              )}
            >
              {t('common.save')}
            </button>
          </div>
        </Section>
      )}

      <button
        type="button"
        onClick={() => signOut()}
        className="glass mt-5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl
                   font-bold text-red-600 transition-transform active:scale-[0.99] dark:text-red-400"
      >
        <LogOut className="h-4 w-4 rtl:-scale-x-100" />
        {t('auth.signOut')}
      </button>

      {/* The mark, once, at the bottom — where an app signs its name. */}
      <div className="mt-8 flex flex-col items-center gap-2 opacity-50">
        <img src="/favicon.svg" alt="" width="32" height="32" className="h-8 w-8 rounded-lg" />
        <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
          {t('app.name')} · {t('app.tagline')}
        </p>
      </div>

      <GroceryShareSheet
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        members={members}
        role={role}
        currentUserId={me.id}
      />
    </div>
  );
}
