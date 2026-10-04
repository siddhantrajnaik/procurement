import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../lib/api';
import { rankByName, WEAK } from '../../lib/assistant/match';
import type { Intent, ParsedItem } from '../../lib/assistant/types';
import type { Proposal } from '../../lib/assistant/agent';
import { EquipmentStatus, PurchaseStatus } from '../../types';
import type { PanelData } from './panels';

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function items(v: unknown): ParsedItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? { name: x } : (x as Args)))
    .filter((x) => str(x?.name))
    .map((x) => ({
      name: str(x.name),
      count: num(x.count) != null && Number.isInteger(x.count) && (x.count as number) > 0 ? (x.count as number) : null,
      amount: num(x.amount) != null && (x.amount as number) > 0 ? (x.amount as number) : null,
      unit: str(x.unit) || null,
    }));
}
const names = (v: unknown) => items(v).map((i) => i.name);

/** Inventory and sample actions reuse the review panels the assistant already had. */
export function proposalToIntent(p: Proposal): Intent | null {
  const a = p.args;
  switch (p.tool) {
    case 'add_samples': { const it = items(a.items); return it.length ? { kind: 'add', box: str(a.box) || null, items: it } : null; }
    case 'move_samples': { const it = names(a.items); return it.length && str(a.to) ? { kind: 'move', items: it, from: str(a.from) || null, to: str(a.to) } : null; }
    case 'swap_samples':
      return str(a.a_item) && str(a.b_item)
        ? { kind: 'swap', a: { item: str(a.a_item), box: str(a.a_box) || null }, b: { item: str(a.b_item), box: str(a.b_box) || null } }
        : null;
    case 'take_out': { const it = items(a.items); return it.length ? { kind: 'take', items: it } : null; }
    case 'put_back': { const it = names(a.items); return it.length ? { kind: 'return', items: it } : null; }
    case 'restock': { const it = items(a.items); return it.length ? { kind: 'restock', items: it } : null; }
    case 'new_box': return str(a.name) ? { kind: 'newbox', name: str(a.name), condition: str(a.condition), location: str(a.location) } : null;
    case 'new_stock_item':
      return str(a.name)
        ? { kind: 'newstock', name: str(a.name), quantity: num(a.quantity), unit: str(a.unit), location: str(a.location), category: str(a.category) }
        : null;
    case 'create_request': {
      if (!str(a.title)) return null;
      const pr = str(a.priority).toLowerCase();
      return {
        kind: 'request', title: str(a.title), quantity: str(a.quantity),
        priority: pr === 'urgent' || pr === 'critical' ? pr : 'normal',
        note: str(a.note), catalogNumber: str(a.catalog_number), brand: str(a.brand),
      };
    }
    default: return null;
  }
}

export const PROPOSAL_TITLES: Record<string, string> = {
  update_stock_item: 'Update stock item', add_quote: 'Add quotation', select_po: 'Select PO', set_request_status: 'Change request status',
  record_delivery: 'Record delivery', comment_on_request: 'Comment on request', report_issue: 'Report instrument issue',
  set_instrument_status: 'Instrument status', log_instrument_use: 'Log instrument use', book_slot: 'Book a slot',
  cancel_booking: 'Cancel booking', report_lost: 'Report lost item', update_lost_found: 'Lost & found',
  add_list_item: 'Add to list', new_note: 'New notebook page', add_vendor: 'Add vendor',
};

// ---------------------------------------------------------------- building blocks

const card = 'bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3 space-y-2.5';
const inputCls = 'w-full px-2.5 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white focus:outline-none focus:border-primary';
const labelCls = 'block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className={labelCls}>{label}</span>{children}</label>;
}

