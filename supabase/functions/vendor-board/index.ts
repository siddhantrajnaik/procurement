// Public feed for the vendor page. Deploy with JWT verification OFF so the page
// needs no key. Supabase injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://siddhantrajnaik.github.io', 'http://localhost:3000', 'http://localhost:3010'];
const DAILY_CAP = 100;
const PHOTO_BUCKET = 'vendor-photos';
/** A photo is kept at most this long, even if the request is still listed. */
const PHOTO_MAX_DAYS = 30;
const SIGNED_URL_SECONDS = 3600;
const LISTED = ['waiting', 'quotes'];

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

/**
 * Removes photos whose request is no longer listed (ordered or later, switched
 * off) or that are older than PHOTO_MAX_DAYS. With sweepOrphans (the nightly
 * run) it also removes any file no request points at that is older than that.
 * Safe to run any number of times;
 * never throws, so the page still loads if storage has a bad moment.
 */
async function cleanupPhotos(sweepOrphans: boolean): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - PHOTO_MAX_DAYS * 86_400_000).toISOString();
    const { data: rows } = await db
      .from('purchases')
      .select('id, status, vendor_visible, vendor_photo_path, vendor_photo_at')
      .not('vendor_photo_path', 'is', null)
      .limit(500);
    const stale = (rows ?? []).filter(
      (r) => !r.vendor_visible || !LISTED.includes(r.status) || !r.vendor_photo_at || r.vendor_photo_at < cutoff
    );
    if (stale.length) {
      await db.storage.from(PHOTO_BUCKET).remove(stale.map((r) => r.vendor_photo_path as string));
      await db.from('purchases').update({ vendor_photo_path: null, vendor_photo_at: null }).in('id', stale.map((r) => r.id));
    }

    if (!sweepOrphans) return;
    // Orphans: files left by an upload whose row update failed, or by a deleted request.
    const { data: kept } = await db.from('purchases').select('vendor_photo_path').not('vendor_photo_path', 'is', null);
    const inUse = new Set((kept ?? []).map((r) => r.vendor_photo_path as string));
    const { data: folders } = await db.storage.from(PHOTO_BUCKET).list('', { limit: 200 });
    const orphans: string[] = [];
    for (const f of folders ?? []) {
      const { data: files } = await db.storage.from(PHOTO_BUCKET).list(f.name, { limit: 100 });
      for (const file of files ?? []) {
        const path = `${f.name}/${file.name}`;
        const made = file.created_at ?? '';
        if (!inUse.has(path) && made && made < cutoff) orphans.push(path);
      }
    }
    if (orphans.length) await db.storage.from(PHOTO_BUCKET).remove(orphans);
  } catch (e) {
    console.error('vendor photo cleanup', e);
  }
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

  if (req.method === 'GET') {
    // The nightly schedule calls this; opening the page does the same, so a
    // photo never outlives its request even if the schedule is not running.
    const nightly = !!new URL(req.url).searchParams.get('cleanup');
    await cleanupPhotos(nightly);
    if (nightly) return json({ ok: true }, 200, h);

    const [items, settings] = await Promise.all([
      db
        .from('purchases')
        .select('title, catalog_number, quantity, preferred_company, vendor_photo_path')
        .eq('vendor_visible', true)
        .in('status', LISTED)
        .order('created_at', { ascending: false })
        .limit(200),
      db.from('vendor_page_settings').select('quote_email, whatsapp_number').eq('id', 1).maybeSingle(),
    ]);
    if (items.error) return json({ error: 'Could not load the list.' }, 500, h);

    const rows = items.data ?? [];
    const paths = rows.map((r) => r.vendor_photo_path).filter((p): p is string => !!p);
    const urls = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await db.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    }

    return json(
      {
        items: rows.map((r) => ({
          title: r.title,
          catalogNumber: r.catalog_number,
          quantity: r.quantity,
          brand: r.preferred_company,
          photoUrl: r.vendor_photo_path ? urls.get(r.vendor_photo_path) ?? null : null,
        })),
        quoteEmail: settings.data?.quote_email ?? null,
        whatsappNumber: settings.data?.whatsapp_number ?? null,
      },
      200,
      // Short, because the photo links expire after an hour.
      { ...h, 'Cache-Control': 'public, max-age=30' }
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
