import { useEffect, useMemo, useRef, useState } from 'react';
import { InventoryItem, Sample, SampleBox, SampleCheckout, User } from '../../types';
import type { ParsedItem } from '../../lib/assistant/types';
import { normalize } from '../../lib/assistant/match';
import * as api from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { Thing, boxLabel, onlyOne, rankBoxes, rankThings, sampleThings, stockThings } from './resolve';
import { ThingPicker, describe } from './ThingPicker';
import { toItemUnit } from './units';

export interface PanelData {
  boxes: SampleBox[];
  samples: Sample[];
  outBySample: Map<string, SampleCheckout[]>;
  stock: InventoryItem[];
  actor: User | null;
  readOnly: boolean;
  consumeItem: (item: InventoryItem, qty: number, notes?: string) => Promise<boolean>;
  restockItem: (item: InventoryItem, qty: number, notes?: string) => Promise<boolean>;
  moveItem: (item: InventoryItem, loc: string, notes?: string) => Promise<boolean>;
  reload: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
  openSample?: () => void;
}

const card = 'bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3';
const saveBtn =
  'w-full py-3 bg-primary text-white rounded-md font-medium text-sm hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed';

function outOf(d: PanelData, id: string) {
  return d.outBySample.get(id) ?? [];
}

function errText(e: unknown) {
  return e instanceof Error && e.message ? e.message : 'unknown error';
}

/**
 * Runs rows one at a time, dropping each from the list as it lands, so a retry
 * after a failure only redoes what did not save. Reports exactly what went through.
 */
async function saveRows<R>(
  rows: R[],
  label: (r: R) => string,
  write: (r: R) => Promise<void>,
  drop: (r: R) => void,
  d: PanelData,
  doneMsg: (n: number) => string
) {
  let saved = 0;
  for (const r of rows) {
    try {
      await write(r);
    } catch (e) {
      d.reload();
      d.onError(
        `${saved ? `Saved ${saved}. ` : ''}Couldn't save "${label(r)}": ${errText(e)}. It and anything after it are still in the list.`
      );
      return;
    }
    saved += 1;
    drop(r);
  }
  d.reload();
  d.onDone(doneMsg(saved));
}

function OutPill({ out }: { out: SampleCheckout[] }) {
  if (out.length === 0) return null;
  const who = out.map((c) => c.takenBy?.name.split(' ')[0] ?? '?').join(', ');
  return (
    <span className="shrink-0 whitespace-nowrap text-[10px] font-bold px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-300 border-amber-500/25">
      {out.length} out · {who}
    </span>
  );
}

function Stepper({ value, min = 1, max, onChange, label }: { value: number; min?: number; max?: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="shrink-0 flex items-center bg-[#161616] border border-[#2A2A2A] rounded-md" role="group" aria-label={label}>
      <button type="button" aria-label="Fewer" className="w-10 h-10 text-lg text-gray-300 disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <span className="w-6 text-center text-sm text-white tabular-nums" aria-live="polite">{value}</span>
      <button type="button" aria-label="More" className="w-10 h-10 text-lg text-gray-300 disabled:opacity-30" disabled={max != null && value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Remove row" className="shrink-0 w-10 h-10 flex items-center justify-center rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10">
      <span className="material-symbols-outlined text-[18px]">close</span>
    </button>
  );
}

/** Save stays reachable above the phone keyboard, and says why when it can't be pressed. */
function SaveBar({ label, disabled, busy, busyLabel, why, onSave }: { label: string; disabled: boolean; busy: boolean; busyLabel: string; why?: string | null; onSave: () => void }) {
  return (
    <div className="sticky bottom-0 -mx-4 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[#1E1E1E] border-t border-[#2A2A2A]">
      {disabled && !busy && why && <p className="text-[11px] text-amber-300 mb-1.5">{why}</p>}
      <button type="button" disabled={disabled || busy} onClick={onSave} className={saveBtn}>
        {busy ? busyLabel : label}
      </button>
    </div>
  );
}

function BoxPicker({ query, boxes, value, onChange, label }: { query: string | null; boxes: SampleBox[]; value: SampleBox | null; onChange: (b: SampleBox | null) => void; label: string }) {
  const ranked = useMemo(() => (query ? rankBoxes(query, boxes) : []), [query, boxes]);
  const touched = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (touched.current) return;
    const one = onlyOne(ranked);
    if ((one?.id ?? null) !== (value?.id ?? null)) onChangeRef.current(one);
  }, [ranked, value]);
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      <select
        value={value?.id ?? ''}
        onChange={(e) => { touched.current = true; onChange(boxes.find((b) => b.id === e.target.value) ?? null); }}
        className="w-full px-2.5 py-2.5 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white focus:outline-none focus:border-primary"
      >
        <option value="">{query && !value ? `Pick a box for "${query}"` : 'Choose a box'}</option>
        {ranked.length > 0 && !value && (
          <optgroup label="Closest">
            {ranked.map(({ item }) => <option key={`r-${item.id}`} value={item.id}>{boxLabel(item)}</option>)}
          </optgroup>
        )}
        <optgroup label="All boxes">
          {boxes.map((b) => <option key={b.id} value={b.id}>{boxLabel(b)}</option>)}
        </optgroup>
      </select>
    </label>
  );
}

