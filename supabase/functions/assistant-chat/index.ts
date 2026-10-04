// MB Lab assistant: relays a conversation to Gemini with the app's tools.
// Deploy with JWT verification OFF. Secret: GEMINI_API_KEY. Optional
// GEMINI_MODELS = comma-separated list tried in order (stronger first).
//
// This function never reads or writes lab data. Gemini asks for tools; the app
// runs read tools on data it already has (money removed) and turns write tools
// into cards the person must confirm. This only holds the key, the
// instructions and the tool list, and enforces a daily cap.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://siddhantrajnaik.github.io', 'http://localhost:3000', 'http://localhost:3010'];
const DAILY_CAP = 1500;
const MODELS = (Deno.env.get('GEMINI_MODELS') || 'gemini-3.8-flash,gemini-3.5-flash,gemini-3.5-flash-lite')
  .split(',').map((m) => m.trim()).filter(Boolean);
const KEY = (Deno.env.get('GEMINI_API_KEY') ?? '').trim();

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const SYSTEM = `You are the assistant inside MB Lab, the app of the Structural Virology Lab at IIT Delhi (PI: Prof. Manidipa Banerjee).
You talk to lab members by text or voice, in English, Hindi or Hinglish. Speech-to-text makes mistakes: "see see es zero five" is CC-S05.

How to work:
- Answer questions by calling read tools first. Never guess lab facts; if a tool returns nothing, say so.
- To change anything, call the matching action tool. Action tools do not save: the app shows a card and the person taps Save. So after calling them, say briefly what you prepared, e.g. "Here's the request — check it and tap Save."
- One message can need several tools; call them all.
- Use exact names returned by tools (box codes, item names, instrument names, request titles). Use search tools to resolve vague names before acting.
- If something essential is missing (which box, which instrument, what date), ask one short question instead of guessing.
- For purchase requests with no catalogue number, prepare the request anyway and ask: "Do you have the catalogue number?" If the next message gives it, prepare the request again with it.
- You cannot see prices, quotes amounts or spending. If asked, say those are on the Purchases screens.
- Dates: today is given in the context. "tomorrow", "next Monday" etc. are relative to it. Times are 24-hour HH:MM; bookings run between 07:00 and 21:00.
- Replies are read aloud, so keep them short and plain: one to three sentences, no markdown, no lists unless asked, no IDs.
- You only help with this lab and this app. For anything else, say so in one sentence.

Lab conventions: box codes like B01-C01 (bay B01 in room 309, C cabinet, D drawer, S shelf, number = position), CC-S05 (chemical cabinet shelf 5). Request statuses: waiting (requested), quotes, ordered, transit, partial, delivered, closed.`;

const S = (description: string) => ({ type: 'STRING', description });
const N = (description: string) => ({ type: 'NUMBER', description });
const B = (description: string) => ({ type: 'BOOLEAN', description });
const ITEMS = {
  type: 'ARRAY',
  description: 'Items with optional count (containers) or amount+unit.',
  items: { type: 'OBJECT', properties: { name: S('Item name'), count: N('Number of containers'), amount: N('Amount, e.g. 50'), unit: S('Unit, e.g. mL') }, required: ['name'] },
};
const NAMES = { type: 'ARRAY', items: { type: 'STRING' }, description: 'Item names' };
const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({
  name, description, parameters: { type: 'OBJECT', properties, ...(required.length ? { required } : {}) },
});

