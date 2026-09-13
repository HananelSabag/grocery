import { useEffect, useState } from 'react';

/**
 * Pin an element to exactly the part of the screen you can see.
 *
 * iOS Safari keeps `position: fixed` anchored to the LAYOUT viewport, and the
 * on-screen keyboard only shrinks the VISUAL one. So when the add field at the
 * bottom is tapped, Safari pans the visual viewport down to reveal it — and
 * everything moves with it: the header and the top of the list slide off the
 * screen, and what is left in view is the empty space under a short list. That
 * is what "tapping the input drags the whole screen down" was.
 *
 * The fix before this one lifted only the composer, by the keyboard's height
 * measured as innerHeight − (visual height + offsetTop). But once Safari has
 * panned, offsetTop has already absorbed the keyboard, the measurement comes
 * out near zero, and the page it was meant to hold still is already gone.
 *
 * So the whole screen follows the visual viewport instead: the element's
 * height becomes what is visible, and it is translated by however far Safari
 * panned. With the keyboard up the page is simply shorter — header still at the
 * top, the list where you left it, the add field sitting on the keyboard.
 *
 * Applied synchronously on every event. It was first deferred to the next
 * animation frame, and a frame can arrive late: measured mid-resize, the frame
 * was still 812px tall inside a 460px window, which on a phone is the list
 * visibly jumping as the keyboard slides in. The viewport already fires these
 * events at most once a frame; there is nothing to batch.
 *
 * iOS 26 does not always put offsetTop back to 0 after the keyboard closes,
 * which leaves a fixed layout hanging too high. When focus leaves a field and
 * nothing else takes it, the document is scrolled back to the top, which makes
 * Safari recompute, and the position is read again.
 *
 * Pinch-zoom is left alone: while zoomed, the visual viewport is a magnifier
 * over the page, not the page, and following it would reflow the screen under
 * the person's fingers.
 *
 * Returns a callback ref. Without visualViewport the element keeps its CSS
 * height (100dvh), which is also the right answer on a desktop.
 */
export function useViewportShell() {
  const [node, setNode] = useState(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!node || !viewport) return undefined;

    let settle = 0;

    const apply = () => {
      if (viewport.scale > 1.01) {
        node.style.height = '';
        node.style.transform = '';
        node.dataset.keyboard = 'closed';
        return;
      }

      const top = Math.max(0, viewport.offsetTop);
      node.style.height = `${Math.round(viewport.height)}px`;
      node.style.transform = top >= 1 ? `translateY(${Math.round(top)}px)` : '';
      // Browser chrome sliding in and out moves the height by a few dozen
      // pixels; only a keyboard takes this much.
      node.dataset.keyboard = window.innerHeight - viewport.height > 120 ? 'open' : 'closed';
    };

    const onFocusOut = () => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        const active = document.activeElement;
        const typing = !!active
          && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
        if (!typing) window.scrollTo(0, 0);
        apply();
      }, 120);
    };

    apply();
    viewport.addEventListener('resize', apply);
    viewport.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    document.addEventListener('focusout', onFocusOut);

    return () => {
      clearTimeout(settle);
      viewport.removeEventListener('resize', apply);
      viewport.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [node]);

  return setNode;
}

export default useViewportShell;