// ---------------------------------------------------------------- find

export function FindPanel({ query, d }: { query: string; d: PanelData }) {
  const things = useMemo(() => [...sampleThings(d.samples, d.boxes), ...stockThings(d.stock)], [d.samples, d.boxes, d.stock]);
  const ranked = useMemo(() => rankThings(query, things, 10), [query, things]);
  const boxHit = useMemo(() => onlyOne(rankBoxes(query, d.boxes)), [query, d.boxes]);

  if (boxHit) return <BoxPanel box={boxHit.name} d={d} />;
  if (ranked.length === 0) {
    return <p className="text-sm text-gray-400 px-1">Nothing matches "{query}".</p>;
  }
  return (
    <div className={`${card} divide-y divide-[#2A2A2A]`}>
      {ranked.map(({ item }) => {
        const tappable = item.kind === 'sample' && d.openSample;
        const body = (
          <>
            <span className="material-symbols-outlined text-[16px] text-gray-500 shrink-0">
              {item.kind === 'sample' ? 'science' : 'inventory_2'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white break-words line-clamp-2">{item.name}</p>
              <p className="text-[11px] text-gray-400 truncate">{describe(item)}</p>
            </div>
            {item.kind === 'sample' && <OutPill out={outOf(d, item.id)} />}
          </>
        );
        return tappable ? (
          <button key={`${item.kind}-${item.id}`} type="button" onClick={d.openSample} className="w-full text-left py-2 flex items-center gap-2 min-w-0">
            {body}
          </button>
        ) : (
          <div key={`${item.kind}-${item.id}`} className="py-2 flex items-center gap-2 min-w-0">{body}</div>
        );
      })}
    </div>
  );
}

export function BoxPanel({ box: boxQuery, d }: { box: string; d: PanelData }) {
  const [box, setBox] = useState<SampleBox | null>(null);
  const inBox = useMemo(() => (box ? d.samples.filter((s) => s.boxId === box.id) : []), [box, d.samples]);
  return (
    <div className="space-y-2">
      <BoxPicker query={boxQuery} boxes={d.boxes} value={box} onChange={setBox} label="Box" />
      {box && (
        <div className={card}>
          <p className="text-xs text-gray-400 mb-1">
            {inBox.length} item{inBox.length !== 1 ? 's' : ''}{box.location ? ` · ${box.location}` : ''}
          </p>
          {inBox.length === 0 ? (
            <p className="text-sm text-gray-400">Empty.</p>
          ) : (
            <div className="divide-y divide-[#2A2A2A]">
              {inBox.map((s) => (
                <div key={s.id} className="py-1.5 flex items-center gap-2 min-w-0">
                  <span className="flex-1 min-w-0 text-sm text-white break-words line-clamp-2">{s.name}</span>
                  {s.copies > 1 && <span className="shrink-0 text-[11px] text-gray-400">×{s.copies}</span>}
                  <OutPill out={outOf(d, s.id)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- add

interface AddRow { key: number; name: string; copies: number; merge: boolean }

export function AddPanel({ box: boxQuery, items, d }: { box: string | null; items: ParsedItem[]; d: PanelData }) {
  const [box, setBox] = useState<SampleBox | null>(null);
  const [rows, setRows] = useState<AddRow[]>(() =>
    items.map((it, i) => ({ key: i, name: it.name, copies: Math.max(1, it.count ?? 1), merge: true }))
  );
  const [saving, setSaving] = useState(false);

  const existing = useMemo(() => {
    const m = new Map<string, Sample>();
    if (box) for (const s of d.samples) if (s.boxId === box.id) m.set(normalize(s.name), s);
    return m;
  }, [box, d.samples]);

  const valid = rows.filter((r) => r.name.trim());
  const tooLong = valid.some((r) => r.name.trim().length > 200);
  const topUps = valid.filter((r) => r.merge && existing.has(normalize(r.name)));
  const fresh = valid.filter((r) => !topUps.includes(r));
  const containers = valid.reduce((n, r) => n + r.copies, 0);
  const newNames = new Set(fresh.map((r) => normalize(r.name))).size;

  const save = async () => {
    const actor = d.actor;
    if (!actor || d.readOnly || !box || valid.length === 0 || tooLong) return;
    setSaving(true);
    try {
      // The same name twice in one list is one row with more copies.
      const merged = new Map<string, { name: string; copies: number; keys: number[] }>();
      for (const r of fresh) {
        const k = normalize(r.name);
        const m = merged.get(k);
        if (m) { m.copies += r.copies; m.keys.push(r.key); } else merged.set(k, { name: r.name.trim(), copies: r.copies, keys: [r.key] });
      }
      if (merged.size > 0) {
        try {
          // One insert: all the new rows land or none do.
          await api.bulkCreateSamples([...merged.values()].map(({ name, copies }) => ({ name, copies })), box.id, actor, 'assistant');
        } catch (e) {
          d.onError(`Nothing was saved: ${errText(e)}.`);
          return;
        }
        const done = new Set([...merged.values()].flatMap((m) => m.keys));
        setRows((rs) => rs.filter((r) => !done.has(r.key)));
      }
      await saveRows(
        topUps,
        (r) => r.name,
        async (r) => { await api.addSampleCopies(existing.get(normalize(r.name))!.id, r.copies, actor); },
        (r) => setRows((rs) => rs.filter((x) => x.key !== r.key)),
        d,
        (n) => `${box.name}: ${merged.size} added${n ? `, ${n} topped up` : ''}.`
      );
    } finally {
      setSaving(false);
    }
  };

  const why = !box ? 'Choose a box first.' : tooLong ? 'Shorten the name marked in red.' : valid.length === 0 ? 'Nothing to add.' : null;

  return (
    <div className="space-y-2">
      <BoxPicker query={boxQuery} boxes={d.boxes} value={box} onChange={setBox} label="Into box" />
      <div className={`${card} space-y-2`}>
        {rows.map((r, i) => {
          const hit = existing.get(normalize(r.name));
          const long = r.name.trim().length > 200;
          return (
            <div key={r.key} className="space-y-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <input
                  value={r.name}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className={`flex-1 min-w-0 px-2.5 py-2 bg-[#161616] border rounded-md text-sm text-white focus:outline-none focus:border-primary ${long ? 'border-red-500/60' : 'border-[#2A2A2A]'}`}
                  aria-label="Sample name"
                />
                <Stepper label="Copies" value={r.copies} onChange={(n) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, copies: n } : x)))} />
                <RemoveBtn onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} />
              </div>
              {long && <p className="text-[11px] text-red-400">Over 200 characters — shorten it.</p>}
              {hit && (
                <label className="flex items-center gap-2 min-h-10 text-[11px] text-amber-300">
                  <input
                    type="checkbox"
                    checked={r.merge}
                    onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, merge: e.target.checked } : x)))}
                    className="w-5 h-5 accent-primary shrink-0"
                  />
                  Already here ×{hit.copies} — add as {r.copies} more cop{r.copies === 1 ? 'y' : 'ies'}
                </label>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, { key: Date.now(), name: '', copies: 1, merge: true }])}
          className="min-h-10 text-xs text-primary"
        >
          + Add a row
        </button>
      </div>
      <SaveBar
        label={`Add ${newNames} new${topUps.length ? ` + ${topUps.length} top-up` : ''} (${containers} container${containers !== 1 ? 's' : ''}) to ${box?.name ?? 'box'}`}
        disabled={!!why}
        busy={saving}
        busyLabel="Saving…"
        why={why}
        onSave={() => void save()}
      />
    </div>
  );
}

// ---------------------------------------------------------------- move / swap

interface MoveRow { key: number; query: string; thing: Thing | null }

export function MovePanel({ items, from, to, d }: { items: string[]; from: string | null; to: string; d: PanelData }) {
  const [fromBox, setFromBox] = useState<SampleBox | null>(null);
  const [toBox, setToBox] = useState<SampleBox | null>(null);
  const [stockLoc, setStockLoc] = useState(to);
  const [rows, setRows] = useState<MoveRow[]>(() => items.map((q, i) => ({ key: i, query: q, thing: null })));
  const [saving, setSaving] = useState(false);

  const things = useMemo(() => {
    const samples = fromBox ? d.samples.filter((s) => s.boxId === fromBox.id) : d.samples;
    return [...sampleThings(samples, d.boxes), ...stockThings(d.stock)];
  }, [fromBox, d.samples, d.boxes, d.stock]);

  const chosen = rows.map((r) => r.thing).filter((t): t is Thing => t !== null);
  const hasSamples = chosen.some((t) => t.kind === 'sample');
  const hasStock = chosen.some((t) => t.kind === 'stock');
  const why =
    rows.length === 0 ? 'Nothing to move.'
    : chosen.length < rows.length ? 'Pick which item each row means.'
    : hasSamples && !toBox ? 'Choose the box to move to.'
    : hasStock && !stockLoc.trim() ? 'Type the new location for the stock item.'
    : null;

  const save = async () => {
    const actor = d.actor;
    if (!actor || d.readOnly || why) return;
    setSaving(true);
    try {
      const dest = toBox?.name ?? stockLoc.trim();
      await saveRows(
        rows,
        (r) => r.thing!.name,
        async (r) => {
          const t = r.thing!;
          if (t.kind === 'sample') {
            await api.moveSampleTo({ sampleId: t.id, toBoxId: toBox!.id, fromBoxName: t.box?.name ?? '', toBoxName: toBox!.name }, actor);
          } else if (!(await d.moveItem(t.item, stockLoc.trim()))) {
            throw new Error('the stock move was refused');
          }
        },
        (r) => setRows((rs) => rs.filter((x) => x.key !== r.key)),
        d,
        (n) => `Moved ${n} to ${dest}.`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {from && <BoxPicker query={from} boxes={d.boxes} value={fromBox} onChange={setFromBox} label="From box" />}
      <div className={`${card} space-y-3`}>
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-start gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <ThingPicker query={r.query} things={things} value={r.thing} onChange={(t) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, thing: t } : x)))} />
            </div>
            <RemoveBtn onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} />
          </div>
        ))}
      </div>
      {(hasSamples || !hasStock) && <BoxPicker query={to} boxes={d.boxes} value={toBox} onChange={setToBox} label="To box" />}
      {hasStock && (
        <label className="block">
          <span className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">New location for stock</span>
          <input value={stockLoc} onChange={(e) => setStockLoc(e.target.value)} className="w-full px-2.5 py-2.5 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white focus:outline-none focus:border-primary" />
        </label>
      )}
      <SaveBar
        label={`Move ${rows.length} to ${toBox?.name ?? (hasStock && stockLoc.trim() ? stockLoc.trim() : '…')}`}
        disabled={!!why}
        busy={saving}
        busyLabel="Moving…"
        why={why}
        onSave={() => void save()}
      />
    </div>
  );
}