/** Picks the record the model named; close matches first, then everything, so a wrong guess is one tap to fix. */
function usePick<T extends { id: string }>(query: string, list: T[], name: (t: T) => string) {
  const ranked = useMemo(() => rankByName(query, list, name, 5).filter((r) => r.score >= WEAK), [query, list, name]);
  const [id, setId] = useState<string>(() => ranked[0]?.item.id ?? '');
  const value = list.find((t) => t.id === id) ?? null;
  const select = (
    <select className={inputCls} value={id} onChange={(e) => setId(e.target.value)}>
      <option value="">{query ? `Choose (said: "${query}")` : 'Choose'}</option>
      {ranked.length > 0 && <optgroup label="Closest">{ranked.map((r) => <option key={`c${r.item.id}`} value={r.item.id}>{name(r.item)}</option>)}</optgroup>}
      <optgroup label="All">{list.map((t) => <option key={t.id} value={t.id}>{name(t)}</option>)}</optgroup>
    </select>
  );
  return { value, select };
}

function Save({ label, why, busy, onSave }: { label: string; why: string | null; busy: boolean; onSave: () => void }) {
  return (
    <div className="pt-1">
      {why && !busy && <p className="text-[11px] text-amber-300 mb-1.5">{why}</p>}
      <button type="button" disabled={!!why || busy} onClick={onSave}
        className="w-full py-3 bg-primary text-white rounded-md font-medium text-sm hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed">
        {busy ? 'Saving…' : label}
      </button>
    </div>
  );
}

