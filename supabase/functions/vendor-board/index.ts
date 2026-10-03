// Public feed for the vendor page. Deploy with JWT verification OFF so the page
// needs no key. Supabase injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://siddhantrajnaik.github.io', 'http://localhost:3000', 'http://localhost:3010'];
const DAILY_CAP = 100;

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function clip(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/\s+/g, ' ');
  return t ? t.slice(0, max) : null;
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

  if (req.method === 'GET') {
    const [items, settings] = await Promise.all([
      db
        .from('purchases')
        .select('title, catalog_number, quantity, preferred_company')
        .eq('vendor_visible', true)
        .in('status', ['waiting', 'quotes'])
        .order('created_at', { ascending: false })
        .limit(200),
      db.from('vendor_page_settings').select('quote_email').eq('id', 1).maybeSingle(),
    ]);
    if (items.error) return json({ error: 'Could not load the list.' }, 500, h);
    return json(
      {
        items: (items.data ?? []).map((r) => ({
          title: r.title,
          catalogNumber: r.catalog_number,
          quantity: r.quantity,
          brand: r.preferred_company,
        })),
        quoteEmail: settings.data?.quote_email ?? null,
      },
      200,
      { ...h, 'Cache-Control': 'public, max-age=60' }
    );
  }

  if (req.method === 'POST') {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Send the form as JSON.' }, 400, h);
    }
    // Honeypot: people never see this field, bots fill it.
    if (clip(body.website, 200)) return json({ ok: true }, 200, h);

    const kind = body.kind === 'offer' ? 'offer' : body.kind === 'register' ? 'register' : null;
    const row = {
      kind,
      name: clip(body.name, 120),
      company: clip(body.company, 120),
      phone: clip(body.phone, 40),
      email: clip(body.email, 160),
      message: typeof body.message === 'string' ? body.message.trim().slice(0, 2000) || null : null,
    };
    if (!kind) return json({ error: 'Unknown form.' }, 400, h);
    if (!row.name) return json({ error: 'Please enter your name.' }, 400, h);
    if (!row.phone && !row.email) return json({ error: 'Please give a phone number or an email.' }, 400, h);
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      return json({ error: 'That email address does not look right.' }, 400, h);
    }
    if (kind === 'offer' && !row.message) return json({ error: 'Please describe the offer.' }, 400, h);

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await db
      .from('vendor_submissions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since);
    if ((count ?? 0) >= DAILY_CAP) {
      return json({ error: 'We have had a lot of messages today. Please email us instead.' }, 429, h);
    }

    const { error } = await db.from('vendor_submissions').insert(row);
    if (error) return json({ error: 'Could not send. Please try again.' }, 500, h);
    return json({ ok: true }, 200, h);
  }

  return json({ error: 'Not found.' }, 404, h);
});
