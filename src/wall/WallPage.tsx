import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';

// Only the project URL is referenced here — never the client or its key.
const FEED_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wall-board`;
const KEY_STORAGE = 'mb.wall.key';
const REFRESH_MS = 60_000;
const DAY_START = 7;
const DAY_END = 21;

interface Booking { item: string; date: string; start: string; end: string; by: string; purpose: string }
interface Board {
  today: string;
  tomorrow: string;
  items: { name: string; color: string; hood: boolean }[];
  bookings: Booking[];
  orders: { waiting: number; quotes: number; incoming: { title: string; status: string }[] };
  alerts: {
    low: { name: string; left: string }[];
    expiring: { name: string; date: string; expired: boolean }[];
    instruments: { name: string; status: string }[];
    service: { name: string }[];
  };
}

// ---------------------------------------------------------------- time (always India time, whatever the TV's clock says)

const istParts = (d: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).map((x) => [x.type, x.value])
  );
  return { h: Number(p.hour), m: Number(p.minute) };
};
const clock = (d: Date) => { const { h, m } = istParts(d); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
const longDate = (d: Date) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' }).format(d);
const hours = (t: string) => Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60;

const STATUS_LABEL: Record<string, string> = { ordered: 'Ordered', transit: 'On the way', partial: 'Part arrived' };
const INSTRUMENT_LABEL: Record<string, string> = { needs_attention: 'Needs attention', down: 'Down', under_service: 'Under service' };

// ---------------------------------------------------------------- page

export function WallPage() {
  const [key] = useState(() => {
    // The key rides in the link's #fragment (never sent to a server or logged), then stays on the device.
    const fromLink = new URLSearchParams(window.location.hash.slice(1)).get('k');
    try {
      if (fromLink) { localStorage.setItem(KEY_STORAGE, fromLink); history.replaceState(null, '', window.location.pathname); }
      return fromLink ?? localStorage.getItem(KEY_STORAGE);
    } catch { return fromLink; }
  });
  const [board, setBoard] = useState<Board | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'offline' | 'badkey'>('loading');
  const [now, setNow] = useState(() => new Date());
  const [drift, setDrift] = useState({ x: 0, y: 0 });

  const load = useCallback(async () => {
    if (!key) return;
    try {
      const res = await fetch(FEED_URL, { headers: { 'x-wall-key': key } });
      if (res.status === 401 || res.status === 503) { setStatus('badkey'); return; }
      if (!res.ok) throw new Error();
      setBoard(await res.json());
      setStatus('ok');
    } catch {
      setStatus((s) => (s === 'ok' ? 'offline' : s === 'loading' ? 'offline' : s)); // keep showing the last good data
    }
  }, [key]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => setDrift({ x: Math.round(Math.random() * 12 - 6), y: Math.round(Math.random() * 12 - 6) }), 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  // A TV that sleeps shows nothing: ask the browser to keep the screen on, and ask again after any hiccup.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const ask = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (wl && document.visibilityState === 'visible') lock = await wl.request('screen');
      } catch { /* the TV's own settings decide */ }
    };
    void ask();
    document.addEventListener('visibilitychange', ask);
    return () => { document.removeEventListener('visibilitychange', ask); void lock?.release(); };
  }, []);

  if (!key || status === 'badkey') {
    return (
      <div className="h-dvh flex items-center justify-center p-10 text-center">
        <div className="max-w-2xl flex flex-col gap-4">
          <p className="text-[2.4rem] font-extrabold">MB Lab wall screen</p>
          <p className="text-[1.3rem] text-muted">
            {status === 'badkey'
              ? 'The key in this link is not accepted. Open the link again from the lab app or ask Siddhant for a new one.'
              : 'Open this screen with its private link, which ends in #k= and a long code.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh p-[1.4rem] drift" style={{ transform: `translate(${drift.x}px, ${drift.y}px)` }}>
      <div className="h-full grid gap-[1.1rem] grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto]">
        <Header now={now} status={status} />
        <Bookings board={board} now={now} />
        <aside className="flex flex-col gap-[1.1rem] min-h-0">
          <Orders board={board} />
          <Alerts board={board} />
        </aside>
        <QrStrip />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- header

function Header({ now, status }: { now: Date; status: string }) {
  return (
    <header className="col-span-2 flex items-center justify-between">
      <div className="flex items-center gap-[1rem]">
        <div className="w-[3.4rem] h-[3.4rem] rounded-2xl bg-accent flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-[1.9rem] h-[1.9rem] text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 2v7.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V2" /><path d="M8.5 2h7" /><path d="M7 16h10" />
          </svg>
        </div>
        <div className="leading-tight">
          <p className="text-[1.8rem] font-extrabold tracking-tight">MB Lab</p>
          <p className="text-[1.1rem] text-muted">Structural Virology Lab · IIT Delhi</p>
        </div>
      </div>
      <div className="flex items-center gap-[1.4rem] text-right">
        {status === 'offline' && <span className="text-[1.1rem] text-amber-300">Reconnecting…</span>}
        <div className="leading-none">
          <p className="text-[3.6rem] font-extrabold tabular-nums tracking-tight">{clock(now)}</p>
          <p className="text-[1.15rem] text-muted mt-1">{longDate(now)}</p>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- bookings

const panel = 'rounded-3xl bg-card border border-line p-[1.3rem]';
const heading = 'text-[1rem] font-bold uppercase tracking-[0.16em] text-muted';

function Bookings({ board, now }: { board: Board | null; now: Date }) {
  const items = useMemo(
    () => [...(board?.items ?? [])].sort((a, b) => Number(b.hood) - Number(a.hood) || a.name.localeCompare(b.name)),
    [board]
  );
  const nowH = (() => { const { h, m } = istParts(now); return h + m / 60; })();
  const todays = (board?.bookings ?? []).filter((b) => b.date === board?.today);
  const tomorrows = (board?.bookings ?? []).filter((b) => b.date === board?.tomorrow);
  const inUse = items.filter((it) => todays.some((b) => b.item === it.name && hours(b.start) <= nowH && nowH < hours(b.end))).length;
  const span = DAY_END - DAY_START;
  const nowPct = ((nowH - DAY_START) / span) * 100;
  const showNow = nowPct > 0 && nowPct < 100;
  const pct = (h: number) => `${((h - DAY_START) / span) * 100}%`;
  const hourMarks = Array.from({ length: span - 1 }, (_, i) => DAY_START + 1 + i);

  return (
    <section className={`${panel} flex flex-col gap-[1rem] min-h-0`}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className={heading}>Bookings today</h2>
        <p className="text-[1.15rem] text-muted">
          {todays.length === 0 ? 'No bookings today' : `${todays.length} booking${todays.length === 1 ? '' : 's'}`}
          {items.length > 0 && <> <span className="mx-2">·</span> <span className={inUse > 0 ? 'text-red-300 font-semibold' : 'text-emerald-400 font-semibold'}>{inUse} of {items.length} in use now</span></>}
        </p>
      </div>

      {items.length === 0 && board ? (
        <p className="text-[1.3rem] text-muted">Nothing is set up for booking yet.</p>
      ) : (
        <div className="flex flex-col gap-[0.8rem]">
          <div className="grid grid-cols-[15rem_minmax(0,1fr)] gap-[0.9rem]">
            <span />
            <div className="relative h-[1.8rem] text-[0.95rem] text-muted tabular-nums">
              {[8, 10, 12, 14, 16, 18, 20].filter((h) => !showNow || Math.abs(h - nowH) > 0.8).map((h) => (
                <span key={h} className="absolute top-0 -translate-x-1/2" style={{ left: pct(h) }}>{h}:00</span>
              ))}
              {showNow && (
                <span className="absolute -top-[0.1rem] -translate-x-1/2 rounded-full bg-accent text-white font-bold px-[0.6rem] text-[0.95rem] leading-[1.6rem] z-10" style={{ left: `${nowPct}%` }}>
                  {clock(now)}
                </span>
              )}
            </div>
          </div>
          {items.map((it) => {
            const mine = todays.filter((b) => b.item === it.name).sort((a, b) => hours(a.start) - hours(b.start));
            const live = mine.find((b) => hours(b.start) <= nowH && nowH < hours(b.end));
            const next = mine.find((b) => hours(b.start) > nowH);
            return (
              <div key={it.name} className="grid grid-cols-[15rem_minmax(0,1fr)] gap-[0.9rem] items-center">
                <div className="min-w-0 flex flex-col gap-[0.3rem]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-[0.8rem] h-[0.8rem] rounded-full shrink-0" style={{ background: it.color }} />
                    <span className="text-[1.3rem] font-bold leading-tight break-words">{it.name}</span>
                  </div>
                  {live ? (
                    <p className="text-[1rem] leading-tight">
                      <span className="inline-block rounded-full bg-red-500/15 text-red-300 font-bold px-[0.6rem] py-[0.05rem] mr-2">In use</span>
                      <span className="text-muted">{live.by} until {live.end}</span>
                    </p>
                  ) : (
                    <p className="text-[1rem] leading-tight">
                      <span className="inline-block rounded-full bg-emerald-500/15 text-emerald-300 font-bold px-[0.6rem] py-[0.05rem] mr-2">Free now</span>
                      <span className="text-muted">{next ? `next ${next.start} · ${next.by}` : 'rest of the day'}</span>
                    </p>
                  )}
                </div>
                <div className="relative h-[4.2rem] rounded-2xl bg-paper border border-line overflow-hidden">
                  {showNow && <span className="absolute top-0 bottom-0 left-0 bg-black/30" style={{ width: `${nowPct}%` }} />}
                  {hourMarks.map((h) => (
                    <span key={h} className={`absolute top-0 bottom-0 w-px ${h % 2 === 0 ? 'bg-line' : 'bg-line/40'}`} style={{ left: pct(h) }} />
                  ))}
                  {mine.length === 0 && <span className="absolute inset-0 flex items-center justify-center text-[1.05rem] text-emerald-400/70">Free all day</span>}
                  {mine.map((b, i) => {
                    const start = Math.max(DAY_START, hours(b.start));
                    const left = ((start - DAY_START) / span) * 100;
                    const width = Math.max(4, ((Math.min(DAY_END, hours(b.end)) - start) / span) * 100);
                    const isLive = b === live;
                    const done = hours(b.end) <= nowH;
                    return (
                      <div key={i} className="absolute top-[0.35rem] bottom-[0.35rem] rounded-xl px-[0.7rem] flex flex-col justify-center overflow-hidden text-black"
                        style={{ left: `${left}%`, width: `${width}%`, background: it.color, opacity: done ? 0.45 : 1, outline: isLive ? '0.2rem solid #fff' : undefined }}>
                        <span className="text-[1.1rem] font-bold leading-tight truncate">{b.by}</span>
                        <span className="text-[0.9rem] leading-tight truncate opacity-80">{b.start}–{b.end}{b.purpose ? ` · ${b.purpose}` : ''}</span>
                      </div>
                    );
                  })}
                  {showNow && <span className="absolute top-0 bottom-0 w-[0.2rem] bg-accent z-10" style={{ left: `${nowPct}%` }} />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-auto pt-[0.9rem] border-t border-line">
        <h3 className={`${heading} mb-[0.6rem]`}>Tomorrow{tomorrows.length > 0 && ` · ${tomorrows.length} booking${tomorrows.length === 1 ? '' : 's'}`}</h3>
        {tomorrows.length === 0 ? (
          <p className="text-[1.15rem] text-muted">Nothing booked yet. Everything is free.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-[1.5rem] gap-y-[0.4rem]">
            {tomorrows.slice(0, 8).map((b, i) => {
              const color = board?.items.find((x) => x.name === b.item)?.color;
              return (
                <li key={i} className="text-[1.15rem] truncate flex items-center gap-2">
                  <span className="w-[0.6rem] h-[0.6rem] rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-ink font-semibold">{b.item}</span> <span className="text-muted tabular-nums">{b.start}–{b.end}</span> · {b.by}
                </li>
              );
            })}
            {tomorrows.length > 8 && <li className="text-[1rem] text-muted">+ {tomorrows.length - 8} more</li>}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- orders and alerts

function Orders({ board }: { board: Board | null }) {
  const o = board?.orders;
  return (
    <section className={`${panel} flex flex-col gap-[0.8rem] min-h-0`}>
      <h2 className={heading}>Orders</h2>
      <div className="grid grid-cols-2 gap-[0.8rem]">
        <Stat n={o?.waiting} label="Waiting for quotes" />
        <Stat n={o?.quotes} label="Comparing quotes" />
      </div>
      <h3 className={`${heading} mt-1`}>Arriving</h3>
      {o && o.incoming.length === 0 && <p className="text-[1.15rem] text-muted">Nothing on the way.</p>}
      <ul className="flex flex-col gap-[0.35rem] min-h-0 overflow-hidden">
        {o?.incoming.map((x, i) => (
          <li key={i} className="flex items-center justify-between gap-3 text-[1.15rem]">
            <span className="truncate font-semibold">{x.title}</span>
            <span className={`shrink-0 text-[0.95rem] font-semibold rounded-full px-[0.7rem] py-[0.1rem] ${x.status === 'transit' ? 'bg-amber-500/15 text-amber-300' : 'bg-blue-500/15 text-blue-300'}`}>
              {STATUS_LABEL[x.status] ?? x.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ n, label }: { n: number | undefined; label: string }) {
  return (
    <div className="rounded-2xl bg-paper border border-line px-[0.9rem] py-[0.6rem]">
      <p className="text-[2.2rem] font-extrabold leading-none tabular-nums">{n ?? '–'}</p>
      <p className="text-[0.95rem] text-muted mt-1">{label}</p>
    </div>
  );
}

function Alerts({ board }: { board: Board | null }) {
  const a = board?.alerts;
  const rows: { tone: 'red' | 'amber'; text: string; note: string }[] = [];
  a?.instruments.forEach((i) => rows.push({ tone: 'red', text: i.name, note: INSTRUMENT_LABEL[i.status] ?? i.status }));
  a?.service.forEach((i) => rows.push({ tone: 'amber', text: i.name, note: 'Service overdue' }));
  a?.low.forEach((i) => rows.push({ tone: 'amber', text: i.name, note: `Low: ${i.left} left` }));
  a?.expiring.forEach((i) => rows.push({ tone: i.expired ? 'red' : 'amber', text: i.name, note: i.expired ? 'Expired' : `Expires ${i.date.slice(8, 10)}/${i.date.slice(5, 7)}` }));
  return (
    <section className={`${panel} flex flex-col gap-[0.8rem] min-h-0 flex-1`}>
      <h2 className={heading}>Needs attention</h2>
      {a && rows.length === 0 && <p className="text-[1.25rem] text-emerald-400">All clear. Nothing low, expiring or broken.</p>}
      <ul className="flex flex-col gap-[0.4rem] min-h-0 overflow-hidden">
        {rows.slice(0, 7).map((r, i) => (
          <li key={i} className="flex items-center gap-3 text-[1.15rem]">
            <span className={`w-[0.7rem] h-[0.7rem] rounded-full shrink-0 ${r.tone === 'red' ? 'bg-red-400' : 'bg-amber-400'}`} />
            <span className="truncate font-semibold">{r.text}</span>
            <span className="ml-auto shrink-0 text-muted text-[1rem]">{r.note}</span>
          </li>
        ))}
        {rows.length > 7 && <li className="text-[1rem] text-muted">+ {rows.length - 7} more</li>}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- QR codes

function QrStrip() {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
  return (
    <div className="col-span-2 grid grid-cols-2 gap-[1.1rem]">
      <QrCard title="Vendors" line="Scan to see what we need to buy and send your rate." url={`${base}vendor.html`} />
      <QrCard title="Visitors" line="Scan to log an instrument you used or something you borrowed." url={`${base}#/visit`} />
    </div>
  );
}

function QrCard({ title, line, url }: { title: string; line: string; url: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let live = true;
    void QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then((s) => { if (live) setSvg(s); });
    return () => { live = false; };
  }, [url]);
  return (
    <section className={`${panel} flex items-center gap-[1.3rem] !p-[1rem]`}>
      <div className="w-[9.5rem] h-[9.5rem] shrink-0 rounded-2xl bg-white p-[0.4rem] [&>svg]:w-full [&>svg]:h-full" role="img" aria-label={`QR code for ${title}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="min-w-0">
        <p className="text-[2rem] font-extrabold leading-tight">{title}</p>
        <p className="text-[1.2rem] text-muted mt-1 leading-snug">{line}</p>
      </div>
    </section>
  );
}
