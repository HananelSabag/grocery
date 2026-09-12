import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

import { useUpdate } from '../stores/update';
import { useTranslation } from '../i18n';

/**
 * The one case where a new build cannot just take over.
 *
 * lib/pwa.js swaps the page by itself whenever doing so costs nothing. This
 * appears only when it would have interrupted something — a half-typed item, an
 * open sheet — and it disappears on its own the moment that passes, because the
 * quiet path keeps trying behind it. So it is a shortcut, not a chore: ignoring
 * it entirely still ends with the new build.
 */
export default function UpdateGate() {
  const { t } = useTranslation();
  const blocked = useUpdate((state) => state.blocked);
  const apply = useUpdate((state) => state.apply);

  return (
    <AnimatePresence>
      {blocked && (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
        >
          <motion.button
            type="button"
            onClick={() => apply()}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="glass glass-raised pointer-events-auto flex items-center gap-2 rounded-full
                       py-2 pe-3 ps-2.5 text-[13px] font-bold text-gray-900 shadow-lg
                       transition active:scale-95 dark:text-gray-50"
          >
            <span className="gradient-action flex h-6 w-6 items-center justify-center rounded-full">
              <RefreshCw className="h-3.5 w-3.5 text-white" />
            </span>
            {t('update.ready')}
            <span className="text-brand-600 dark:text-brand-400">{t('update.action')}</span>
          </motion.button>
        </div>
      )}
    </AnimatePresence>
  );
}
