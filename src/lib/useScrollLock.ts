import { useLayoutEffect } from 'react';

/**
 * Locks background scrolling while a modal is open.
 *
 * The count lets nested overlays stack — a thread modal that opens a quotation
 * sheet, or any view that also renders a ConfirmModal — without the inner one
 * releasing the lock the outer one still needs.
 *
 * Deliberately does *not* pin the body with `position: fixed`. That is the
 * usual iOS recipe, but making the document unscrollable mid-gesture makes
 * Safari re-expand its collapsed URL bar, which changes the viewport height,
 * relays out every `inset-0` overlay and re-snapshots the backdrop-filter
 * behind them. On a phone that reads as the screen flashing something else for
 * a frame before settling. Desktop never sees it because there is no URL bar to
 * expand.
 *
 * So: `overflow: hidden` handles wheel and keyboard, and a non-passive
 * touchmove blocker handles the finger. The document keeps its layout and its
 * scroll offset throughout — nothing to restore, and nothing to flash.
 */
let lockCount = 0;

/** The nearest ancestor that can actually scroll its own content. */
function scrollableAncestor(start: EventTarget | null): Element | null {
  let el = start instanceof Element ? start : null;
  while (el && el !== document.body) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

function blockTouch(e: TouchEvent) {
  // Leave pinch-zoom alone, and never fight a listener that already opted out.
  if (e.touches.length > 1 || !e.cancelable) return;
  // A drag that started inside the modal's own scroll area is the user
  // scrolling the modal. `overscroll-behavior: none` keeps it from chaining
  // out to the page when it hits either end.
  if (scrollableAncestor(e.target)) return;
  e.preventDefault();
}

export function useScrollLock(active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      // Hiding overflow takes the scrollbar with it, which would widen the
      // page behind the modal by its width. Hold the gutter open instead.
      const gutter = window.innerWidth - document.documentElement.clientWidth;
      if (gutter > 0) document.body.style.paddingRight = `${gutter}px`;
      document.body.classList.add('modal-open');
      document.addEventListener('touchmove', blockTouch, { passive: false });
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount > 0) return;
      document.removeEventListener('touchmove', blockTouch);
      document.body.classList.remove('modal-open');
      document.body.style.paddingRight = '';
    };
  }, [active]);
}

/**
 * Same lock as a component, for modals that bail out with an early return
 * before hooks can run.
 */
export const ScrollLock: React.FC = () => {
  useScrollLock(true);
  return null;
};
