import React from 'react';
import { cn } from '../lib/helpers';

/**
 * The mark.
 *
 * Mirrored in Hebrew. The cart is drawn facing the way a cart faces when you
 * read left-to-right — handle behind, basket ahead — and in an RTL layout that
 * reads as pointing backwards, the same way every directional glyph in the app
 * is flipped. The art is not re-cut; `-scale-x-100` does it, which also means
 * the one file stays correct in both directions.
 *
 * Kept as a component so that rule lives in one place rather than being
 * remembered at each of the three spots the mark appears.
 */
export default function Logo({ size = 36, className }) {
  return (
    <img
      src="/favicon.svg"
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0 rtl:-scale-x-100', className)}
      style={{ width: size, height: size }}
    />
  );
}