function useSaver(d: PanelData) {
  const [busy, setBusy] = useState(false);
  const save = async (fn: () => Promise<boolean | void>, done: string) => {
    if (busy || d.readOnly) return;
    setBusy(true);
    try {
      const ok = await fn();
      if (ok !== false) d.onDone(done);
    } catch (e) {
      d.onError(e instanceof Error ? e.message : 'Could not save that.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, save };
}

const titleOf = (p: { title: string }) => p.title;
const nameOf = (p: { name: string }) => p.name;

// ---------------------------------------------------------------- the cards

export function ProposalCard({ proposal, d }: { proposal: Proposal; d: PanelData }) {
  const a = proposal.args;
  switch (proposal.tool) {
    case 'update_stock_item': return <UpdateStock a={a} d={d} />;
    case 'add_quote': return <AddQuote a={a} d={d} />;
    case 'select_po': return <SelectPo a={a} d={d} />;
    case 'set_request_status': return <RequestStatus a={a} d={d} />;
    case 'record_delivery': return <Delivery a={a} d={d} />;
    case 'comment_on_request': return <Comment a={a} d={d} />;
    case 'report_issue': return <Issue a={a} d={d} />;
    case 'set_instrument_status': return <InstrumentStatus a={a} d={d} />;
    case 'log_instrument_use': return <LogUse a={a} d={d} />;
    case 'book_slot': return <Book a={a} d={d} />;
    case 'cancel_booking': return <CancelBooking a={a} d={d} />;
    case 'report_lost': return <ReportLost a={a} d={d} />;
    case 'update_lost_found': return <LostFoundStatus a={a} d={d} />;
    case 'add_list_item': return <ListItem a={a} d={d} />;
    case 'new_note': return <Note a={a} d={d} />;
    case 'add_vendor': return <Vendor a={a} d={d} />;
    default: return <p className="text-sm text-gray-400">That action isn't available yet.</p>;
  }
}

function UpdateStock({ a, d }: { a: Args; d: PanelData }) {
  const { editInventoryItem } = useApp();
  const pick = usePick(str(a.name), d.stock, nameOf);
  const [qty, setQty] = useState(num(a.quantity) != null ? String(a.quantity) : '');
  const [loc, setLoc] = useState(str(a.location));
  const [alert, setAlert] = useState(num(a.low_stock_alert) != null ? String(a.low_stock_alert) : '');
  const [expiry, setExpiry] = useState(str(a.expiry_date));
  const [notes, setNotes] = useState(str(a.notes));
  const { busy, save } = useSaver(d);
  const it = pick.value;
  const updates: Record<string, unknown> = {};
  if (qty !== '' && Number.isFinite(Number(qty))) updates.quantity = Number(qty);
  if (loc) updates.location = loc;
  if (alert !== '' && Number.isFinite(Number(alert))) updates.lowStockThreshold = Number(alert);
  if (/^\d{4}-\d{2}-\d{2}$/.test(expiry)) updates.expiryDate = expiry;
  if (notes) updates.notes = notes;
  const why = !it ? 'Choose the stock item.' : Object.keys(updates).length === 0 ? 'Nothing to change.' : null;
  return (
    <div className={card}>
      <Field label="Stock item">{pick.select}</Field>
      {it && <p className="text-[11px] text-gray-400">Now: {it.quantity} {it.unit} · {it.location || 'no location'}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Field label={`Quantity${it ? ` (${it.unit})` : ''}`}><input className={inputCls} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Low-stock alert"><input className={inputCls} inputMode="decimal" value={alert} onChange={(e) => setAlert(e.target.value)} /></Field>
      </div>
      <Field label="Location"><input className={inputCls} value={loc} onChange={(e) => setLoc(e.target.value)} /></Field>
      <Field label="Expiry"><input type="date" className={`${inputCls} [color-scheme:dark]`} value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
      <Field label="Notes"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <Save label="Update" why={why} busy={busy} onSave={() => void save(() => editInventoryItem(it!, updates), '')} />
    </div>
  );
}

function AddQuote({ a, d }: { a: Args; d: PanelData }) {
  const { purchases, addQuotation } = useApp();
  const pick = usePick(str(a.request), purchases, titleOf);
  const [vendor, setVendor] = useState(str(a.vendor));
  const [price, setPrice] = useState(num(a.price) != null ? String(a.price) : '');
  const [note, setNote] = useState(str(a.note));
  const { busy, save } = useSaver(d);
  const p = Number(price);
  const why = !pick.value ? 'Choose the request.' : !vendor.trim() ? 'Name the vendor.' : price === '' || !Number.isFinite(p) || p < 0 ? 'Enter the quoted price.' : null;
  return (
    <div className={card}>
      <Field label="Request">{pick.select}</Field>
      <Field label="Vendor"><input className={inputCls} value={vendor} onChange={(e) => setVendor(e.target.value)} /></Field>
      <Field label="Price (₹)"><input className={inputCls} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
      <Field label="Note"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <Save label="Add quotation" why={why} busy={busy} onSave={() => void save(() => addQuotation(pick.value!.id, { vendor: vendor.trim(), price: p, notes: note.trim() || undefined }), 'Quotation added.')} />
    </div>
  );
}

function SelectPo({ a, d }: { a: Args; d: PanelData }) {
  const { purchases, selectQuotation } = useApp();
  const pick = usePick(str(a.request), purchases.filter((p) => p.quotations.length > 0), titleOf);
  const quotes = pick.value?.quotations ?? [];
  const guess = rankByName(str(a.vendor), quotes, (q) => q.vendor, 1)[0];
  const [qid, setQid] = useState(guess && guess.score >= WEAK ? guess.item.id : '');
  const q = quotes.find((x) => x.id === qid) ?? null;
  const { busy, save } = useSaver(d);
  const why = !pick.value ? 'Choose the request.' : !q ? 'Choose the quote.' : null;
  return (
    <div className={card}>
      <Field label="Request">{pick.select}</Field>
      <Field label="Quote">
        <select className={inputCls} value={qid} onChange={(e) => setQid(e.target.value)}>
          <option value="">Choose a quote</option>
          {quotes.map((x) => <option key={x.id} value={x.id}>{x.vendor} · ₹{x.price.toLocaleString('en-IN')}</option>)}
        </select>
      </Field>
      <p className="text-[11px] text-gray-400">The request moves to Ordered.</p>
      <Save label="Select PO" why={why} busy={busy} onSave={() => void save(() => selectQuotation(pick.value!.id, q!), '')} />
    </div>
  );
}

const STATUSES: { id: PurchaseStatus; label: string }[] = [
  { id: 'waiting', label: 'Requested' }, { id: 'quotes', label: 'Quotes' }, { id: 'ordered', label: 'Ordered' },
  { id: 'transit', label: 'In transit' }, { id: 'delivered', label: 'Delivered' }, { id: 'closed', label: 'Closed' },
];

function RequestStatus({ a, d }: { a: Args; d: PanelData }) {
  const { purchases, updateStatus } = useApp();
  const pick = usePick(str(a.request), purchases, titleOf);
  const said = str(a.status).toLowerCase();
  const [status, setStatus] = useState<PurchaseStatus | ''>(STATUSES.find((x) => x.id === said || x.label.toLowerCase() === said)?.id ?? '');
  const { busy, save } = useSaver(d);
  const why = !pick.value ? 'Choose the request.' : !status ? 'Choose the status.' : status === 'delivered' ? 'Use "record delivery" so what arrived is logged.' : null;
  return (
    <div className={card}>
      <Field label="Request">{pick.select}</Field>
      {pick.value && <p className="text-[11px] text-gray-400">Now: {STATUSES.find((x) => x.id === pick.value!.status)?.label ?? pick.value.status}</p>}
      <Field label="New status">
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as PurchaseStatus)}>
          <option value="">Choose</option>
          {STATUSES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </Field>
      <Save label="Change status" why={why} busy={busy} onSave={() => void save(() => updateStatus(pick.value!.id, status as PurchaseStatus), '')} />
    </div>
  );
}

function Delivery({ a, d }: { a: Args; d: PanelData }) {
  const { purchases, recordDelivery } = useApp();
  const pick = usePick(str(a.request), purchases.filter((p) => !['delivered', 'closed'].includes(p.status)), titleOf);
  const [received, setReceived] = useState(str(a.received));
  const [note, setNote] = useState(str(a.note));
  const [all, setAll] = useState(a.all_received !== false);
  const { busy, save } = useSaver(d);
  const why = !pick.value ? 'Choose the request.' : !received.trim() ? 'Say what arrived.' : null;
  return (
    <div className={card}>
      <Field label="Request">{pick.select}</Field>
      <Field label="What arrived"><input className={inputCls} value={received} onChange={(e) => setReceived(e.target.value)} placeholder="e.g. 6 bottles" /></Field>
      <Field label="Note"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-1.5">
        {[{ v: false, l: 'Partial' }, { v: true, l: 'All received' }].map((o) => (
          <button key={o.l} type="button" onClick={() => setAll(o.v)}
            className={`min-h-10 rounded-md text-xs font-semibold border ${all === o.v ? 'bg-primary/10 border-primary text-primary' : 'bg-[#161616] border-[#2A2A2A] text-gray-400'}`}>{o.l}</button>
        ))}
      </div>
      <Save label="Record delivery" why={why} busy={busy} onSave={() => void save(() => recordDelivery(pick.value!.id, received.trim(), note.trim(), all), '')} />
    </div>
  );
}

function Comment({ a, d }: { a: Args; d: PanelData }) {
  const { purchases, addComment } = useApp();
  const pick = usePick(str(a.request), purchases, titleOf);
  const [text, setText] = useState(str(a.text));
  const { busy, save } = useSaver(d);
  const why = !pick.value ? 'Choose the request.' : !text.trim() ? 'Write the comment.' : null;
  return (
    <div className={card}>
      <Field label="Request">{pick.select}</Field>
      <Field label="Comment"><textarea className={`${inputCls} min-h-20`} value={text} onChange={(e) => setText(e.target.value)} /></Field>
      <Save label="Post comment" why={why} busy={busy} onSave={() => void save(() => addComment(pick.value!.id, text.trim()), 'Comment posted.')} />
    </div>
  );
}

const EQ_STATUSES: { id: EquipmentStatus; label: string }[] = [
  { id: 'working', label: 'Working' }, { id: 'needs_attention', label: 'Needs attention' }, { id: 'down', label: 'Down' }, { id: 'under_service', label: 'Under service' },
];
const eqStatus = (v: unknown) => EQ_STATUSES.find((x) => x.id === str(v) || x.label.toLowerCase() === str(v).toLowerCase())?.id ?? '';

function Issue({ a, d }: { a: Args; d: PanelData }) {
  const { equipment, reportIssue, editEquipment } = useApp();
  const pick = usePick(str(a.instrument), equipment, nameOf);
  const [title, setTitle] = useState(str(a.title));
  const [details, setDetails] = useState(str(a.details));
  const [status, setStatus] = useState<EquipmentStatus | ''>(eqStatus(a.set_status) || 'needs_attention');
  const { busy, save } = useSaver(d);
  const why = !pick.value ? 'Choose the instrument.' : !title.trim() ? "Say what's wrong." : null;
  return (
    <div className={card}>
      <Field label="Instrument">{pick.select}</Field>
      <Field label="What's wrong"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Details"><input className={inputCls} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
      <Field label="Also set status">
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as EquipmentStatus | '')}>
          <option value="">Leave as it is</option>
          {EQ_STATUSES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </Field>
      <Save label="Report issue" why={why} busy={busy} onSave={() => void save(async () => {
        const ok = await reportIssue(pick.value!.id, { title: title.trim(), description: details.trim() || undefined });
        if (ok && status && status !== pick.value!.status) await editEquipment(pick.value!.id, { status });
        return ok;
      }, 'Issue reported.')} />
    </div>
  );
}

function InstrumentStatus({ a, d }: { a: Args; d: PanelData }) {
  const { equipment, editEquipment } = useApp();
  const pick = usePick(str(a.instrument), equipment, nameOf);
  const [status, setStatus] = useState<EquipmentStatus | ''>(eqStatus(a.status));
  const { busy, save } = useSaver(d);
  const why = !pick.value ? 'Choose the instrument.' : !status ? 'Choose the status.' : null;
  return (
    <div className={card}>
      <Field label="Instrument">{pick.select}</Field>
      <Field label="Status">
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as EquipmentStatus)}>
          <option value="">Choose</option>
          {EQ_STATUSES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </Field>
      <Save label="Set status" why={why} busy={busy} onSave={() => void save(() => editEquipment(pick.value!.id, { status: status as EquipmentStatus }), 'Status updated.')} />
    </div>
  );
}

function LogUse({ a, d }: { a: Args; d: PanelData }) {
  const { equipment } = useApp();
  const { currentUser } = useAuth();
  const pick = usePick(str(a.instrument), equipment, nameOf);
  const [purpose, setPurpose] = useState(str(a.purpose));
  const [minutes, setMinutes] = useState(num(a.minutes) != null ? String(a.minutes) : '');
  const { busy, save } = useSaver(d);
  const why = !pick.value ? 'Choose the instrument.' : !currentUser ? 'Sign in first.' : null;
  const mins = Number(minutes);
  return (
    <div className={card}>
      <Field label="Instrument">{pick.select}</Field>
      <Field label="What for"><input className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Field>
      <Field label="Ran for (minutes)"><input className={inputCls} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></Field>
      <Save label="Log use" why={why} busy={busy} onSave={() => void save(async () => {
        const durationMinutes = minutes && Number.isFinite(mins) && mins > 0 ? Math.round(mins) : null;
        await api.logEquipmentUsage({
          equipmentId: pick.value!.id, visitorName: currentUser!.name, purpose: purpose.trim(),
          durationMinutes, startedAt: durationMinutes ? new Date(Date.now() - durationMinutes * 60_000).toISOString() : null,
        }, currentUser!.id);
      }, `Logged your use of ${pick.value?.name ?? 'the instrument'}.`)} />
    </div>
  );
}

const hhmm = (v: unknown) => {
  const m = str(v).match(/^(\d{1,2})(?::(\d{2}))?/);
  if (!m) return '';
  return `${m[1].padStart(2, '0')}:${m[2] ?? '00'}`;
};

function Book({ a, d }: { a: Args; d: PanelData }) {
  const { bookableItems, bookings, createBooking } = useApp();
  const pick = usePick(str(a.item), bookableItems, nameOf);
  const [date, setDate] = useState(/^\d{4}-\d{2}-\d{2}$/.test(str(a.date)) ? str(a.date) : '');
  const [start, setStart] = useState(hhmm(a.start));
  const [end, setEnd] = useState(hhmm(a.end));
  const [purpose, setPurpose] = useState(str(a.purpose));
  const { busy, save } = useSaver(d);
  const clash = pick.value && date && start && end
    ? bookings.find((b) => b.status === 'confirmed' && b.itemId === pick.value!.id && b.date === date && b.startTime.slice(0, 5) < end && b.endTime.slice(0, 5) > start)
    : undefined;
  const why = !pick.value ? 'Choose what to book.' : !date ? 'Choose the date.' : !start || !end ? 'Set start and end.' : end <= start ? 'End must be after start.'
    : start < '07:00' || end > '21:00' ? 'Bookings run 07:00 to 21:00.'
    : clash ? `Clashes with ${clash.bookedBy?.name ?? 'someone'} (${clash.startTime.slice(0, 5)}–${clash.endTime.slice(0, 5)}).` : null;
  return (
    <div className={card}>
      <Field label="Item">{pick.select}</Field>
      <Field label="Date"><input type="date" className={`${inputCls} [color-scheme:dark]`} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="From"><input type="time" className={`${inputCls} [color-scheme:dark]`} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="To"><input type="time" className={`${inputCls} [color-scheme:dark]`} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <Field label="Purpose"><input className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Field>
      <Save label="Book" why={why} busy={busy} onSave={() => void save(() => createBooking({ itemId: pick.value!.id, date, startTime: `${start}:00`, endTime: `${end}:00`, purpose: purpose.trim() || undefined }), '')} />
    </div>
  );
}

function CancelBooking({ a, d }: { a: Args; d: PanelData }) {
  const { bookableItems, bookings, cancelBooking } = useApp();
  const { currentUser } = useAuth();
  const mine = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return bookings
      .filter((b) => b.status === 'confirmed' && b.bookedBy?.id === currentUser?.id && b.date >= today)
      .map((b) => ({ ...b, label: `${bookableItems.find((i) => i.id === b.itemId)?.name ?? '?'} · ${b.date} ${b.startTime.slice(0, 5)}–${b.endTime.slice(0, 5)}` }));
  }, [bookings, bookableItems, currentUser]);
  const said = `${str(a.item)} ${str(a.date)} ${hhmm(a.start)}`.trim();
  const best = mine.find((b) => b.date === str(a.date) && (!hhmm(a.start) || b.startTime.startsWith(hhmm(a.start))) &&
    rankByName(str(a.item), [b], (x) => x.label, 1)[0]?.score >= WEAK);
  const [id, setId] = useState(best?.id ?? '');
  const { busy, save } = useSaver(d);
  const why = mine.length === 0 ? 'You have no upcoming bookings.' : !id ? 'Choose the booking.' : null;
  return (
    <div className={card}>
      <Field label="Your booking">
        <select className={inputCls} value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">{said ? `Choose (said: "${said}")` : 'Choose'}</option>
          {mine.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </Field>
      <Save label="Cancel booking" why={why} busy={busy} onSave={() => void save(() => cancelBooking(id), 'Booking cancelled.')} />
    </div>
  );
}

