import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, Copy } from 'lucide-react';

import { signInWithGoogle } from '../lib/supabase';
import { rememberReturnTo } from '../lib/returnTo';
import { useLanguage } from '../i18n';
import { cn } from '../lib/helpers';
import Logo from '../components/Logo';

/** Google's mark, inline — the CSP allows no external images. */
const GoogleMark = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
    <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.8-2 5.1-4.4 6.7v5.6h7.1c4.2-3.8 6.6-9.5 6.6-16.5z"/>
    <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.6c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.8C7.9 41.1 15.4 46 24 46z"/>
    <path fill="#FBBC05" d="M11.6 28c-.4-1.3-.7-2.6-.7-4s.3-2.7.7-4v-5.8H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.3-5.8z"/>
    <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 6.9 4.3 14.2l7.3 5.8c1.7-5.2 6.6-9.2 12.4-9.2z"/>
  </svg>
);

/**
 * An in-app browser that Google refuses to sign anyone in from.
 *
 * Google blocks OAuth inside embedded web views ("disallowed_useragent"), and
 * that is what Instagram, Facebook, Messenger, TikTok and the like open links in.
 * A link sent there would lead a new person to a Google error page with no way
 * forward. WhatsApp and Telegram open real browser tabs and sign in fine, so they
 * are deliberately not on this list. Android marks a plain web view with "; wv)".
 */
const isEmbeddedBrowser = () => {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|LinkedInApp|TikTok|musical_ly|BytedanceWebview|Snapchat|Line\//i.test(ua)
    || (/Android/i.test(ua) && /; wv\)/.test(ua));
};

/**
 * The front door. With `intent="join"` it is the door someone arrives at from an
 * invitation link, and says so — to a person who has never seen the app, a bare
 * "sign in" screen after tapping a friend's link reads as the wrong page.
 */
export default function SignIn({ intent }) {
  const t = useLanguage((s) => s.t);
  const language = useLanguage((s) => s.language);
  const setLanguage = useLanguage((s) => s.setLanguage);

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const joining = intent === 'join';
  const embedded = isEmbeddedBrowser();

  const start = async () => {
    setBusy(true);
    setFailed(false);
    // Written down before leaving: Google always sends people back to "/", and
    // an invitation link has to survive that. See lib/returnTo.js.
    rememberReturnTo(`${window.location.pathname}${window.location.search}`);
    const { error } = await signInWithGoogle();
    if (error) {
      // The redirect never happened, so this component is still mounted and
      // has to say so itself.
      setBusy(false);
      setFailed(true);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* the address bar still has it */
    }
  };

  return (
    <div className="app-bg flex min-h-screen flex-col px-6">
      {/* Language sits at the top, reachable before signing in: someone who
          cannot read the page cannot be expected to find it in a profile. */}
      <div className="flex justify-end pt-safe-t">
        <button
          type="button"
          onClick={() => setLanguage(language === 'he' ? 'en' : 'he')}
          className="mt-4 rounded-full px-3 py-2 text-sm font-medium text-gray-500 transition
                     hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          {language === 'he' ? 'English' : 'עברית'}
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm text-center"
        >
          {/* The real mark, not a stand-in glyph — this is the first thing
              anyone sees of the app, and it is the same image that will sit
              on their home screen afterwards. */}
          <Logo size={88} className="mx-auto mb-6 drop-shadow-xl" />

          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            {joining ? t('join.signInTitle') : t('auth.signInTitle')}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-gray-500 dark:text-gray-400">
            {joining ? t('join.signInSubtitle') : t('auth.signInSubtitle')}
          </p>

          {embedded && (
            <div className="glass mt-6 rounded-2xl p-3 text-start">
              <p className="flex gap-2 text-[13px] leading-snug text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {t('join.embeddedBrowser')}
              </p>
              <button
                type="button"
                onClick={copyLink}
                className={cn(
                  'mt-2.5 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl text-[13px] font-bold transition active:scale-[0.98]',
                  copied ? 'bg-emerald-600 text-white' : 'bg-white/70 text-gray-800 dark:bg-gray-800/70 dark:text-gray-100'
                )}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t('share.copied') : t('share.copyLink')}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={start}
            disabled={busy}
            className={cn(
              'mt-10 flex w-full items-center justify-center gap-3 rounded-2xl border',
              'border-gray-200 bg-white px-5 py-4 text-[15px] font-semibold text-gray-800',
              'shadow-sm transition active:scale-[0.98]',
              'dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100',
              embedded && 'mt-4',
              busy && 'pointer-events-none opacity-60'
            )}
          >
            <GoogleMark />
            {busy ? t('auth.signingIn') : t('auth.google')}
          </button>

          {failed && (
            <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
              {t('auth.failed')}
            </p>
          )}

          <p className="mt-6 flex items-center justify-center gap-1.5 text-[13px] text-gray-400 dark:text-gray-500">
            <Check className="h-3.5 w-3.5" />
            {t('auth.noPassword')}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
