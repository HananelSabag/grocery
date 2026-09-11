import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, Users, ListChecks, Share2, ShoppingBasket,
  Mail, Shield, AlertCircle,
} from 'lucide-react';

import { useTranslation, useLanguage } from '../i18n';
import { useIsAdmin, useAdminOverview, useAdminUsers, useAdminLists } from '../hooks/useAdmin';
import { cn, dateHelpers } from '../lib/helpers';
import Splash from '../components/Splash';

/**
 * Admin.
 *
 * Read-only on purpose. Everything here reaches across every household, which
 * is exactly the access that should not also be able to change things — the
 * policies grant admin a wider SELECT and nothing else, so there is no button
 * here that the database would have honoured anyway.
 *
 * The gate is cosmetic. `is_admin()` is re-checked inside every function this
 * screen calls, so someone who reaches /admin by typing it gets the refusal
 * screen rather than data.
 */

const Tile = ({ icon: Icon, value, label, tone = 'brand' }) => (
  <div className="glass flex flex-col gap-1 rounded-2xl p-4">
    <Icon className={cn('h-4 w-4', tone === 'mint' ? 'text-emerald-500' : 'text-brand-500')} />
    <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-50">
      {value ?? '—'}
    </span>
    <span className="text-[11px] font-medium leading-tight text-gray-400 dark:text-gray-500">
      {label}
    </span>
  </div>
);

const Avatar = ({ url, name, className }) =>
  url ? (
    <img src={url} alt="" referrerPolicy="no-referrer" className={cn('rounded-full', className)} />
  ) : (
    <span className={cn(
      'gradient-action flex items-center justify-center rounded-full font-bold text-white',
      className
    )}>
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );

export default function AdminPage() {
  const { t } = useTranslation();
  const language = useLanguage((s) => s.language);
  const isAdmin = useIsAdmin();

  const [tab, setTab] = useState('users');

  const overview = useAdminOverview();
  const users = useAdminUsers();
  const lists = useAdminLists();

  const BackIcon = language === 'he' ? ArrowRight : ArrowLeft;

  // The queries are the real gate; this only decides what to render while they
  // answer. A stranger who typed the URL falls through to the refusal below.
  if (!isAdmin && overview.isLoading) return <Splash />;

  if (!isAdmin) {
    return (
      <div className="app-bg flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
        <AlertCircle className="h-10 w-10 text-gray-300 dark:text-gray-700" strokeWidth={1.5} />
        <p className="text-gray-600 dark:text-gray-300">{t('admin.denied')}</p>
        <Link to="/" className="gradient-action gradient-glow rounded-xl px-6 py-2.5 font-bold text-white">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  const o = overview.data;

  const tabButton = (key) => cn(
    'min-h-[40px] flex-1 rounded-xl px-3 text-[13px] font-bold transition-all',
    tab === key ? 'gradient-action gradient-glow text-white' : 'text-gray-600 active:scale-95 dark:text-gray-300'
  );

  return (
    <div className="app-bg min-h-screen px-4 pb-16">
      <header className="flex items-center gap-3 pb-1 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          to="/profile"
          aria-label={t('common.back')}
          className="glass flex h-11 w-11 items-center justify-center rounded-xl
                     text-gray-600 transition-all active:scale-95 dark:text-gray-300"
        >
          <BackIcon className="h-4 w-4" />
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-50">
          <Shield className="h-5 w-5 text-brand-500" />
          {t('admin.title')}
        </h1>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        <Tile icon={Users}          value={o?.users}           label={t('admin.users')} />
        <Tile icon={ListChecks}     value={o?.lists}           label={t('admin.lists')} />
        <Tile icon={Share2}         value={o?.shared_lists}    label={t('admin.sharedLists')} />
        <Tile icon={ShoppingBasket} value={o?.active_items}    label={t('admin.activeItems')} tone="mint" />
        <Tile icon={ShoppingBasket} value={o?.completed_trips} label={t('admin.trips')} tone="mint" />
        <Tile icon={Mail}           value={o?.pending_invites} label={t('admin.pendingInvites')} />
        <Tile icon={Users}          value={o?.signups_7d}      label={t('admin.signups7d')} />
        <Tile icon={ListChecks}     value={o?.active_7d}       label={t('admin.active7d')} tone="mint" />
      </motion.div>

      <div className="glass mt-4 flex gap-1 rounded-2xl p-2">
        <button type="button" onClick={() => setTab('users')} className={tabButton('users')}>
          {t('admin.users')}
        </button>
        <button type="button" onClick={() => setTab('lists')} className={tabButton('lists')}>
          {t('admin.lists')}
        </button>
      </div>

      {tab === 'users' && (
        <div className="glass mt-3 overflow-hidden rounded-2xl">
          {(users.data ?? []).map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 border-b border-gray-100/70 px-4 py-3 last:border-0 dark:border-gray-700/40"
            >
              <Avatar url={user.avatar_url} name={user.display_name} className="h-10 w-10 text-[13px]" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[15px] font-bold text-gray-900 dark:text-gray-50">
                  {user.display_name || '—'}
                  {user.is_admin && <Shield className="h-3 w-3 shrink-0 text-brand-500" />}
                </p>
                {/* The address, which is the only field that really identifies
                    an account — the whole reason profiles now carries it. */}
                <p className="truncate text-[12px] text-gray-500 dark:text-gray-400">{user.email}</p>
                <p className="mt-0.5 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                  {t('admin.userLine', {
                    lists: user.lists,
                    items: user.items_added,
                    trips: user.trips_closed,
                  })}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  {dateHelpers.format(user.created_at, 'PP', language)}
                </p>
                {user.last_active && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    {dateHelpers.format(user.last_active, 'PP', language)}
                  </p>
                )}
              </div>
            </div>
          ))}
          {(users.data ?? []).length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-gray-400">{t('admin.empty')}</p>
          )}
        </div>
      )}

      {tab === 'lists' && (
        <div className="glass mt-3 overflow-hidden rounded-2xl">
          {(lists.data ?? []).map((list) => (
            <div
              key={list.id}
              className="flex items-center gap-3 border-b border-gray-100/70 px-4 py-3 last:border-0 dark:border-gray-700/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-gray-900 dark:text-gray-50">
                  {list.name}
                  {list.archived_at && (
                    <span className="ms-2 text-[11px] font-medium text-gray-400">
                      {t('admin.archived')}
                    </span>
                  )}
                </p>
                <p className="truncate text-[12px] text-gray-500 dark:text-gray-400">
                  {list.owner_name} · {list.owner_email}
                </p>
                <p className="mt-0.5 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                  {t('admin.listLine', {
                    members: list.members,
                    items: list.active_items,
                    trips: list.trips,
                  })}
                </p>
              </div>
              <p className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                {dateHelpers.format(list.created_at, 'PP', language)}
              </p>
            </div>
          ))}
          {(lists.data ?? []).length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-gray-400">{t('admin.empty')}</p>
          )}
        </div>
      )}

      <p className="mt-6 px-2 text-center text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        {t('admin.readOnlyNote')}
      </p>
    </div>
  );
}