function ReportLost({ a, d }: { a: Args; d: PanelData }) {
  const { reportLostItem } = useApp();
  const [title, setTitle] = useState(str(a.title));
  const [where, setWhere] = useState(str(a.where));
  const [details, setDetails] = useState(str(a.details));
  const { busy, save } = useSaver(d);
  return (
    <div className={card}>
      <Field label="What was lost"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Last seen"><input className={inputCls} value={where} onChange={(e) => setWhere(e.target.value)} /></Field>
      <Field label="Details"><input className={inputCls} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
      <Save label="Report lost" why={title.trim() ? null : 'Say what was lost.'} busy={busy}
        onSave={() => void save(() => reportLostItem({ title: title.trim(), locationLastSeen: where.trim() || undefined, description: details.trim() || undefined }), '')} />
    </div>
  );
}

function LostFoundStatus({ a, d }: { a: Args; d: PanelData }) {
  const { lostFoundItems, updateLostFoundStatus } = useApp();
  const pick = usePick(str(a.item), lostFoundItems.filter((l) => l.status !== 'resolved'), titleOf);
  const [status, setStatus] = useState<'found' | 'resolved'>(str(a.status) === 'resolved' ? 'resolved' : 'found');
  const { busy, save } = useSaver(d);
  return (
    <div className={card}>
      <Field label="Report">{pick.select}</Field>
      <div className="grid grid-cols-2 gap-1.5">
        {(['found', 'resolved'] as const).map((x) => (
          <button key={x} type="button" onClick={() => setStatus(x)}
            className={`min-h-10 rounded-md text-xs font-semibold capitalize border ${status === x ? 'bg-primary/10 border-primary text-primary' : 'bg-[#161616] border-[#2A2A2A] text-gray-400'}`}>{x}</button>
        ))}
      </div>
      <Save label={status === 'found' ? 'Mark found' : 'Mark resolved'} why={pick.value ? null : 'Choose the report.'} busy={busy}
        onSave={() => void save(() => updateLostFoundStatus(pick.value!.id, status), 'Updated.')} />
    </div>
  );
}

