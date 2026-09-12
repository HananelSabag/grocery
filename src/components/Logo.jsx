import React from 'react';
import { cn } from '../lib/helpers';

/**
 * The mark.
 *
 * The artwork itself faces the way a cart faces in an RTL layout — handle on
 * the right, basket ahead to the left — because that is the orientation the
 * app is almost always seen in, and because the home-screen icon and the
 * browser tab are raster files that no CSS rule reaches. Making Hebrew the
 * drawn default is what gets those right.
 *
 * So the flip here is the English one: `ltr:-scale-x-100`, the mirror of what
 * this used to be. Same single file, still correct in both directions, but now
 * the un-transformed case is the common one.
 */
export default function Logo({ size = 36, className }) {
  return (
    <img
      src="/favicon.svg"
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0 ltr:-scale-x-100', className)}
      style={{ width: size, height: size }}
    />
  );
}
