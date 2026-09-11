import React from 'react';
import { ShoppingBasket } from 'lucide-react';

/**
 * The frame between "the app booted" and "we know who you are".
 *
 * Deliberately not a spinner: this usually resolves in well under a second
 * from a stored session, and a spinner that flashes for 200ms reads as a
 * stutter. A static mark just looks like the app opening.
 */
export default function Splash() {
  return (
    <div className="app-bg flex min-h-screen items-center justify-center">
      <ShoppingBasket
        className="h-10 w-10 text-brand-600 dark:text-brand-400 animate-pulse"
        aria-label="טוען"
      />
    </div>
  );
}
