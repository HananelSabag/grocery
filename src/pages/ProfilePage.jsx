import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, LogOut } from 'lucide-react';

import { useProfile } from '../stores/auth';
import { useTheme } from '../stores/theme';
import { useTranslation, useLanguage } from '../i18n';
import { signOut } from '../lib/supabase';
import { useGroceryList } from '../hooks/useGroceryList';
import { useRenameList } from '../hooks/useSharing';
import { cn } from '../lib/helpers';

/**
 * Settings, and the way out.
 *
 * Deliberately small. Sharing and membership are not here — they live in the
 * share sheet, one tap from the list, because that is where you are when you
 * think of them. What is left is what you set once: language, appearance, the
 * list's name.
 */

const Section = ({ title, children }) => (
  <section className="mt-6">
    <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
      {title}
    </h2>
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-gray-800/60">{children}</div>
  </section>
);

export default function ProfilePage() {
  const { t } = useTranslation();
  const language = useLanguage((s) => s.language);
  const setLanguage = useLanguage((s) => s.setLanguage);
  const { theme, setTheme } = useTheme();

  const me = useProfile();
  const { list, role } = useGroceryList();
  const renameList = useRenameList();

  const [name, setName] = useState('');

  const isOwner = role === 'owner';
  const BackIcon = language === 'he' ? ArrowRight : ArrowLeft;

  const field = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 ' +
    'placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 ' +
    'focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

  const segment = (active) => cn(
    'min-h-[44px] flex-1 rounded-xl px-2 text-[13px] font-bold transition-colors',
    active ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300'
  );

  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-16 dark:bg-gray-950">
      <header className="flex items-center gap-3 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          to="/"
          aria-label={t('common.back')}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200
                     bg-white text-gray-600 transition-colors dark:border-gray-700
                     dark:bg-gray-800 dark:text-gray-300"
        >
          <BackIcon className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">{t('profile.title')}</h1>
      </header>

      {/* Who you are — read-only: the name and picture come from Google, and an
          editable copy here would only drift from it. */}
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-800/60">
        {me.avatar ? (
          <img src={me.avatar} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full
                          bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white">
            {me.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-bold text-gray-900 dark:text-gray-100">{me.name}</p>
          <p className="truncate text-[13px] text-gray-500 dark:text-gray-400">{me.email}</p>
        </div>
      </div>

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
                'min-h-[44px] shrink-0 rounded-xl bg-blue-600 px-4 font-bold text-white transition-colors',
                (!name.trim() || renameList.isPending) && 'opacity-50'
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
        className="mt-6 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl
                   bg-white font-bold text-red-600 shadow-sm transition-transform active:scale-[0.99]
                   dark:bg-gray-800/60 dark:text-red-400"
      >
        <LogOut className="h-4 w-4" />
        {t('auth.signOut')}
      </button>
    </div>
  );
}
