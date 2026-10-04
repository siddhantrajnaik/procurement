// Turns a typed or spoken sentence into assistant actions using Gemini.
// Deploy with JWT verification OFF. Needs the secret GEMINI_API_KEY; optional
// GEMINI_MODEL overrides the model. Never writes lab data: it only returns
// actions, and the app shows each one for confirmation before saving.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://siddhantrajnaik.github.io', 'http://localhost:3000', 'http://localhost:3010'];
const DAILY_CAP = 400;
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite';
const KEY = (Deno.env.get('GEMINI_API_KEY') ?? '').trim();

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const SYSTEM = `You turn messages from members of a structural virology lab (IIT Delhi) into actions for their inventory app.
Messages may be English, Hindi or Hinglish, typed or spoken (so expect speech-to-text mistakes).

You receive JSON: {"message": string, "boxes": [box names], "names": [names of samples and stock items that exist]}.

Return {"actions": [...], "reply": string|null}. One message can hold several actions, in the order said.
Action kinds:
- find: where something is, who has it, whether we have it. Set query.
- box: what is inside a box. Set box.
- add: put new samples into a box. Set box (or null) and items.
- move: move samples to another box. Set items (names only), to, and from if said.
- swap: exchange two samples' places. Set a_item, b_item and a_box/b_box if said.
- take: someone took a sample out, or used up an amount of a stock item ("used 50 mL methanol", "took FCV"). Set items.
- return: put a sample back. Set items (names only).
- restock: more of a stock item arrived or was bought. Set items.
- low: what is running low, finished, or expiring soon.
- request: something must be ordered/bought for the lab ("we need 2 boxes of 15 mL falcons", "order trypan blue, urgent"). Set title, quantity (as said, e.g. "2 boxes"), priority (normal|urgent|critical), note.

Rules:
- When a word clearly means one entry in "names" or "boxes" (spelling, abbreviation, spoken form like "see see es zero five" = CC-S05), use that exact entry. If unsure, keep the person's own words. Never invent names that were not said.
- items: name, count = number of containers if said, amount + unit if a quantity like "50 mL" was said, otherwise null.
- If the message is a question or chat unrelated to lab inventory or ordering, return no actions and a one-sentence reply saying what you can help with.
- If something needed is missing (e.g. move with no destination), return no actions and a short reply asking for it.
- Fill every field the person gave. Quantities, urgency words (urgent, urgently, asap, jaldi = urgent; critical, emergency = critical) and boxes said next to an item must not be dropped.
- Do not explain. Output only the JSON.

Examples (fields not shown are null):
"we need 2 boxes of 15 ml falcons urgently for tomorrow's prep" -> {"actions":[{"kind":"request","title":"15 mL Falcon tubes","quantity":"2 boxes","priority":"urgent","note":"for tomorrow's prep"}]}
"order 500 g sucrose" -> {"actions":[{"kind":"request","title":"Sucrose","quantity":"500 g","priority":"normal"}]}
"swap tricine in CC-S04 with sucrose" -> {"actions":[{"kind":"swap","a_item":"Tricine","a_box":"CC-S04","b_item":"Sucrose"}]}
"took 2 FCV and put back the PBS" -> {"actions":[{"kind":"take","items":[{"name":"FCV","count":2}]},{"kind":"return","items":[{"name":"PBS"}]}]}`;

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

const str = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const strList = (v: unknown, max: number) =>
  Array.isArray(v) ? v.map((x) => str(x)).filter((x): x is string => !!x).slice(0, max) : [];

type Raw = Record<string, unknown>;

function items(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: unknown) => (typeof x === 'string' ? { name: x } : (x as Raw)))
    .map((i: Raw) => ({
      name: str(i?.name) ?? '',
      count: Number.isInteger(i?.count) && (i.count as number) > 0 ? (i.count as number) : null,
      amount: typeof i?.amount === 'number' && i.amount > 0 ? i.amount : null,
      unit: str(i?.unit, 20),
    }))
    .filter((i) => i.name);
}

