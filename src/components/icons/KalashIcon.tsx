/**
 * A kalash with mango leaves, and a clock in its belly.
 *
 * Drawn rather than bitmapped: it sits beside lucide icons in the same grid, so
 * it takes the same 24-unit box, the same 1.5 stroke and `currentColor` — which
 * means it inherits `text-primary` like everything around it, stays sharp on a
 * projector, and costs no request.
 *
 * The clock face is the whole point of the symbol: a muhurat is an auspicious
 * *time*, so the pot holds one.
 */
export const KalashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {/* Three leaves, not the five of a real kalash.
        This is drawn for the 20px box it actually sits in: at that size five
        leaves close up into a solid blob and the fan stops reading at all.
        Three, spread wide, still say "kalash" and survive being small. */}
    {[-42, 0, 42].map((angle) => (
      <path
        key={angle}
        d="M12 9 C10.9 7.1 10.9 4.6 12 2.8 C13.1 4.6 13.1 7.1 12 9 Z"
        transform={`rotate(${angle} 12 9.6)`}
      />
    ))}

    {/* Collar */}
    <path d="M7 9.8 H17 L16.2 11.4 H7.8 Z" />

    {/* Body */}
    <path d="M7.8 11.4 C4.6 13 4.1 17.3 7.4 19.3 H16.6 C19.9 17.3 19.4 13 16.2 11.4" />

    {/* Foot */}
    <path d="M8.3 19.3 L7.4 21.3 H16.6 L15.7 19.3" />

    {/* The clock, as one polyline: up the hour hand, then out along the minute.
        Two separate strokes from the centre read as a checkmark rather than a
        clock — both hands end up pointing the same way. This is lucide's own
        clock idiom (`M12 6v6l4 2`), scaled into the belly of the pot. */}
    <path d="M12 13.5 V15.7 L14.2 16.6" />
  </svg>
);
