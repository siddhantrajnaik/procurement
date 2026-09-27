import { useEffect, useMemo, useRef, useState } from 'react';
import { Thing, boxWhere, onlyOne, rankThings } from './resolve';

interface Props {
  query: string;
  things: Thing[];
  value: Thing | null;
  onChange: (t: Thing | null) => void;
}

const same = (a: Thing | null, b: Thing | null) => (a?.kind ?? null) === (b?.kind ?? null) && (a?.id ?? null) === (b?.id ?? null);

/**
 * One named thing in a command, resolved against real rows. A confident match
 * is picked for you; otherwise the closest few are offered and the words can
 * be retyped — it never guesses silently between "Triton X" and "Triton X-100".
 *
 * Until the person touches it, the pick follows the data: naming a from-box,
 * or a realtime change, can make a match confident or ambiguous after mount.
 */
export const ThingPicker: React.FC<Props> = ({ query: initialQuery, things, value, onChange }) => {
  const [query, setQuery] = useState(initialQuery);
  const [editing, setEditing] = useState(false);
  const touched = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const ranked = useMemo(() => rankThings(query, things), [query, things]);

  useEffect(() => {
    if (touched.current) return;
    const one = onlyOne(ranked);
    if (!same(one, value)) onChangeRef.current(one);
  }, [ranked, value]);

  const choose = (t: Thing | null) => {
    touched.current = true;
    onChange(t);
    setEditing(false);
  };

  if (value && !editing) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white break-words line-clamp-2">{value.name}</p>
          <p className="text-[11px] text-gray-400 truncate">
            {!touched.current && <span className="text-emerald-400">matched · </span>}
            {describe(value)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { touched.current = true; setEditing(true); onChange(null); }}
          className="shrink-0 min-h-10 px-3 rounded-md text-xs text-gray-300 hover:text-white hover:bg-[#2A2A2A]"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 min-w-0">
      <input
        value={query}
        onChange={(e) => { touched.current = true; setQuery(e.target.value); }}
        className="w-full px-2.5 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white focus:outline-none focus:border-primary"
        aria-label="Which item"
      />
      {ranked.length === 0 ? (
        <p className="text-[11px] text-red-400">Nothing called "{query}" — retype it or remove this row.</p>
      ) : (
        <div className="flex flex-col gap-1" role="listbox" aria-label={`Matches for ${query}`}>
          {ranked.slice(0, 5).map(({ item }) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => choose(item)}
              className="text-left min-h-11 px-2.5 py-1.5 rounded-md bg-[#161616] border border-[#2A2A2A] hover:border-primary/50 min-w-0"
            >
              <span className="block text-xs text-white break-words line-clamp-2">{item.name}</span>
              <span className="block text-[10px] text-gray-400 truncate">{describe(item)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export function describe(t: Thing): string {
  if (t.kind === 'stock') {
    return `Stock · ${t.item.quantity} ${t.item.unit}${t.item.location ? ` · ${t.item.location}` : ''}`;
  }
  const copies = t.sample.copies > 1 ? ` · ×${t.sample.copies}` : '';
  return `${boxWhere(t.box)}${copies}`;
}
