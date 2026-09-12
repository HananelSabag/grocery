import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Share, SquarePlus, X } from 'lucide-react';

import Logo from './Logo';
import { useTranslation } from '../i18n';

/**
 * Offer to install, in the two ways the two platforms allow.
 *
 * Chrome fires `beforeinstallprompt` when the app qualifies, and that event is
 * the only way to show a real one-tap install. Safari has never implemented it
 * and Apple has said it will not, so on iOS every install is a manual
 * Add to Home Screen — there, the honest thing is to show the gesture rather
 * than a button that cannot do anything.
 *
 * Neither appears once the app is already installed: a standalone launch
 * matches `(display-mode: standalone)`, and older iOS answers
 * `navigator.standalone`.
 */

const DISMISSED_KEY = 'grocery_install_dismissed';

/** Long enough to have used the list once, so this is not the first thing seen. */
const APPEAR_AFTER_MS = 20_000;

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

/** iOS Safari, where the install is a share-sheet gesture rather than an event. */
const isIosSafari = () => {
  const ua = window.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua)
    // iPadOS 13+ reports itself as a Mac; the touch points give it away.
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Chrome and Firefox on iOS cannot add to the home screen at all, so there
  // is nothing to instruct.
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && safari;
};

const wasDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

export default function InstallPrompt() {
  const { t } = useTranslation();
  const [deferred, setDeferred] = useState(null);
  const [showIos, setShowIos] = useState(false);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* private mode */ }
    setDeferred(null);
    setShowIos(false);
  }, []);

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return undefined;

    // Chrome: hold the event so the offer appears where it makes sense rather
    // than over the first screen someone ever sees.
    const capture = (event) => {
      event.preventDefault();
      setDeferred(event);
    };
    window.addEventListener('beforeinstallprompt', capture);

    // iOS never fires that, so its instructions are on a timer instead.
    const timer = isIosSafari()
      ? setTimeout(() => setShowIos(true), APPEAR_AFTER_MS)
      : null;

    // Chrome fires this when the install completes; nothing more to offer.
    const installed = () => dismiss();
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installed);
      if (timer) clearTimeout(timer);
    };
  }, [dismiss]);

  const install = useCallback(async () => {
    if (!deferred) return;
    deferred.prompt();
    // The event is single-use whatever they answer.
    await deferred.userChoice;
    dismiss();
  }, [deferred, dismiss]);

  const open = !!deferred || showIos;
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        role="dialog"
        aria-label={t('install.title')}
        /* Above the composer, which is the one thing that must stay reachable
           — this is an offer, not a modal, and it never blocks the list. */
        className="glass glass-raised fixed inset-x-3 z-40 rounded-2xl p-3 sm:inset-x-auto sm:end-4 sm:w-80"
        style={{ bottom: 'calc(var(--grocery-dock-height, 64px) + env(safe-area-inset-bottom) + 16px)' }}
      >
        <div className="flex items-start gap-3">
          <Logo size={40} />

          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-gray-900 dark:text-gray-50">
              {t('install.title')}
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-gray-500 dark:text-gray-400">
              {showIos ? t('install.iosBody') : t('install.body')}
            </p>

            {showIos ? (
              /* The gesture, drawn. Telling someone to "use the share menu"
                 is useless if they cannot pick the icon out of the bar. */
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-gray-700 dark:text-gray-200">
                <Share className="h-4 w-4 shrink-0 text-brand-500" />
                {t('install.iosStep1')}
                <SquarePlus className="h-4 w-4 shrink-0 text-brand-500" />
                {t('install.iosStep2')}
              </p>
            ) : (
              <button
                type="button"
                onClick={install}
                className="gradient-action gradient-glow mt-2 h-9 rounded-xl px-4 text-[13px]
                           font-bold text-white transition active:scale-95"
              >
                {t('install.action')}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label={t('common.close')}
            className="-me-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                       text-gray-400 transition active:scale-90 dark:text-gray-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
