// Feed for the lab's wall-screen dashboard (wall.html). Deploy with JWT
// verification OFF. Secret: WALL_KEY, a long random string only the screen
// knows; requests without it get nothing. Read-only, and deliberately carries
// no prices, quotes or invoices — only what is fine to show on a wall.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://siddhantrajnaik.github.io', 'http://localhost:3000', 'http://localhost:3010'];
const WALL_KEY = (Deno.env.get('WALL_KEY') ?? '').trim();

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-wall-key',
    Vary: 'Origin',
  };
}
const json = (body: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** Compares without bailing at the first differing character. */
function sameKey(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const istDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d); // YYYY-MM-DD
const first = (n: string | null | undefined) => (n ?? '').trim().split(/\s+/)[0] || 'Someone';

Deno.serve(async (req) => {
  const h = cors(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'GET') return json({ error: 'Not found.' }, 404, h);
  if (!WALL_KEY) return json({ error: 'Not set up.' }, 503, h);
  if (!sameKey(req.headers.get('x-wall-key') ?? '', WALL_KEY)) return json({ error: 'Wrong key.' }, 401, h);

  const now = new Date();
  const today = istDate(now);
  const tomorrow = istDate(new Date(now.getTime() + 86_400_000));
  const soon = istDate(new Date(now.getTime() + 30 * 86_400_000));

  const [items, bookings, orders, stock, equipment, maint, people] = await Promise.all([
    db.from('bookable_items').select('id, name, color').order('name'),
    db.from('bookings').select('item_id, date, start_time, end_time, purpose, booked_by').eq('status', 'confirmed').in('date', [today, tomorrow]).order('start_time'),
    db.from('purchases').select('title, status, requested_by, created_at').in('status', ['waiting', 'quotes', 'ordered', 'transit', 'partial']).order('created_at', { ascending: false }).limit(60),
    db.from('inventory_items').select('name, quantity, unit, low_stock_threshold, expiry_date').limit(1000),
    db.from('equipment').select('id, name, status').limit(100),
    db.from('maintenance_logs').select('equipment_id, next_due_date').not('next_due_date', 'is', null).limit(500),
    db.from('profiles').select('id, name').limit(100),
  ]);
  if (items.error || bookings.error || orders.error) return json({ error: 'Could not load.' }, 500, h);

  const who = new Map((people.data ?? []).map((p) => [p.id as string, first(p.name)]));
  const itemName = new Map((items.data ?? []).map((i) => [i.id as string, i.name as string]));

  const open = (orders.data ?? []);
  const incoming = open
    .filter((o) => ['ordered', 'transit', 'partial'].includes(o.status))
    .slice(0, 8)
    .map((o) => ({ title: o.title as string, status: o.status as string }));

  const lastDue = new Map<string, string>();
  for (const m of maint.data ?? []) {
    const cur = lastDue.get(m.equipment_id as string);
    if (!cur || (m.next_due_date as string) > cur) lastDue.set(m.equipment_id as string, m.next_due_date as string);
  }

  return json(
    {
      now: now.toISOString(),
      today,
      tomorrow,
      items: (items.data ?? []).map((i) => ({ name: i.name, color: i.color, hood: /hood/i.test(i.name) })),
      bookings: (bookings.data ?? []).map((b) => ({
        item: itemName.get(b.item_id as string) ?? '',
        date: b.date,
        start: String(b.start_time).slice(0, 5),
        end: String(b.end_time).slice(0, 5),
        by: who.get(b.booked_by as string) ?? 'Someone',
        purpose: b.purpose,
      })),
      orders: {
        waiting: open.filter((o) => o.status === 'waiting').length,
        quotes: open.filter((o) => o.status === 'quotes').length,
        incoming,
      },
      alerts: {
        low: (stock.data ?? [])
          .filter((s) => s.low_stock_threshold != null && Number(s.quantity) <= Number(s.low_stock_threshold))
          .slice(0, 8)
          .map((s) => ({ name: s.name, left: `${Number(s.quantity)} ${s.unit}` })),
        expiring: (stock.data ?? [])
          .filter((s) => s.expiry_date && (s.expiry_date as string) <= soon)
          .sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date)))
          .slice(0, 6)
          .map((s) => ({ name: s.name, date: s.expiry_date, expired: (s.expiry_date as string) < today })),
        instruments: (equipment.data ?? [])
          .filter((e) => e.status !== 'working')
          .map((e) => ({ name: e.name, status: e.status })),
        service: (equipment.data ?? [])
          .filter((e) => (lastDue.get(e.id as string) ?? '9999') < today)
          .map((e) => ({ name: e.name })),
      },
    },
    200,
    h
  );
});
