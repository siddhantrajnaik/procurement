import { useLayoutEffect } from 'react';

/**
 * Locks background scrolling while a modal is open.
 *
 * The count lets nested overlays stack — a thread modal that opens a quotation
 * sheet, or any view that also renders a ConfirmModal — without the inner one
 * releasing the lock the outer one still needs.
 *
 * This has to be a layout effect. Pinning the body reflows the whole page, and
 * with useEffect that lands *after* the modal's first paint — one frame shows
 * the unpinned page, then it reflows, which also forces the overlay's
 * backdrop-filter to recompute. On screen that reads as a flash.
 */
let lockCount = 0;
let savedScrollY = 0;

export function useScrollLock(active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      // Pinning the body removes the scrollbar, which would widen the page
      // behind the modal by its width. Hold the gutter open instead.
      const gutter = window.innerWidth - document.documentElement.clientWidth;
      if (gutter > 0) document.body.style.paddingRight = `${gutter}px`;
      document.body.style.top = `-${savedScrollY}px`;
      document.body.classList.add('modal-open');
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount > 0) return;
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
      document.body.style.paddingRight = '';
      window.scrollTo(0, savedScrollY);
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