export function SwapPanel({ a, b, d }: { a: { item: string; box: string | null }; b: { item: string; box: string | null }; d: PanelData }) {
  const [ta, setTa] = useState<Thing | null>(null);
  const [tb, setTb] = useState<Thing | null>(null);
  const [saving, setSaving] = useState(false);
  const thingsA = useMemo(() => inNamedBox(a.box, d), [a.box, d.samples, d.boxes]); // eslint-disable-line react-hooks/exhaustive-deps
  const thingsB = useMemo(() => inNamedBox(b.box, d), [b.box, d.samples, d.boxes]); // eslint-disable-line react-hooks/exhaustive-deps
  const sa = ta?.kind === 'sample' ? ta : null;
  const sb = tb?.kind === 'sample' ? tb : null;
  const why = !sa || !sb ? 'Pick both samples.' : sa.box?.id === sb.box?.id ? 'Both are already in the same box.' : null;

  const save = async () => {
    const actor = d.actor;
    if (!actor || d.readOnly || !sa || !sb || why) return;
    setSaving(true);
    const there = { sampleId: sa.id, toBoxId: sb.box?.id ?? null, fromBoxName: sa.box?.name ?? '', toBoxName: sb.box?.name ?? '' };
    try {
      await api.moveSampleTo(there, actor);
    } catch (e) {
      setSaving(false);
      d.reload();
      d.onError(`Nothing was swapped: ${errText(e)}.`);
      return;
    }
    try {
      await api.moveSampleTo({ sampleId: sb.id, toBoxId: sa.box?.id ?? null, fromBoxName: sb.box?.name ?? '', toBoxName: sa.box?.name ?? '' }, actor);
      d.reload();
      d.onDone(`Swapped ${sa.name} and ${sb.name}.`);
    } catch (e) {
      // Half a swap leaves both in one box; put the first one back.
      try {
        await api.moveSampleTo({ sampleId: sa.id, toBoxId: sa.box?.id ?? null, fromBoxName: there.toBoxName, toBoxName: there.fromBoxName }, actor);
        d.onError(`Nothing was swapped: ${errText(e)}.`);
      } catch {
        d.onError(`${sa.name} moved to ${there.toBoxName || 'loose'} but ${sb.name} did not — check both boxes.`);
      }
      d.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className={`${card} space-y-3`}>
        <ThingPicker query={a.item} things={thingsA} value={ta} onChange={setTa} />
        <div className="flex items-center gap-2 text-gray-400 text-xs"><span className="material-symbols-outlined text-[16px]">swap_vert</span>swaps places with</div>
        <ThingPicker query={b.item} things={thingsB} value={tb} onChange={setTb} />
      </div>
      <SaveBar
        label={sa && sb ? `Swap ${sa.box?.name ?? 'loose'} ↔ ${sb.box?.name ?? 'loose'}` : 'Swap'}
        disabled={!!why}
        busy={saving}
        busyLabel="Swapping…"
        why={why}
        onSave={() => void save()}
      />
    </div>
  );
}

function inNamedBox(boxQuery: string | null, d: PanelData): Thing[] {
  const box = boxQuery ? onlyOne(rankBoxes(boxQuery, d.boxes)) : null;
  const samples = box ? d.samples.filter((s) => s.boxId === box.id) : d.samples;
  return sampleThings(samples, d.boxes);
}

// ---------------------------------------------------------------- take / return / restock

interface QtyRow { key: number; parsed: ParsedItem; thing: Thing | null; n: number; amount: string }

function prefill(parsed: ParsedItem, t: Thing | null): string {
  if (!t || t.kind !== 'stock' || parsed.amount == null) return '';
  const v = toItemUnit(parsed.amount, parsed.unit, t.item.unit);
  return v == null ? '' : String(v);
}

function QtyControls({ row, d, mode, set }: { row: QtyRow; d: PanelData; mode: 'take' | 'restock'; set: (r: Partial<QtyRow>) => void }) {
  const t = row.thing;
  if (!t) return null;
  if (t.kind === 'stock') {
    const said = row.parsed.amount != null ? `${row.parsed.amount} ${row.parsed.unit ?? ''}`.trim() : null;
    const converted = said && row.parsed.unit && row.amount && row.parsed.unit.toLowerCase() !== t.item.unit.toLowerCase();
    const unconvertible = said && row.parsed.unit && !row.amount && toItemUnit(row.parsed.amount!, row.parsed.unit, t.item.unit) == null;
    return (
      <div className="mt-1 space-y-1">
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            value={row.amount}
            onChange={(e) => set({ amount: e.target.value })}
            placeholder="Amount"
            aria-label={`Amount in ${t.item.unit}`}
            className="w-24 px-2 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white focus:outline-none focus:border-primary"
          />
          <span className="text-xs text-gray-400">{t.item.unit} · have {t.item.quantity}</span>
        </div>
        {converted && <p className="text-[11px] text-gray-400">You said {said} = {row.amount} {t.item.unit}</p>}
        {unconvertible && <p className="text-[11px] text-amber-300">You said {said} — enter it in {t.item.unit}.</p>}
      </div>
    );
  }
  const out = outOf(d, t.id).length;
  if (mode === 'take') {
    const free = t.sample.copies - out;
    return (
      <div className="flex items-center gap-2 mt-1">
        {free > 0 ? (
          <>
            <span className="text-xs text-gray-400">Take out</span>
            <Stepper label="How many to take out" value={Math.min(row.n, free)} max={free} onChange={(n) => set({ n })} />
            <span className="text-xs text-gray-400">of ×{t.sample.copies}{out ? ` (${out} already out)` : ''}</span>
          </>
        ) : (
          <span className="text-xs text-amber-300">All {t.sample.copies} already out</span>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-xs text-gray-400">Add</span>
      <Stepper label="Copies to add" value={row.n} onChange={(n) => set({ n })} />
      <span className="text-xs text-gray-400">cop{row.n === 1 ? 'y' : 'ies'} to ×{t.sample.copies}</span>
    </div>
  );
}

function QtyPanel({ items, d, mode }: { items: ParsedItem[]; d: PanelData; mode: 'take' | 'restock' }) {
  const [rows, setRows] = useState<QtyRow[]>(() =>
    items.map((p, i) => ({ key: i, parsed: p, thing: null, n: Math.max(1, p.count ?? 1), amount: '' }))
  );
  const [saving, setSaving] = useState(false);
  const things = useMemo(() => [...sampleThings(d.samples, d.boxes), ...stockThings(d.stock)], [d.samples, d.boxes, d.stock]);
  const set = (key: number, patch: Partial<QtyRow>) => setRows((rs) => rs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const rowReady = (r: QtyRow) => {
    if (!r.thing) return false;
    if (r.thing.kind === 'stock') return Number(r.amount) > 0;
    return mode === 'restock' || r.thing.sample.copies - outOf(d, r.thing.id).length > 0;
  };
  const why =
    rows.length === 0 ? 'Nothing to record.'
    : rows.some((r) => !r.thing) ? 'Pick which item each row means.'
    : rows.some((r) => r.thing?.kind === 'stock' && !(Number(r.amount) > 0)) ? 'Enter an amount for each stock item.'
    : rows.every(rowReady) ? null
    : 'Every copy of one of these is already out.';

  const save = async () => {
    const actor = d.actor;
    if (!actor || d.readOnly || why) return;
    setSaving(true);
    try {
      // Two rows naming the same thing become one write, so the second does
      // not overwrite the first from the same starting quantity.
      const groups = new Map<string, { thing: Thing; n: number; amount: number; keys: number[] }>();
      for (const r of rows) {
        const t = r.thing!;
        const g = groups.get(`${t.kind}-${t.id}`);
        if (g) { g.n += r.n; g.amount += Number(r.amount) || 0; g.keys.push(r.key); }
        else groups.set(`${t.kind}-${t.id}`, { thing: t, n: r.n, amount: Number(r.amount) || 0, keys: [r.key] });
      }
      await saveRows(
        [...groups.values()],
        (g) => g.thing.name,
        async (g) => {
          const t = g.thing;
          if (t.kind === 'stock') {
            const item = d.stock.find((s) => s.id === t.id) ?? t.item; // latest quantity, not the one at pick time
            const ok = mode === 'take' ? await d.consumeItem(item, g.amount, 'via assistant') : await d.restockItem(item, g.amount, 'via assistant');
            if (!ok) throw new Error('the stock change was refused');
          } else if (mode === 'take') {
            for (let k = 0; k < g.n; k += 1) {
              await api.takeSample(t.id, actor); // the database refuses once every copy is out
              if (g.n - k - 1 > 0) setRows((rs) => rs.map((x) => (g.keys.includes(x.key) ? { ...x, n: g.n - k - 1 } : x)));
            }
          } else {
            await api.addSampleCopies(t.id, g.n, actor);
          }
        },
        (g) => setRows((rs) => rs.filter((x) => !g.keys.includes(x.key))),
        d,
        (n) => (mode === 'take' ? `Recorded ${n} taken.` : `Restocked ${n}.`)
      );
    } finally {
      setSaving(false);
    }
  };

  const takeCount = rows.reduce((n, r) => n + (r.thing?.kind === 'sample' ? r.n : 0), 0);
  const stockCount = rows.filter((r) => r.thing?.kind === 'stock').length;
  const label =
    mode === 'take'
      ? [takeCount && `Take out ${takeCount}`, stockCount && `use ${stockCount} stock`].filter(Boolean).join(', ') || 'Record'
      : `Restock ${rows.length}`;

  return (
    <div className="space-y-2">
      <div className={`${card} space-y-3`}>
        {rows.map((r) => (
          <div key={r.key} className="flex items-start gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <ThingPicker
                query={r.parsed.name}
                things={things}
                value={r.thing}
                onChange={(t) => set(r.key, { thing: t, amount: r.amount || prefill(r.parsed, t) })}
              />
              <QtyControls row={r} d={d} mode={mode} set={(p) => set(r.key, p)} />
            </div>
            <RemoveBtn onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
          </div>
        ))}
      </div>
      <SaveBar label={label} disabled={!!why} busy={saving} busyLabel="Saving…" why={why} onSave={() => void save()} />
    </div>
  );
}

export const TakePanel = ({ items, d }: { items: ParsedItem[]; d: PanelData }) => <QtyPanel items={items} d={d} mode="take" />;
export const RestockPanel = ({ items, d }: { items: ParsedItem[]; d: PanelData }) => <QtyPanel items={items} d={d} mode="restock" />;

export function ReturnPanel({ items, d }: { items: string[]; d: PanelData }) {
  const [rows, setRows] = useState(() => items.map((q, i) => ({ key: i, query: q, thing: null as Thing | null })));
  const [saving, setSaving] = useState(false);
  // Only things that are actually out can come back.
  const things = useMemo(
    () => sampleThings(d.samples.filter((s) => (d.outBySample.get(s.id)?.length ?? 0) > 0), d.boxes),
    [d.samples, d.boxes, d.outBySample]
  );
  const why = rows.length === 0 ? 'Nothing to put back.' : rows.some((r) => !r.thing) ? 'Pick which item each row means.' : null;

  const save = async () => {
    const actor = d.actor;
    if (!actor || d.readOnly || why) return;
    setSaving(true);
    try {
      await saveRows(
        rows,
        (r) => r.thing!.name,
        async (r) => { if (!(await api.returnSample(r.thing!.id, actor))) throw new Error('it was not out'); },
        (r) => setRows((rs) => rs.filter((x) => x.key !== r.key)),
        d,
        (n) => `Put back ${n}.`
      );
    } finally {
      setSaving(false);
    }
  };

  if (things.length === 0) return <p className="text-sm text-gray-400 px-1">Nothing is taken out right now.</p>;
  return (
    <div className="space-y-2">
      <div className={`${card} space-y-3`}>
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-start gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <ThingPicker query={r.query} things={things} value={r.thing} onChange={(t) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, thing: t } : x)))} />
              {r.thing?.kind === 'sample' && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Out: {outOf(d, r.thing.id).map((c) => `${c.takenBy?.name.split(' ')[0] ?? '?'} ${timeAgo(c.takenAt)}`).join(', ')}
                </p>
              )}
            </div>
            <RemoveBtn onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} />
          </div>
        ))}
      </div>
      <SaveBar label={`Put back ${rows.length}`} disabled={!!why} busy={saving} busyLabel="Saving…" why={why} onSave={() => void save()} />
    </div>
  );
}