const TOOLS = [
  // ---- read
  fn('search_inventory', 'Find samples (in boxes) and stock items by name. Returns where they are, copies, who has one out, stock quantity.', { query: S('What to look for') }, ['query']),
  fn('box_contents', 'List what is inside a sample box.', { box: S('Box code or name') }, ['box']),
  fn('list_boxes', 'List all sample boxes with location and storage condition.'),
  fn('low_and_expiring', 'Stock items at or below their low-stock alert, and items expiring within 30 days.'),
  fn('list_requests', 'Purchase requests with status, who asked, priority, catalogue number, quote vendors (no prices), chosen vendor and deliveries.', { status: S('Optional: waiting, quotes, ordered, transit, partial, delivered, closed, or open (not yet delivered)'), query: S('Optional text to match') }),
  fn('instruments', 'Instruments with status, location, open issues, last use and next service date.', { query: S('Optional instrument name') }),
  fn('bookings', 'Bookings for a date (default today), optionally for one bookable item. Also lists bookable items.', { date: S('YYYY-MM-DD'), item: S('Optional bookable item name') }),
  fn('vendors', 'Vendor directory entries: name, type, contact, comment.', { query: S('Optional text to match') }),
  fn('lost_and_found', 'Lost and found reports.', { status: S('Optional: open, found, resolved') }),
  fn('lists', 'Shared lab lists and their items.', { title: S('Optional list title') }),
  fn('recent_activity', 'Recent purchasing activity and stock changes, newest first.'),
  fn('people', 'Lab members and their roles.'),
  // ---- actions (each becomes a card the person confirms)
  fn('add_samples', 'Add new samples to a box (or loose if no box).', { box: S('Box code'), items: ITEMS }, ['items']),
  fn('move_samples', 'Move samples to another box.', { items: NAMES, to: S('Destination box'), from: S('Optional source box') }, ['items', 'to']),
  fn('swap_samples', 'Swap the places of two samples.', { a_item: S('First sample'), a_box: S('Its box, if said'), b_item: S('Second sample'), b_box: S('Its box, if said') }, ['a_item', 'b_item']),
  fn('take_out', 'Someone took a sample out, or used an amount of a stock item.', { items: ITEMS }, ['items']),
  fn('put_back', 'Put taken-out samples back.', { items: NAMES }, ['items']),
  fn('restock', 'More of a stock item arrived or was added.', { items: ITEMS }, ['items']),
  fn('new_box', 'Create a sample box.', { name: S('Box code'), condition: S('-80°C, -20°C, 4°C, RT, LN₂, Cabinet, Drawer, Shelf…'), location: S('Where it is') }, ['name']),
  fn('new_stock_item', 'Add a new stock item counted by quantity (not a sample).', { name: S('Item'), quantity: N('How much'), unit: S('mL, L, g, mg, pcs, packs, boxes, bottles, vials…'), location: S('Where'), category: S('Reagents, Consumables, Antibodies, Resins & Media, Plasticware, Equipment, Kits, Chemicals, Buffers or General') }, ['name']),
  fn('update_stock_item', 'Change an existing stock item: set quantity, location, low-stock alert, expiry or notes.', { name: S('Stock item'), quantity: N('New total quantity'), location: S('New location'), low_stock_alert: N('Alert threshold'), expiry_date: S('YYYY-MM-DD'), notes: S('Notes') }, ['name']),
  fn('create_request', 'Raise a purchase request.', { title: S('Item'), quantity: S('As said, e.g. "2 boxes"'), priority: S('normal, urgent or critical'), catalog_number: S('Catalogue number'), brand: S('Preferred brand or vendor'), note: S('Why / notes'), show_to_vendors: B('Put it on the public vendor page') }, ['title']),
  fn('add_quote', 'Record a vendor quotation on a request. Only if the person said the price.', { request: S('Request title'), vendor: S('Vendor'), price: N('Price in rupees'), note: S('Optional note') }, ['request', 'vendor']),
  fn('select_po', 'Choose the vendor whose quote becomes the purchase order.', { request: S('Request title'), vendor: S('Vendor of the chosen quote') }, ['request', 'vendor']),
  fn('set_request_status', 'Move a request to another status.', { request: S('Request title'), status: S('waiting, quotes, ordered, transit, delivered or closed') }, ['request', 'status']),
  fn('record_delivery', 'Record that goods arrived for a request.', { request: S('Request title'), received: S('What arrived, e.g. "6 bottles"'), all_received: B('True if the order is complete'), note: S('Optional') }, ['request', 'received']),
  fn('comment_on_request', 'Post a comment in a request thread.', { request: S('Request title'), text: S('Comment') }, ['request', 'text']),
  fn('report_issue', 'Report a problem with an instrument.', { instrument: S('Instrument'), title: S('What is wrong'), details: S('Optional details'), set_status: S('Optional: needs_attention or down') }, ['instrument', 'title']),
  fn('set_instrument_status', 'Set an instrument status.', { instrument: S('Instrument'), status: S('working, needs_attention, down or under_service') }, ['instrument', 'status']),
  fn('log_instrument_use', 'Log that the person used an instrument.', { instrument: S('Instrument'), purpose: S('What for'), minutes: N('How long, in minutes') }, ['instrument']),
  fn('book_slot', 'Book a bookable item.', { item: S('Bookable item'), date: S('YYYY-MM-DD'), start: S('HH:MM'), end: S('HH:MM'), purpose: S('What for') }, ['item', 'date', 'start', 'end']),
  fn('cancel_booking', 'Cancel one of the person\'s bookings.', { item: S('Bookable item'), date: S('YYYY-MM-DD'), start: S('HH:MM if known') }, ['item', 'date']),
  fn('report_lost', 'Report a lost item.', { title: S('What was lost'), where: S('Where last seen'), details: S('Distinguishing marks') }, ['title']),
  fn('update_lost_found', 'Mark a lost-and-found report found or resolved.', { item: S('Report title'), status: S('found or resolved') }, ['item', 'status']),
  fn('add_list_item', 'Add an item to a shared list.', { list: S('List title'), item: S('Item text') }, ['list', 'item']),
  fn('new_note', 'Create a private notebook page for the person.', { title: S('Page title'), text: S('Page content') }, ['title']),
  fn('add_vendor', 'Add a vendor to the directory.', { name: S('Vendor'), contact: S('Phone or email'), type: S('direct or third_party'), comment: S('Note') }, ['name']),
];

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  };
}
const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

