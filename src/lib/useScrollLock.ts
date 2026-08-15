import { useEffect } from 'react';

/**
 * Locks background scrolling while a modal is open.
 *
 * The count lets nested overlays stack — a thread modal that opens a quotation
 * sheet, or any view that also renders a ConfirmModal — without the inner one
 * releasing the lock the outer one still needs.
 */
let lockCount = 0;
let savedScrollY = 0;

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      document.body.style.top = `-${savedScrollY}px`;
      document.body.classList.add('modal-open');
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount > 0) return;
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
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
