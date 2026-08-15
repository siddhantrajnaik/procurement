import type { Transition } from 'motion/react';

/**
 * One spring for every bottom sheet. Modals used to mix two different spring
 * configs with four more falling back to the default tween, so the same
 * gesture felt different depending on which sheet opened.
 */
export const SHEET_SPRING: Transition = {
  type: 'spring',
  damping: 28,
  stiffness: 320,
};