function ListItem({ a, d }: { a: Args; d: PanelData }) {
  const { labLists, addListItem } = useApp();
  const pick = usePick(str(a.list), labLists, titleOf);
  const [item, setItem] = useState(str(a.item));
  const { busy, save } = useSaver(d);
  const why = !pick.value ? 'Choose the list.' : !item.trim() ? 'Write the item.' : null;
  return (
    <div className={card}>
      <Field label="List">{pick.select}</Field>
      <Field label="Item"><input className={inputCls} value={item} onChange={(e) => setItem(e.target.value)} /></Field>
      <Save label="Add to list" why={why} busy={busy} onSave={() => void save(() => addListItem(pick.value!.id, { name: item.trim() }), 'Added to the list.')} />
    </div>
  );
}

function Note({ a, d }: { a: Args; d: PanelData }) {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState(str(a.title));
  const [text, setText] = useState(str(a.text));
  const { busy, save } = useSaver(d);
  const why = !currentUser ? 'Sign in first.' : !title.trim() ? 'Give it a title.' : null;
  return (
    <div className={card}>
      <Field label="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Text"><textarea className={`${inputCls} min-h-24`} value={text} onChange={(e) => setText(e.target.value)} /></Field>
      <p className="text-[11px] text-gray-400">Saved to your private Lab Notebook.</p>
      <Save label="Create page" why={why} busy={busy} onSave={() => void save(async () => {
        const page = await api.createNotebookPage(title.trim(), '📝', currentUser!.id);
        if (text.trim()) await api.updateNotebookPage(page.id, { body: text.trim() });
      }, 'Notebook page created.')} />
    </div>
  );
}

function Vendor({ a, d }: { a: Args; d: PanelData }) {
  const { addVendor } = useApp();
  const [name, setName] = useState(str(a.name));
  const [contact, setContact] = useState(str(a.contact));
  const [type, setType] = useState<'direct' | 'third_party'>(str(a.type) === 'third_party' ? 'third_party' : 'direct');
  const [comment, setComment] = useState(str(a.comment));
  const { busy, save } = useSaver(d);
  return (
    <div className={card}>
      <Field label="Vendor"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Contact"><input className={inputCls} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email" /></Field>
      <div className="grid grid-cols-2 gap-1.5">
        {([['direct', 'Direct'], ['third_party', '3rd party']] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setType(v)}
            className={`min-h-10 rounded-md text-xs font-semibold border ${type === v ? 'bg-primary/10 border-primary text-primary' : 'bg-[#161616] border-[#2A2A2A] text-gray-400'}`}>{l}</button>
        ))}
      </div>
      <Field label="Comment"><input className={inputCls} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
      <Save label="Add vendor" why={name.trim() ? null : 'Name the vendor.'} busy={busy}
        onSave={() => void save(() => addVendor({ name: name.trim(), type, contact: contact.trim(), comment: comment.trim() }), '')} />
    </div>
  );
}