/** Gemini's flat action → the app's Intent shape. Anything malformed is dropped. */
function toIntent(a: Raw): Raw | null {
  switch (a?.kind) {
    case 'find': return str(a.query) ? { kind: 'find', query: str(a.query) } : null;
    case 'box': return str(a.box) ? { kind: 'box', box: str(a.box) } : null;
    case 'add': { const it = items(a.items); return it.length ? { kind: 'add', box: str(a.box), items: it } : null; }
    case 'move': {
      const it = items(a.items).map((i) => i.name);
      return it.length && str(a.to) ? { kind: 'move', items: it, from: str(a.from), to: str(a.to) } : null;
    }
    case 'swap':
      return str(a.a_item) && str(a.b_item)
        ? { kind: 'swap', a: { item: str(a.a_item), box: str(a.a_box) }, b: { item: str(a.b_item), box: str(a.b_box) } }
        : null;
    case 'take': case 'restock': { const it = items(a.items); return it.length ? { kind: a.kind, items: it } : null; }
    case 'return': { const it = items(a.items).map((i) => i.name); return it.length ? { kind: 'return', items: it } : null; }
    case 'low': return { kind: 'low' };
    case 'request': {
      const title = str(a.title, 120);
      if (!title) return null;
      const p = a.priority === 'urgent' || a.priority === 'critical' ? a.priority : 'normal';
      return { kind: 'request', title, quantity: str(a.quantity, 60) ?? '', priority: p, note: str(a.note, 300) ?? '' };
    }
    default: return null;
  }
}

const QTY = /\b\d+(?:\.\d+)?\s*(?:x\s*)?(?:boxes|box|packs?|bottles?|vials?|kits?|pieces?|pcs|tubes?|plates?|rolls?|units?|ml|l|ltr|litres?|liters?|g|gm|grams?|mg|kg|µl|ul)\b/i;

/** Words in the sentence the model sometimes leaves out: amount, urgency, "X in BOX". */
function backfill(i: Raw, message: string, boxes: string[]): Raw {
  if (i.kind === 'request') {
    const q = (i.quantity as string) || message.match(QTY)?.[0]?.trim() || '';
    let p = i.priority as string;
    if (p === 'normal') {
      if (/\b(critical|emergency)\b/i.test(message)) p = 'critical';
      else if (/\b(urgent(ly)?|asap|jaldi|immediately|right away)\b/i.test(message)) p = 'urgent';
    }
    return { ...i, quantity: q, priority: p };
  }
  if (i.kind === 'swap') {
    const a = i.a as Raw, b = i.b as Raw;
    if (a.box && b.box) return i;
    // Boxes named before "with"/"and" belong to the first item, after it to the second.
    const [left, right = ''] = message.split(/\b(?:with|and)\b/i);
    const named = (part: string) => boxes.find((bx) => part.toLowerCase().includes(bx.toLowerCase())) ?? null;
    return { ...i, a: { ...a, box: a.box ?? named(left) }, b: { ...b, box: b.box ?? named(right) } };
  }
  return i;
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'Not found.' }, 404, h);
  if (!KEY) return json({ error: 'Assistant is not configured.' }, 503, h);

  let body: Raw;
  try { body = await req.json(); } catch { return json({ error: 'Bad request.' }, 400, h); }
  const message = str(body.text, 2000);
  if (!message) return json({ error: 'Say something first.' }, 400, h);

  const { data: used, error: capErr } = await db.rpc('bump_assistant_usage');
  if (capErr) return json({ error: 'Assistant is not set up yet.' }, 503, h);
  if ((used as number) > DAILY_CAP) return json({ error: 'Daily limit reached.' }, 429, h);

  const input = { message, boxes: strList(body.boxes, 600), names: strList(body.names, 2000) };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
        // No responseSchema: with it the lite model leaves optional fields
        // (quantity, priority, boxes) null. The prompt's examples set the shape,
        // toIntent() validates it, and backfill() catches what is still missed.
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      console.error('gemini', res.status, (await res.text()).slice(0, 500));
      return json({ error: res.status === 429 ? 'Daily limit reached.' : 'Assistant is unavailable.' }, res.status === 429 ? 429 : 502, h);
    }
    const out = await res.json();
    const text = out?.candidates?.[0]?.content?.parts?.map((p: Raw) => p.text ?? '').join('') ?? '';
    const parsed = JSON.parse(text.replace(/^\s*```(?:json)?|```\s*$/g, '')) as Raw;
    const intents = (Array.isArray(parsed.actions) ? parsed.actions : [])
      .map(toIntent)
      .filter((i): i is Raw => !!i)
      .map((i) => backfill(i, message, input.boxes))
      .slice(0, 8);
    return json({ intents, reply: str(parsed.reply, 300) }, 200, h);
  } catch (e) {
    console.error('assistant-parse', e);
    return json({ error: 'Assistant is unavailable.' }, 502, h);
  } finally {
    clearTimeout(timer);
  }
});
