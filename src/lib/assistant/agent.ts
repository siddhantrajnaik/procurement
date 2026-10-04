import type {
  Activity, BookableItem, Booking, Equipment, InventoryItem, InventoryLogEntry, LabList, LostFoundItem,
  Purchase, Sample, SampleBox, SampleCheckout, User, Vendor,
} from '../../types';
import { rankByName, WEAK } from './match';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`;
const TIMEOUT_MS = 30_000;
/** Read-tool round trips before giving up on a single message. */
export const MAX_STEPS = 5;

// ---------------------------------------------------------------- conversation

export interface Part {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; response: Record<string, unknown>; id?: string };
}
export interface Content { role: 'user' | 'model'; parts: Part[] }

export type ChatFailure = 'offline' | 'limit' | 'unavailable';

export async function callAssistant(contents: Content[], context: Record<string, string>): Promise<Part[] | ChatFailure> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, context }),
    });
    if (res.status === 429) return 'limit';
    if (!res.ok) return 'unavailable';
    const data = await res.json();
    return Array.isArray(data.parts) ? (data.parts as Part[]) : 'unavailable';
  } catch {
    return 'unavailable';
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- tools

export interface LabSnapshot {
  me: User | null;
  users: User[];
  boxes: SampleBox[];
  samples: Sample[];
  outBySample: Map<string, SampleCheckout[]>;
  stock: InventoryItem[];
  inventoryLog: InventoryLogEntry[];
  purchases: Purchase[];
  activities: Activity[];
  equipment: Equipment[];
  bookableItems: BookableItem[];
  bookings: Booking[];
  vendors: Vendor[];
  lostFound: LostFoundItem[];
  lists: LabList[];
}

/** Tools that only read. Everything else proposes a change the person confirms. */
export const READ_TOOLS = new Set([
  'search_inventory', 'box_contents', 'list_boxes', 'low_and_expiring', 'list_requests', 'instruments',
  'bookings', 'vendors', 'lost_and_found', 'lists', 'recent_activity', 'people',
]);

export interface Proposal { id: number; tool: string; args: Record<string, unknown> }

type Args = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const first = (u: User | null | undefined) => u?.name ?? 'someone';
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);
/** Activity strings embed rupee amounts ("recorded a quotation (₹27,800)"). The assistant never sees money. */
const noMoney = (t: string) => t.replace(/₹\s?[\d,]+(?:\.\d+)?/g, '[amount hidden]');

function closest<T>(query: string, items: T[], name: (t: T) => string, limit = 5): T[] {
  if (!query) return items.slice(0, limit);
  return rankByName(query, items, name, limit).filter((r) => r.score >= WEAK).map((r) => r.item);
}

function boxOf(snap: LabSnapshot, id: string | null) {
  return id ? snap.boxes.find((b) => b.id === id) ?? null : null;
}

function sampleRow(snap: LabSnapshot, x: Sample) {
  const box = boxOf(snap, x.boxId);
  const out = snap.outBySample.get(x.id) ?? [];
  return {
    sample: x.name,
    box: box?.name ?? 'loose (no box)',
    boxLocation: box ? [box.location, box.condition].filter(Boolean).join(', ') : null,
    copies: x.copies,
    out: out.map((c) => ({ by: first(c.takenBy), since: day(c.takenAt) })),
    container: x.container || undefined,
    volume: x.volume || undefined,
    notes: x.notes || undefined,
  };
}

const stockRow = (i: InventoryItem) => ({
  stockItem: i.name,
  quantity: `${i.quantity} ${i.unit}`,
  location: i.location,
  category: i.category,
  low: i.lowStockThreshold != null && i.quantity <= i.lowStockThreshold,
  expiry: i.expiryDate ?? undefined,
});

function requestRow(p: Purchase) {
  const chosen = p.quotations.find((q) => q.isApproved);
  return {
    request: p.title,
    quantity: p.quantity,
    status: p.status,
    priority: p.priority,
    category: p.category,
    requestedBy: first(p.requestedBy),
    raised: day(p.createdAt),
    catalogueNumber: p.catalogNumber ?? undefined,
    preferredBrand: p.preferredCompany ?? undefined,
    quotesFrom: [...new Set(p.quotations.map((q) => q.vendor))],
    chosenVendor: chosen?.vendor,
    deliveries: p.deliveries.map((d) => ({ received: d.quantityReceived, on: day(d.createdAt), by: first(d.receivedBy) })),
    onVendorPage: p.vendorVisible && (p.status === 'waiting' || p.status === 'quotes'),
    comments: p.comments.slice(-3).map((c) => `${first(c.author)}: ${noMoney(c.body)}`),
  };
}

function runRead(name: string, a: Args, snap: LabSnapshot): unknown {
  const today = new Date().toISOString().slice(0, 10);
  switch (name) {
    case 'search_inventory': {
      const q = s(a.query);
      const samples = closest(q, snap.samples, (x) => x.name, 8).map((x) => sampleRow(snap, x));
      const stock = closest(q, snap.stock, (i) => i.name, 5).map(stockRow);
      return samples.length || stock.length ? { samples, stock } : { found: 'nothing matching', query: q };
    }
    case 'box_contents': {
      const box = closest(s(a.box), snap.boxes, (b) => b.name, 1)[0];
      if (!box) return { error: `No box called ${s(a.box)}`, boxes: snap.boxes.map((b) => b.name).slice(0, 80) };
      return {
        box: box.name, location: box.location, condition: box.condition,
        samples: snap.samples.filter((x) => x.boxId === box.id).map((x) => sampleRow(snap, x)),
      };
    }
    case 'list_boxes':
      return snap.boxes.map((b) => ({
        box: b.name, location: b.location, condition: b.condition,
        samples: snap.samples.filter((x) => x.boxId === b.id).length,
      }));
    case 'low_and_expiring': {
      const now = new Date(today).getTime();
      return {
        lowStock: snap.stock.filter((i) => i.lowStockThreshold != null && i.quantity <= i.lowStockThreshold).map(stockRow),
        expiringIn30Days: snap.stock
          .filter((i) => i.expiryDate && (new Date(i.expiryDate).getTime() - now) / 86_400_000 <= 30)
          .map((i) => ({ ...stockRow(i), daysLeft: Math.ceil((new Date(i.expiryDate!).getTime() - now) / 86_400_000) })),
      };
    }
    case 'list_requests': {
      const st = s(a.status).toLowerCase();
      let rows = snap.purchases;
      if (st === 'open') rows = rows.filter((p) => !['delivered', 'closed'].includes(p.status));
      else if (st) rows = rows.filter((p) => p.status === st);
      if (s(a.query)) rows = closest(s(a.query), rows, (p) => p.title, 8);
      return rows.slice(0, 25).map(requestRow);
    }
    case 'instruments': {
      const rows = s(a.query) ? closest(s(a.query), snap.equipment, (e) => e.name, 3) : snap.equipment;
      return rows.map((e) => {
        const last = [...e.usageLog].sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
        const due = e.maintenanceLogs.map((m) => m.nextDueDate).filter(Boolean).sort().pop() ?? null;
        return {
          instrument: e.name, status: e.status, location: e.location, category: e.category,
          model: [e.manufacturer, e.model].filter(Boolean).join(' ') || undefined,
          openIssues: e.issues.filter((i) => i.status !== 'fixed').map((i) => `${i.title} (${i.status})`),
          lastUsed: last ? { by: last.loggedBy?.name ?? last.visitorName, on: day(last.startedAt ?? last.createdAt), purpose: last.purpose || undefined } : null,
          nextServiceDue: due,
          serviceContact: [e.serviceVendor, e.serviceContactPerson, e.servicePhone].filter(Boolean).join(', ') || undefined,
        };
      });
    }
    case 'bookings': {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(s(a.date)) ? s(a.date) : today;
      const item = s(a.item) ? closest(s(a.item), snap.bookableItems, (b) => b.name, 1)[0] : null;
      const rows = snap.bookings
        .filter((b) => b.status === 'confirmed' && b.date === date && (!item || b.itemId === item.id))
        .sort((x, y) => x.startTime.localeCompare(y.startTime))
        .map((b) => ({
          item: snap.bookableItems.find((i) => i.id === b.itemId)?.name ?? '?',
          from: b.startTime.slice(0, 5), to: b.endTime.slice(0, 5), by: first(b.bookedBy), purpose: b.purpose || undefined,
        }));
      return { date, bookableItems: snap.bookableItems.map((b) => b.name), bookings: rows, hours: '07:00–21:00' };
    }
    case 'vendors': {
      const rows = s(a.query) ? closest(s(a.query), snap.vendors, (v) => `${v.name} ${v.comment}`, 8) : snap.vendors.slice(0, 40);
      return rows.map((v) => ({ vendor: v.name, type: v.type === 'direct' ? 'direct' : '3rd party', contact: v.contact, comment: v.comment }));
    }
    case 'lost_and_found': {
      const st = s(a.status);
      return snap.lostFound
        .filter((l) => !st || l.status === st)
        .slice(0, 20)
        .map((l) => ({ item: l.title, status: l.status === 'open' ? 'lost' : l.status, lastSeen: l.locationLastSeen, by: first(l.reportedBy), reported: day(l.createdAt), replies: l.responses.length }));
    }
    case 'lists': {
      if (s(a.title)) {
        const l = closest(s(a.title), snap.lists, (x) => x.title, 1)[0];
        if (!l) return { error: `No list called ${s(a.title)}`, lists: snap.lists.map((x) => x.title) };
        return { list: l.title, description: l.description, items: l.items.map((i) => ({ item: i.name, done: i.checked, ...i.data })) };
      }
      return snap.lists.map((l) => ({ list: l.title, items: l.items.length, open: l.items.filter((i) => !i.checked).length }));
    }
    case 'recent_activity':
      return {
        purchasing: snap.activities.slice(0, 15).map((x) => ({ who: first(x.actor), did: noMoney(x.details), item: x.purchaseTitle, when: day(x.createdAt) })),
        stock: snap.inventoryLog.slice(0, 10).map((x) => ({ who: first(x.actor), did: x.action, item: x.itemName, change: x.quantityChange ?? undefined, when: day(x.createdAt) })),
      };
    case 'people':
      return snap.users.filter((u) => u.role !== 'guest').map((u) => ({ name: u.name, role: u.role === 'pi' ? 'PI' : 'lab member', department: u.department ?? undefined }));
    default:
      return { error: `Unknown tool ${name}` };
  }
}

let proposalSeq = 0;

/** Runs one model turn's tool calls: reads answer now, actions become cards. */
export function runTools(calls: Part[], snap: LabSnapshot): { responses: Part[]; proposals: Proposal[] } {
  const responses: Part[] = [];
  const proposals: Proposal[] = [];
  for (const p of calls) {
    const call = p.functionCall!;
    const args = (call.args ?? {}) as Args;
    let response: Record<string, unknown>;
    if (READ_TOOLS.has(call.name)) {
      try {
        response = { result: runRead(call.name, args, snap) };
      } catch (e) {
        response = { error: e instanceof Error ? e.message : 'lookup failed' };
      }
    } else {
      proposals.push({ id: ++proposalSeq, tool: call.name, args });
      response = { status: 'prepared', note: 'Shown to the person as a card. Nothing is saved until they tap Save.' };
    }
    responses.push({ functionResponse: { name: call.name, response, ...(call.id ? { id: call.id } : {}) } });
  }
  return { responses, proposals };
}
