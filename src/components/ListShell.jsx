import React from 'react';
import { useViewportShell } from '../hooks/useViewportShell';

/**
 * The list screen's frame: a header that stays put, a list that scrolls, and
 * the add field as the last row — all inside the part of the screen you can
 * actually see.
 *
 * It used to be an ordinary scrolling page with the add field `position: fixed`
 * over the bottom of it, and ninety-odd pixels of padding so the last row could
 * clear the bar. On an iPhone that page was exactly what Safari scrolled away
 * when the keyboard came up. Here there is no page to scroll: the frame is the
 * visible viewport (see useViewportShell), the list is the only thing that
 * scrolls, and the add field is a row of the frame rather than a layer over the
 * list, so nothing needs padding to get out from under it.
 *
 * The header staying on screen is not decoration. With more than one list, the
 * name at the top is the answer to "which list am I adding to?" — and that is a
 * question you ask while typing.
 *
 * `measureDock` still publishes the add field's height for the few things that
 * float above it, like the install prompt.
 */
export default function ListShell({ dir, header, dock, measureDock, children }) {
  const shell = useViewportShell();

  return (
    <div
      ref={shell}
      dir={dir}
      data-keyboard="closed"
      className="app-bg group/shell fixed inset-x-0 top-0 flex h-[100dvh] flex-col overflow-hidden"
    >
      <div className="mx-auto w-full max-w-6xl shrink-0 px-3 pt-[env(safe-area-inset-top)] sm:px-5 lg:px-6">
        {header}
      </div>

      <div className="scroll-area min-h-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-3 pb-4 pt-2 sm:px-5 lg:px-6">
          {children}
        </div>
      </div>

      {dock && (
        <div
          ref={measureDock}
          /* The home indicator only needs clearing while the keyboard is down;
             with it up, the keyboard is the bottom of the screen. */
          className="mx-auto w-full max-w-6xl shrink-0 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2
                     group-data-[keyboard=open]/shell:pb-2 sm:px-5 lg:hidden"
        >
          {dock}
        </div>
      )}
    </div>
  );
}
