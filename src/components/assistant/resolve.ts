import { InventoryItem, Sample, SampleBox } from '../../types';
import { rankByName, resolveBoxes, pick } from '../../lib/assistant/match';
import type { Ranked } from '../../lib/assistant/types';

/** Anything the assistant can point at: a sample in a box, or a stock item. */
export type Thing =
  | { kind: 'sample'; id: string; name: string; sample: Sample; box: SampleBox | null }
  | { kind: 'stock'; id: string; name: string; item: InventoryItem };

export function sampleThings(samples: Sample[], boxes: SampleBox[]): Thing[] {
  const byId = new Map(boxes.map((b) => [b.id, b]));
  return samples.map((s) => ({
    kind: 'sample' as const,
    id: s.id,
    name: s.name,
    sample: s,
    box: s.boxId ? byId.get(s.boxId) ?? null : null,
  }));
}

export function stockThings(items: InventoryItem[]): Thing[] {
  return items.map((i) => ({ kind: 'stock' as const, id: i.id, name: i.name, item: i }));
}

export function rankThings(query: string, things: Thing[], limit = 6): Ranked<Thing>[] {
  return rankByName(query, things, (t) => t.name, limit);
}

export function rankBoxes(query: string, boxes: SampleBox[], limit = 5): Ranked<SampleBox>[] {
  return resolveBoxes(query, boxes, (b) => b.name, limit);
}

/** The single confident answer, or null when the person has to choose. */
export function onlyOne<T>(ranked: Ranked<T>[]): T | null {
  const p = pick(ranked);
  return p.kind === 'one' ? p.item : null;
}

export function boxLabel(box: SampleBox | null): string {
  if (!box) return 'loose';
  return box.condition ? `${box.name} · ${box.condition}` : box.name;
}

/** Box and where it sits, without saying "Chemical Cabinet" twice. */
export function boxWhere(box: SampleBox | null): string {
  if (!box) return 'loose';
  const loc = box.location.trim();
  if (!loc) return boxLabel(box);
  const cond = box.condition.trim().toLowerCase();
  return cond && loc.toLowerCase().includes(cond) ? `${box.name} · ${loc}` : `${boxLabel(box)} · ${loc}`;
}