type Raw = Record<string, unknown>;

/** Keeps only the conversation shape Gemini needs, within size limits. */
function cleanContents(v: unknown): Raw[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > 60) return null;
  const size = JSON.stringify(v).length;
  if (size > 120_000) return null;
  const out: Raw[] = [];
  for (const c of v as Raw[]) {
    if (c?.role !== 'user' && c?.role !== 'model') return null;
    if (!Array.isArray(c.parts)) return null;
    const parts = (c.parts as Raw[]).filter((p) => p && (typeof p.text === 'string' || p.functionCall || p.functionResponse));
    if (parts.length) out.push({ role: c.role, parts });
  }
  return out.length ? out : null;
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'Not found.' }, 404, h);
  if (!KEY) return json({ error: 'Assistant is not configured.' }, 503, h);

  let body: Raw;
  try { body = await req.json(); } catch { return json({ error: 'Bad request.' }, 400, h); }
  const contents = cleanContents(body.contents);
  if (!contents) return json({ error: 'Bad conversation.' }, 400, h);
  const ctx = (body.context ?? {}) as Raw;
  const context = `Context: today is ${String(ctx.today ?? '').slice(0, 40)}; time now ${String(ctx.now ?? '').slice(0, 10)}; the person is ${String(ctx.user ?? 'a lab member').slice(0, 60)}.`;

  const { data: used, error: capErr } = await db.rpc('bump_assistant_usage');
  if (capErr) return json({ error: 'Assistant is not set up yet.' }, 503, h);
  if ((used as number) > DAILY_CAP) return json({ error: 'Daily limit reached.' }, 429, h);

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: `${SYSTEM}\n\n${context}` }] },
    contents,
    tools: [{ functionDeclarations: TOOLS }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    generationConfig: { temperature: 0.2 },
  });

  let lastStatus = 502;
  for (const model of MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
        body: payload,
      });
      if (res.ok) {
        const out = await res.json();
        const parts = (out?.candidates?.[0]?.content?.parts ?? []) as Raw[];
        return json({ parts, model }, 200, h);
      }
      lastStatus = res.status;
      console.error('gemini', model, res.status, (await res.text()).slice(0, 400));
      // Out of quota or model gone: try the next, lighter model.
      if (![404, 429, 500, 503].includes(res.status)) break;
    } catch (e) {
      console.error('gemini', model, e);
    } finally {
      clearTimeout(timer);
    }
  }
  return json({ error: lastStatus === 429 ? 'Daily limit reached.' : 'Assistant is unavailable.' }, lastStatus === 429 ? 429 : 502, h);
});
