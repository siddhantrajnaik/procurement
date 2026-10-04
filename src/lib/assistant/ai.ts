import type { Intent, ParsedItem } from './types';

const AI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-parse`;
const TIMEOUT_MS = 10_000;

export interface AiResult {
  intents: Intent[];
  reply: string | null;
}

/** Why the AI could not answer — the screen says so and falls back to the built-in parser. */
export type AiFailure = 'offline' | 'limit' | 'unavailable';

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const strOrNull = (v: unknown) => (isStr(v) ? v : null);

function parsedItems(v: unknown): ParsedItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((i) => i && isStr(i.name))
    .map((i) => ({
      name: i.name,
      count: Number.isInteger(i.count) && i.count > 0 ? i.count : null,
      amount: typeof i.amount === 'number' && i.amount > 0 ? i.amount : null,
      unit: strOrNull(i.unit),
    }));
}

const names = (v: unknown) => (Array.isArray(v) ? v.filter(isStr) : []);

/** The server already shapes these; this re-checks so a bad response can never crash a panel. */
function checkIntent(raw: any): Intent | null {
  switch (raw?.kind) {
    case 'find': return isStr(raw.query) ? { kind: 'find', query: raw.query } : null;
    case 'box': return isStr(raw.box) ? { kind: 'box', box: raw.box } : null;
    case 'add': { const items = parsedItems(raw.items); return items.length ? { kind: 'add', box: strOrNull(raw.box), items } : null; }
    case 'move': {
      const items = names(raw.items);
      return items.length && isStr(raw.to) ? { kind: 'move', items, from: strOrNull(raw.from), to: raw.to } : null;
    }
    case 'swap':
      return isStr(raw.a?.item) && isStr(raw.b?.item)
        ? { kind: 'swap', a: { item: raw.a.item, box: strOrNull(raw.a.box) }, b: { item: raw.b.item, box: strOrNull(raw.b.box) } }
        : null;
    case 'take': case 'restock': { const items = parsedItems(raw.items); return items.length ? { kind: raw.kind, items } : null; }
    case 'return': { const items = names(raw.items); return items.length ? { kind: 'return', items } : null; }
    case 'low': return { kind: 'low' };
    case 'request':
      return isStr(raw.title)
        ? {
            kind: 'request',
            title: raw.title,
            quantity: isStr(raw.quantity) ? raw.quantity : '',
            priority: raw.priority === 'urgent' || raw.priority === 'critical' ? raw.priority : 'normal',
            note: isStr(raw.note) ? raw.note : '',
          }
        : null;
    default: return null;
  }
}

/**
 * Asks Gemini (through the assistant-parse Edge Function) what the sentence means.
 * Only the sentence and the box/item names leave the app — never prices or people.
 */
export async function askAi(text: string, boxes: string[], itemNames: string[]): Promise<AiResult | AiFailure> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(AI_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, boxes, names: itemNames }),
    });
    if (res.status === 429) return 'limit';
    if (!res.ok) return 'unavailable';
    const data = await res.json();
    const intents = (Array.isArray(data.intents) ? data.intents : []).map(checkIntent).filter((i: Intent | null): i is Intent => !!i);
    return { intents, reply: strOrNull(data.reply) };
  } catch {
    return 'unavailable';
  } finally {
    clearTimeout(timer);
  }
}
