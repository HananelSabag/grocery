import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, Info } from 'lucide-react';

import { cn } from '../lib/helpers';

/**
 * Toasts, at the interface the ported components call: toast.success(text),
 * toast.error(text).
 *
 * They sit at the TOP of the screen, not the bottom. Everything a person
 * touches in this app — the composer, the sheets, the finish button — is in
 * the bottom third, so a toast down there covers the control that just
 * triggered it.
 */

const ToastContext = createContext(null);

const ICONS = {
  success: Check,
  error: AlertCircle,
  info: Info,
};

const TONES = {
  success: 'bg-brand-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((type, message) => {
    if (!message) return;
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current.slice(-2), { id, type, message }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  const api = useMemo(() => ({
    success: (message) => push('success', message),
    error:   (message) => push('error', message),
    info:    (message) => push('info', message),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center
                        gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <AnimatePresence initial={false}>
            {toasts.map(({ id, type, message }) => {
              const Icon = ICONS[type] ?? ICONS.info;
              return (
                <motion.div
                  key={id}
                  layout
                  initial={{ opacity: 0, y: -16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  role="status"
                  className={cn(
                    'flex max-w-sm items-center gap-2 rounded-2xl px-4 py-3',
                    'text-[14px] font-medium shadow-lg',
                    TONES[type] ?? TONES.info
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0">{message}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

/**
 * Falls back to a no-op rather than throwing when there is no provider, so a
 * component rendered in a test or in isolation still works.
 */
const NOOP = { success: () => {}, error: () => {}, info: () => {} };

export const useToast = () => useContext(ToastContext) ?? NOOP;
