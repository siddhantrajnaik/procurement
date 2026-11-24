import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Text that gets smaller until it fits the box it sits in, instead of being cut off with "…".
 * It starts at `max` (rem) and shrinks in small steps, never below `min`. The box is the parent element: give it a
 * fixed height (or a flex-1 / absolute size) and the text will fit inside it. With `oneLine` the text stays on a single
 * line and shrinks to fit the width instead.
 */
export function FitText({
  children,
  max,
  min,
  oneLine = false,
  className = '',
  lang,
}: {
  children: React.ReactNode;
  max: number;
  min: number;
  oneLine?: boolean;
  className?: string;
  lang?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const fit = () => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    let size = max;
    el.style.fontSize = `${size}rem`;
    const over = () => el.scrollWidth > box.clientWidth + 1 || el.offsetHeight > box.clientHeight + 1;
    while (over() && size > min) {
      size = Math.max(min, Math.round((size - 0.05) * 100) / 100);
      el.style.fontSize = `${size}rem`;
    }
  };

  useLayoutEffect(fit, [children, max, min]); // eslint-disable-line react-hooks/exhaustive-deps

  // The box can change size (window, or fonts arriving late), so fit again then.
  useEffect(() => {
    const box = ref.current?.parentElement;
    if (!box) return;
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={ref}
      lang={lang}
      className={`${oneLine ? 'whitespace-nowrap overflow-hidden text-ellipsis' : 'overflow-hidden break-words'} ${className}`}
      style={{ fontSize: `${max}rem` }}
    >
      {children}
    </div>
  );
}
