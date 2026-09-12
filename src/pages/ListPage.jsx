/**
 * The shared household grocery list.
 *
 * Vertical space is the scarce resource here, so the page keeps its own chrome
 * to a single scrolling toolbar row and a hairline progress bar. Adding an item
 * is a docked composer, not a floating button that opens a form: type, press
 * enter, type the next one.
 *
 * Ported from SpendWise, where this screen also had to clear an app-wide bottom
 * navigation. Standalone there is none, so the composer sits on the safe area
 * itself and the list gets the ~74px back.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ChevronDown, Flag, Plus, ShoppingCart, Users } from 'lucide-react';

import { cn, resolveAvatar } from '../lib/helpers';
import { useTranslation } from '../i18n';
import { useAuth, useProfile } from '../stores/auth';
import { useMyProfile } from '../hooks/useMyProfile';
import { useToast } from '../hooks/useToast';
import { useGroceryList } from '../hooks/useGroceryList';
import { useGroceryLists, useMyGroceryInvitations } from '../hooks/useSharing';
import { useBottomInset } from '../hooks/useBottomInset';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { hasLearnedGesture, onGestureLearned } from '../lib/gestureHint';
import { CATEGORY_BY_KEY, DEFAULT_CATEGORY } from '../lib/categories';

import Splash from '../components/Splash';
import GroceryToolbar from '../components/GroceryToolbar';
import GroceryItemRow from '../components/GroceryItemRow';
import GroceryItemSheet from '../components/GroceryItemSheet';
import GroceryFinishSheet from '../components/GroceryFinishSheet';
import GroceryShareSheet from '../components/GroceryShareSheet';
import GroceryHistorySheet from '../components/GroceryHistorySheet';
import GroceryListSwitcher, { listLabel } from '../components/GroceryListSwitcher';
import GroceryQuickAdd from '../components/GroceryQuickAdd';

/** The composer publishes its own reach, so nothing underneath sits beneath it. */
const DOCK_HEIGHT_VAR = '--grocery-dock-height';

