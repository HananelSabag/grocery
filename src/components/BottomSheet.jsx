import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '../lib/helpers';

/**
 * The app's only modal shape.
 *
 * Every sheet is bottom-anchored because the thumb is at the bottom of the
 * phone; a centred dialog puts its buttons where the hand is not. The sheet
 * sits above the keyboard rather than behind it — `pb-safe-b` plus the
 * viewport resize is what keeps the first field visible when the keyboard
 * opens, which is the single most common way a sheet like this breaks.
 */
export default function BottomSheet({ open, onClose, title, children, footer }) {
  // A sheet is a layer, so the page behind it must not scroll under the
  // finger. Restoring the exact overflow value (not just clearing it) keeps
  // two stacked sheets from leaving the body locked.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative w-full max-w-lg rounded-t-3xl bg-white shadow-2xl',
              'dark:bg-gray-900',
              'max-h-[88vh] flex flex-col'
            )}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {/* The grab handle is decoration — the sheet is dismissed by the
                backdrop or the cancel action, not by a drag we'd have to
                fight the inner scroll for. */}
            <div className="flex justify-center pt-3 pb-1">
              <span className="h-1 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>

            {title && (
              <h2 className="px-5 pb-3 pt-1 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </h2>
            )}

            <div className="scroll-area flex-1 px-5">{children}</div>

            {footer && (
              <div className="border-t border-gray-100 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 dark:border-gray-800">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
