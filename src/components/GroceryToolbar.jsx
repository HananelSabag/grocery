import React from 'react';
import { ChevronDown, History, User, Users } from 'lucide-react';
import { cn } from '../lib/helpers';
import Logo from './Logo';

/**
 * The page's entire chrome: one row and a hairline.
 *
 * Vertical space is the scarce resource on this screen — the bottom navigation
 * already owns ~60px — and this used to spend well over a hundred pixels of it
 * on a full-width tab bar whose second tab you visit maybe once a month, plus a
 * separate title row, plus a status line. The list itself got what was left.
 *
 * So: the page title is screen-reader-only (the nav bar and the header already
 * say where you are), history is one icon that opens a sheet, and the only text
 * that survives is the one line worth reading mid-aisle — how much is left.
 */
export default function GroceryToolbar({
  activeListLabel,
  onSwitchList,
  onShare,
  onHistory,
  onProfile,
  invitationCount = 0,
  statusLine,
  progress,
  showProgress,
  t,
}) {
  const progressPercent = Math.min(100, Math.max(0, Number(progress) || 0));

  // 44px, because these are the smallest tap targets on the screen.
  const iconButton = cn(
    'glass relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
    'text-gray-600 transition-all active:scale-95',
    'hover:text-brand-600 dark:text-gray-300 dark:hover:text-brand-400',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500'
  );

  return (
    <header className="pt-2">
      <h1 className="sr-only">{t('title')}</h1>

      <div className="flex items-center gap-2">
        {/* The mark, at the size it was drawn for. Standalone there is no app
            shell above this row, so without it nothing on screen says which
            app you are in. */}
        <Logo size={36} />

        <div className="min-w-0 flex-1">
          {/* The name always shows. It used to appear only when there was more
              than one list to switch between, which left a lone small status
              line floating next to the mark and reading as an empty header. */}
          {onSwitchList ? (
            <button
              type="button"
              onClick={onSwitchList}
              aria-label={`${t('lists.switchTo')}: ${activeListLabel}`}
              className="flex max-w-full items-center gap-1 rounded-lg text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <span className="truncate text-[15px] font-bold leading-tight text-gray-900 dark:text-gray-50">
                {activeListLabel}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            </button>
          ) : (
            <p className="truncate text-[15px] font-bold leading-tight text-gray-900 dark:text-gray-50">
              {activeListLabel}
            </p>
          )}

          {/* One line, always. `truncate` rather than a wrap: a header that
              grows a second line pushes the list down by a row every time the
              count crosses ten. */}
          <p
            className="truncate text-[12px] leading-tight text-gray-500 dark:text-gray-400"
            role="status"
          >
            {statusLine}
          </p>
        </div>

        {/* A clock-with-arrow. The receipt glyph that used to be here was
            picked because at 16px a history icon reads as a refresh spinner —
            but that only trades one confusion for another, since a receipt is
            also the thing you attach TO a shop. Bigger and unambiguous beats
            smaller and clever. */}
        <button type="button" onClick={onHistory} aria-label={t('history.open')} className={iconButton}>
          <History className="h-[18px] w-[18px] rtl:-scale-x-100" />
        </button>

        <button type="button" onClick={onShare} aria-label={t('share.title')} className={cn(iconButton, 'lg:hidden')}>
          <Users className="h-4 w-4" />
          {invitationCount > 0 && (
            <span className="absolute -end-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {invitationCount}
            </span>
          )}
        </button>

        {/* Standalone, this app has no surrounding shell to hang settings off,
            so the way out of the list lives here with the other two. */}
        {onProfile && (
          <button type="button" onClick={onProfile} aria-label={t('profile.title')} className={iconButton}>
            <User className="h-4 w-4" />
          </button>
        )}
      </div>

      {showProgress && (
        <div
          role="progressbar"
          aria-label={t('title')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPercent)}
          aria-valuetext={statusLine}
          className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none',
              progressPercent >= 100 ? 'bg-emerald-500' : 'bg-brand-500'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </header>
  );
}