export default function ListPage() {
  const { t, isRTL } = useTranslation();
  const user = useAuth((s) => s.user);
  const me = useProfile();
  const { data: myProfile } = useMyProfile();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    isLoading, isError, refetch,
    list, members, sections, purchased,
    pendingCount, purchasedCount, progress, role,
    addItem, updateItem, togglePurchased, deleteItem,
    claimItem, releaseItem, completeTrip, switchList,
  } = useGroceryList();

  const { invitations: myInvitations } = useMyGroceryInvitations();
  const { lists, hasMultiple } = useGroceryLists();

  // `?tab=history` is kept as the way in, because older links point at it —
  // it just opens the sheet now instead of switching a tab.
  const [historyOpen, setHistoryOpen] = useState(searchParams.get('tab') === 'history');
  const [sheetItem, setSheetItem] = useState(null);
  const [sheetPrefill, setSheetPrefill] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState(null);
  const [showGestureHint, setShowGestureHint] = useState(() => !hasLearnedGesture());

  const sectionRefs = useRef({});
  const measureDock = useBottomInset(DOCK_HEIGHT_VAR);
  const keyboardInset = useKeyboardInset();
  const quickAddRef = useRef(null);
  const desktopQuickAddRef = useRef(null);

  useEffect(() => onGestureLearned(() => setShowGestureHint(false)), []);

  const activeListId = list?.id ?? null;
  const activeList = lists.find((entry) => String(entry.id) === String(activeListId));

  const handleSwitchList = useCallback(async (id) => {
    setSwitchingTo(id);
    const switched = await switchList(id);
    setSwitchingTo(null);
    if (switched) setListsOpen(false);
  }, [switchList]);

  const setHistory = useCallback((open) => {
    setHistoryOpen(open);
    const params = new URLSearchParams(searchParams);
    if (open) params.set('tab', 'history');
    else params.delete('tab');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  /**
   * One way to add an item, so this puts the cursor in it.
   *
   * Both composers are mounted; only one is visible. This used to prefer the
   * desktop ref, which on a phone is present but `display:none` — so the tap
   * focused nothing and the empty list's only call to action did nothing at
   * all. Each handle now says whether it took focus.
   */
  const focusQuickAdd = useCallback(() => {
    if (quickAddRef.current?.focus()) return;
    desktopQuickAddRef.current?.focus();
  }, []);

  /** Quick-add hands the editor what it already had, rather than a blank form. */
  const expandDraft = useCallback((draft) => {
    setSheetItem(null);
    setSheetPrefill(draft.name ? draft : null);
    setSheetOpen(true);
  }, []);

  const quickAdd = useCallback(async (payload) => !!(await addItem(payload)), [addItem]);

  /** Editing one item claims it, so two people can't type into it at once. */
  const openItem = useCallback(async (item) => {
    if (!(await claimItem(item.id))) return;
    setSheetItem(item);
    setSheetOpen(true);
  }, [claimItem]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    if (sheetItem) releaseItem(sheetItem.id);
    setSheetItem(null);
    setSheetPrefill(null);
  }, [sheetItem, releaseItem]);

  const handleSaveItem = useCallback(async (payload) => {
    const saved = sheetItem
      ? await updateItem(sheetItem.id, payload, sheetItem.version)
      : await addItem(payload);
    return !!saved;
  }, [sheetItem, updateItem, addItem]);

  const handleFinish = useCallback(async (payload) => {
    const result = await completeTrip(payload);
    if (result) {
      toast.success(t('finish.success'));
      if (result.carriedOver > 0) {
        toast.success(t('finish.carriedOver', { count: result.carriedOver }));
      }
    }
    return result;
  }, [completeTrip, toast, t]);

  const scrollToSection = useCallback((key) => {
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const invitationBanner = useMemo(() => {
    if (myInvitations.length === 0) return null;
    return {
      name: myInvitations[0].inviter_name || '',
      extra: myInvitations.length - 1,
    };
  }, [myInvitations]);

  // Error before loading, and only when there is nothing on screen. A query
  // that keeps failing stays pending across its retry cycles, so checking
  // isLoading first showed a skeleton that never resolved. And a poll failing
  // while a list is already up is routine — replacing a perfectly good list
  // with an error page over one dropped request would also unmount any open
  // sheet mid-use.
  if (isError && !list) {
    return (
      <div className="app-bg flex min-h-screen flex-col items-center justify-center px-8 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-red-400" strokeWidth={1.5} />
        <p className="mb-4 text-gray-600 dark:text-gray-300">{t('errors.generic')}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (isLoading) return <Splash />;

  const isEmpty = sections.length === 0 && purchased.length === 0;

  const statusLine = isEmpty
    ? (members.length > 1 ? t('subtitle') : t('share.alone'))
    : [
        t('progress.remaining', { count: pendingCount }),
        purchasedCount > 0 ? t('progress.done', { count: purchasedCount }) : null,
      ].filter(Boolean).join(' · ');

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="app-bg min-h-screen"
      /* Room for the composer and a gap, off its measured height so it stays
         right when the keyboard changes it. */
      style={{ paddingBottom: `calc(var(${DOCK_HEIGHT_VAR}, 64px) + env(safe-area-inset-bottom) + 24px)` }}
    >
      <div className="mx-auto w-full max-w-6xl px-3 pt-[env(safe-area-inset-top)] sm:px-5 lg:px-6">

        <GroceryToolbar
          activeListLabel={
            list?.name?.trim()
            || (activeList ? listLabel(activeList, t) : t('lists.defaultName'))
          }
          onSwitchList={hasMultiple ? () => setListsOpen(true) : undefined}
          onShare={() => setShareOpen(true)}
          onHistory={() => setHistory(true)}
          onProfile={() => navigate('/profile')}
          profilePicture={resolveAvatar(myProfile) || me.avatar}
          profileName={me.name}
          invitationCount={myInvitations.length}
          statusLine={statusLine}
          progress={progress}
          showProgress={!isEmpty}
          t={t}
        />

        <div className="pt-2 lg:flex lg:items-start lg:gap-6">

          {/* ── Main column ──────────────────────────────────────── */}
          <div className="min-w-0 flex-1">
            {invitationBanner && (
              <div className="mb-2.5">
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="glass glass-brand flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-start"
                >
                  <Users className="h-4 w-4 shrink-0 text-brand-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-brand-900 dark:text-brand-200">
                      {t('banner.invitation', { name: invitationBanner.name })}
                    </span>
                    {invitationBanner.extra > 0 && (
                      <span className="block text-xs text-brand-600 dark:text-brand-300">
                        {t('banner.invitationMore', { count: invitationBanner.extra })}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs font-bold text-brand-600 dark:text-brand-300">
                    {t('banner.view')}
                  </span>
                </button>
              </div>
            )}

            {isEmpty ? (
              <div className="flex flex-col items-center justify-center px-8 py-14 text-center">
                <span className="glass mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-brand-400">
                  <ShoppingCart className="h-7 w-7 rtl:-scale-x-100" strokeWidth={1.5} />
                </span>
                <h2 className="mb-1.5 text-base font-bold text-gray-700 dark:text-gray-200">
                  {t('empty.title')}
                </h2>
                <p className="mb-5 max-w-xs text-sm leading-relaxed text-gray-400 dark:text-gray-500">
                  {t('empty.description')}
                </p>
                <button
                  type="button"
                  onClick={focusQuickAdd}
                  className="flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  {t('empty.addFirst')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Taught at the top, because a long-press is not a gesture
                    anyone discovers on their own — and retired the first time
                    they use it, because a permanent tip is just clutter. */}
                {showGestureHint && (
                  <p className="px-1 text-[11px] text-gray-400 dark:text-gray-500">
                    {t('empty.gestureHint')}
                  </p>
                )}

                {sections.map(({ key, items }) => {
                  const category = CATEGORY_BY_KEY[key] || CATEGORY_BY_KEY[DEFAULT_CATEGORY];
                  const Icon = category.icon;
                  return (
                    <section
                      key={key}
                      ref={(node) => { sectionRefs.current[key] = node; }}
                      className="scroll-mt-3"
                    >
                      <h2 className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        <Icon className={cn('h-3.5 w-3.5', category.tint)} />
                        {t(`categories.${key}`)}
                        <span className="tabular-nums font-semibold">{items.length}</span>
                      </h2>
                      <ul className="space-y-1">
                        <AnimatePresence initial={false}>
                          {items.map((item) => (
                            <GroceryItemRow
                              key={item.id}
                              item={item}
                              onToggle={togglePurchased}
                              onOpen={openItem}
                              onDelete={deleteItem}
                              currentUserId={user?.id}
                            />
                          ))}
                        </AnimatePresence>
                      </ul>
                    </section>
                  );
                })}

                {/* In the cart — collapsed, with Finish sitting right where you
                    already look once things start landing in it. */}
                {purchased.length > 0 && (
                  <section className="pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCartOpen((open) => !open)}
                        aria-expanded={cartOpen}
                        className="flex flex-1 items-center gap-1.5 rounded-xl px-1 py-2 text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400"
                      >
                        <motion.span animate={{ rotate: cartOpen ? 180 : 0 }} transition={{ duration: 0.18 }}>
                          <ChevronDown className="h-4 w-4" />
                        </motion.span>
                        {t('sections.inCart', { count: purchased.length })}
                      </button>

                      <button
                        type="button"
                        onClick={() => setFinishOpen(true)}
                        className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Flag className="h-3.5 w-3.5 rtl:-scale-x-100" />
                        {t('finish.button')}
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {cartOpen && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-1 overflow-hidden pt-1"
                        >
                          {purchased.map((item) => (
                            <GroceryItemRow
                              key={item.id}
                              item={item}
                              onToggle={togglePurchased}
                              onOpen={openItem}
                              onDelete={deleteItem}
                              currentUserId={user?.id}
                            />
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </section>
                )}
              </div>
            )}
          </div>

          {/* ── Desktop rail ─────────────────────────────────────── */}
          <aside className="hidden w-72 shrink-0 space-y-3 lg:block xl:w-80">
            {/* Aisle jump chips live here and nowhere else. On a phone they
                were a horizontal scroller that hid half its own contents and
                fought the list's vertical scroll — and they solve a problem
                the list already solved, since items are sorted in aisle order.
                In this rail the space is free. */}
            {sections.length > 1 && (
              <nav
                aria-label={t('aisles.jumpTo')}
                className="glass rounded-2xl p-3"
              >
                <ul className="flex flex-wrap gap-1">
                  {sections.map(({ key, items }) => {
                    const category = CATEGORY_BY_KEY[key] || CATEGORY_BY_KEY[DEFAULT_CATEGORY];
                    const Icon = category.icon;
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => scrollToSection(key)}
                          className={cn(
                            'flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold',
                            'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                            'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          )}
                        >
                          <Icon className={cn('h-3 w-3 shrink-0', category.tint)} />
                          {t(`categories.${key}`)}
                          <span className="tabular-nums text-gray-400">{items.length}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            )}

            <GroceryQuickAdd ref={desktopQuickAddRef} onAdd={quickAdd} onExpand={expandDraft} />

            <div className="glass rounded-2xl p-3.5">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {t('share.members')}
              </h3>
              <ul className="space-y-1.5">
                {members.map((member) => (
                  <li key={member.user_id} className="flex items-center gap-2 text-sm">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full" />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">
                        {(member.first_name || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
                      {member.first_name || member.username}
                    </span>
                    {member.role === 'owner' && (
                      <span className="shrink-0 text-[10px] font-bold uppercase text-gray-400">
                        {t('share.roleOwner')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="mt-3 h-10 w-full rounded-xl border border-gray-200 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300"
              >
                {t('share.title')}
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Quick add — docked, mobile only ────────────────────────────
          Where the floating "+" used to be, doing the job it only pointed at.
          Always present: the empty list's own call to action focuses it. */}
      <div
        ref={measureDock}
        className="fixed inset-x-0 z-40 px-3 sm:px-5 lg:hidden"
        style={{
          // With the keyboard up the bar sits on the keyboard; without it, on
          // the home indicator.
          bottom: keyboardInset > 0
            ? `${keyboardInset + 8}px`
            : 'calc(env(safe-area-inset-bottom) + 8px)',
        }}
      >
        <GroceryQuickAdd ref={quickAddRef} onAdd={quickAdd} onExpand={expandDraft} />
      </div>

      <GroceryItemSheet
        isOpen={sheetOpen}
        onClose={closeSheet}
        onSave={handleSaveItem}
        onDelete={deleteItem}
        item={sheetItem}
        prefill={sheetPrefill}
      />

      <GroceryFinishSheet
        isOpen={finishOpen}
        onClose={() => setFinishOpen(false)}
        onConfirm={handleFinish}
        purchasedCount={purchasedCount}
        pendingCount={pendingCount}
      />

      <GroceryShareSheet
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        members={members}
        role={role}
        currentUserId={user?.id}
      />

      <GroceryHistorySheet isOpen={historyOpen} onClose={() => setHistory(false)} />

      <GroceryListSwitcher
        isOpen={listsOpen}
        onClose={() => setListsOpen(false)}
        lists={lists}
        activeListId={activeListId}
        onSwitch={handleSwitchList}
        busyId={switchingTo}
      />
    </div>
  );
}
