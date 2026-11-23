import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { MonthStrip } from './MonthCalendar';
import { Papers } from './Papers';
import { Songs } from './Songs';
import { Thought } from './Thought';
import { Picture } from './Picture';
import { Ticker } from './Ticker';
import { announce, canPlay, quietHour, setSoundOn, soundOn, spokenTime } from './sound';

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
  motm?: { title: string; blurb: string; image: string } | null;
  quote?: { text: string; author: string } | null;
  notice?: string | null;
  bookings: Booking[];
  orders: {
    waiting: number;
    quotes: number;
    incoming: { title: string; status: string }[];
    need?: { title: string; catalogNumber: string | null; quantity: string; brand: string | null; photoUrl: string | null }[];
  };
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

const INSTRUMENT_LABEL: Record<string, string> = { needs_attention: 'Needs attention', down: 'Down', under_service: 'Under service' };

// ---------------------------------------------------------------- page

// A link ending in &s=0 opens the screen silent (for viewing on a phone or laptop); it does not change the saved setting.
const SILENT_LINK = new URLSearchParams(window.location.hash.slice(1)).get('s') === '0';

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

  // ---- sound: a chime and a spoken line before and at the start of each booking, and when an instrument goes down
  const [sound, setSound] = useState(() => soundOn() && !SILENT_LINK);
  const [unlocked, setUnlocked] = useState(canPlay);
  useEffect(() => {
    const unlock = () => setUnlocked(true);
    const onKey = (e: KeyboardEvent) => {
      unlock();
      if (e.key === 'm' || e.key === 'M') setSound((on) => { setSoundOn(!on); return !on; });
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', onKey); };
  }, []);

  // Every night at 3 AM India time: reload, which fetches a fresh paper list and any new version of this page.
  useEffect(() => {
    const id = setInterval(() => {
      const { h, m } = istParts(new Date());
      if (h !== 3 || m > 5) return;
      const stamp = new Date().toISOString().slice(0, 10);
      try {
        if (sessionStorage.getItem('mb.wall.reloaded') === stamp) return;
        sessionStorage.setItem('mb.wall.reloaded', stamp);
      } catch { /* reload anyway */ }
      window.location.reload();
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const said = useRef<{ date: string; keys: Set<string> } | null>(null);
  const lastDown = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!board) return;
    if (!said.current || said.current.date !== board.today) {
      let keys: string[] = [];
      try { const v = JSON.parse(localStorage.getItem('mb.wall.said') ?? '{}'); if (v.date === board.today) keys = v.keys; } catch { /* fresh start */ }
      said.current = { date: board.today, keys: new Set(keys) };
    }
    const memo = said.current;
    const lines: { text: string; urgent: boolean }[] = [];
    const once = (k: string, text: string, urgent = false) => { if (!memo.keys.has(k)) { memo.keys.add(k); lines.push({ text, urgent }); } };

    const { h, m } = istParts(now);
    const nowH = h + m / 60;
    for (const b of board.bookings) {
      if (b.date !== board.today) continue;
      const mins = Math.round((hours(b.start) - nowH) * 60);
      const id = `${b.item}|${b.start}|${b.by}`;
      if (mins > 0 && mins <= 10) once(`soon|${id}`, `${b.item}. ${b.by}'s booking starts in ${mins} minute${mins === 1 ? '' : 's'}.`);
      else if (mins <= 0 && mins > -2) {
        memo.keys.add(`soon|${id}`);
        once(`start|${id}`, `${b.item} is now booked for ${b.by}, until ${spokenTime(b.end)}.`);
      }
    }
    const down = new Set(board.alerts.instruments.map((i) => i.name));
    if (lastDown.current) {
      for (const i of board.alerts.instruments) {
        if (!lastDown.current.has(i.name)) lines.push({ text: `Attention. ${i.name} is marked ${INSTRUMENT_LABEL[i.status]?.toLowerCase() ?? i.status}.`, urgent: true });
      }
    }
    lastDown.current = down;
    try { localStorage.setItem('mb.wall.said', JSON.stringify({ date: memo.date, keys: [...memo.keys] })); } catch { /* ignore */ }

    if (sound && unlocked && !quietHour(h)) lines.forEach((l) => announce(l.text, l.urgent));
  }, [board, now, sound, unlocked]);

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
      <div className="h-full grid gap-[1.1rem] grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto_auto]">
        <Header now={now} status={status} board={board} />
        <Bookings board={board} now={now} />
        <aside className="flex flex-col gap-[1.1rem] min-h-0">
          <Orders board={board} />
          <Alerts board={board} />
          <Picture motm={board?.motm ?? null} />
        </aside>
        <Ticker />
        <QrStrip now={now} quote={board?.quote ?? null} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- shared bits

const panel = 'rounded-3xl bg-card border border-line p-[1.3rem]';
const heading = 'text-[1.05rem] font-bold uppercase tracking-[0.16em] text-muted';
const nowHours = (d: Date) => { const { h, m } = istParts(d); return h + m / 60; };
const shortDay = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00Z`));
const byStart = (a: Booking, b: Booking) => hours(a.start) - hours(b.start);
const colorOf = (board: Board | null, item: string) => board?.items.find((x) => x.name === item)?.color ?? '#9CA3AF';

// ---------------------------------------------------------------- header

function Header({ now, status, board }: { now: Date; status: string; board: Board | null }) {
  const sanDiego = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit', hour12: true }).format(now);
  return (
    <header className="col-span-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[2rem]">
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

      {/* A notice from the lab, when there is one. */}
      <div className="justify-self-center min-w-0 max-w-full">
        {board?.notice && (
          <div className="flex items-center gap-[0.9rem] rounded-full bg-accent/10 border border-accent/30 pl-[0.8rem] pr-[1.6rem] py-[0.55rem] min-w-0">
            <svg viewBox="0 0 24 24" className="w-[1.6rem] h-[1.6rem] shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m3 11 18-5v12L3 14v-3Z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
            </svg>
            <span className="text-[1.5rem] font-bold truncate">{board.notice}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-[1.4rem] text-right">
        {status === 'offline' && <span className="text-[1.1rem] text-amber-300">Reconnecting…</span>}
        <div className="leading-none">
          <p className="text-[3.6rem] font-extrabold tabular-nums tracking-tight">{clock(now)}</p>
          <p className="text-[1.15rem] text-muted mt-1">{longDate(now)}</p>
          <p className="text-[0.95rem] text-muted/70 mt-[0.35rem]">San Diego · {sanDiego}</p>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- bookings

function Bookings({ board, now }: { board: Board | null; now: Date }) {
  const realH = nowHours(now);
  // After the lab day ends the timeline turns to tomorrow, which is what people check in the evening.
  const evening = realH >= DAY_END;
  const day = evening ? board?.tomorrow : board?.today;
  const nowH = evening ? -1 : realH;
  const shown = (board?.bookings ?? []).filter((b) => b.date === day).sort(byStart);
  // The cell culture hood is always shown. Any other instrument appears only on a day someone has booked it.
  const items = useMemo(() => {
    if (!board) return [];
    const hood = board.items.filter((i) => i.hood);
    const rows = hood.length ? hood : [{ name: 'Cell Culture Hood', color: '#f59e0b', hood: true }];
    const others = board.items.filter((i) => !i.hood && shown.some((b) => b.item === i.name));
    return [...rows, ...others];
  }, [board, shown]);
  const tomorrows = evening ? [] : (board?.bookings ?? []).filter((b) => b.date === board?.tomorrow).sort(byStart);

  const span = DAY_END - DAY_START;
  const pct = (h: number) => `${((h - DAY_START) / span) * 100}%`;
  const nowPct = ((nowH - DAY_START) / span) * 100;
  const showNow = nowPct > 0 && nowPct < 100;
  const hourMarks = Array.from({ length: span - 1 }, (_, i) => DAY_START + 1 + i);

  return (
    <section className={`${panel} flex flex-col gap-[1rem] min-h-0`}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className={heading}>
          {evening ? 'Tomorrow' : 'Today'}
          {day && <span className="ml-3 normal-case tracking-normal font-semibold text-ink/70">{shortDay(day)}</span>}
        </h2>
        <p className="text-[1.15rem] text-muted">
          {shown.length === 0 ? (evening ? 'Open for booking' : 'Open for booking today') : `${shown.length} booking${shown.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {items.length === 0 && board ? (
        <p className="text-[1.3rem] text-muted">Nothing is set up for booking yet.</p>
      ) : (
        <div className="shrink-0 flex flex-col gap-[0.7rem]">
          <div className="grid grid-cols-[17rem_minmax(0,1fr)] gap-[0.9rem]">
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

          {/* Rows share the panel's height, so three instruments fill it instead of huddling at the top. */}
          <div className="flex-1 min-h-0 flex flex-col gap-[0.7rem]">
            {items.map((it) => {
              const mine = shown.filter((b) => b.item === it.name);
              const live = mine.find((b) => hours(b.start) <= nowH && nowH < hours(b.end));
              const next = mine.find((b) => hours(b.start) > nowH);
              return (
                <div key={it.name} className="h-[6.5rem] shrink-0 grid grid-cols-[17rem_minmax(0,1fr)] gap-[0.9rem] items-stretch">
                  <div className="min-w-0 flex flex-col justify-center gap-[0.35rem]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-[0.95rem] h-[0.95rem] rounded-full shrink-0" style={{ background: it.color }} />
                      <span className="text-[1.6rem] font-extrabold leading-tight tracking-tight break-words">{it.name}</span>
                    </div>
                    {live ? (
                      <p className="text-[1.15rem] leading-tight">
                        <span className="inline-block rounded-full bg-red-500/15 text-red-300 font-bold px-[0.6rem] py-[0.05rem] mr-2">In use</span>
                        <span className="text-muted">{live.by} till {live.end}</span>
                      </p>
                    ) : mine.length === 0 ? (
                      <p className="text-[1.15rem] leading-tight">
                        <span className="inline-block rounded-full bg-emerald-500/15 text-emerald-300 font-bold px-[0.6rem] py-[0.05rem] mr-2">Available</span>
                        <span className="text-muted">all day</span>
                      </p>
                    ) : (
                      <p className="text-[1.15rem] leading-tight">
                        <span className={`inline-block rounded-full font-bold px-[0.6rem] py-[0.05rem] mr-2 ${evening ? 'bg-white/10 text-ink' : 'bg-emerald-500/15 text-emerald-300'}`}>{evening ? 'Booked' : 'Available'}</span>
                        <span className="text-muted">
                          {next ? `next ${next.start} · ${next.by}` : 'rest of the day'}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="relative rounded-2xl bg-white/[0.035] overflow-hidden">
                    {showNow && <span className="absolute top-0 bottom-0 left-0 bg-black/40" style={{ width: `${nowPct}%` }} />}
                    {hourMarks.map((h) => (
                      h % 2 === 0 && <span key={h} className="absolute top-0 bottom-0 w-px bg-white/[0.06]" style={{ left: pct(h) }} />
                    ))}
                    {mine.map((b, i) => {
                      const start = Math.max(DAY_START, hours(b.start));
                      const left = ((start - DAY_START) / span) * 100;
                      const width = Math.max(4, ((Math.min(DAY_END, hours(b.end)) - start) / span) * 100);
                      const isLive = b === live;
                      const done = hours(b.end) <= nowH;
                      const narrow = width < 22;
                      const labelRight = left + width < 72;
                      return (
                        <div key={i} className="contents">
                          <div className="absolute top-[0.45rem] bottom-[0.45rem] rounded-xl px-[0.9rem] flex flex-col justify-center gap-[0.1rem] overflow-hidden text-black"
                            style={{ left: `${left}%`, width: `${width}%`, background: it.color, opacity: done ? 0.35 : 1, boxShadow: isLive ? '0 0 0 0.22rem #fff, 0 0 1.6rem rgba(255,255,255,0.3)' : undefined }}>
                            {!narrow && (
                              <>
                                <span className="text-[1.3rem] font-extrabold leading-tight truncate">{b.by}</span>
                                <span className="text-[1.05rem] font-semibold leading-tight truncate opacity-75 tabular-nums">{b.start}–{b.end}{b.purpose ? ` · ${b.purpose}` : ''}</span>
                              </>
                            )}
                          </div>
                          {narrow && (
                            <div className={`absolute top-0 bottom-0 flex flex-col justify-center gap-[0.1rem] max-w-[40%] ${labelRight ? '' : 'items-end text-right'}`}
                              style={labelRight ? { left: `calc(${left + width}% + 0.8rem)`, opacity: done ? 0.5 : 1 } : { right: `calc(${100 - left}% + 0.8rem)`, opacity: done ? 0.5 : 1 }}>
                              <span className="text-[1.3rem] font-extrabold leading-tight truncate max-w-full">{b.by}</span>
                              <span className="text-[1.05rem] text-muted leading-tight truncate max-w-full tabular-nums">{b.start}–{b.end}{b.purpose ? ` · ${b.purpose}` : ''}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {showNow && <span className="absolute top-0 bottom-0 w-[0.2rem] bg-accent z-10" style={{ left: `${nowPct}%` }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Papers embedded />

      <MonthStrip now={now} />

      {!evening && (
        <div className="pt-[0.9rem] border-t border-line">
          <h3 className={`${heading} mb-[0.6rem]`}>
            Tomorrow
            {board && <span className="ml-3 normal-case tracking-normal font-semibold text-ink/70">{shortDay(board.tomorrow)}</span>}
            {tomorrows.length > 0 && <span className="ml-3 normal-case tracking-normal font-normal">· {tomorrows.length} booking{tomorrows.length === 1 ? '' : 's'}</span>}
          </h3>
          {tomorrows.length === 0 ? (
            <p className="text-[1.15rem] text-muted">Hood available.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-[1.5rem] gap-y-[0.4rem]">
              {tomorrows.slice(0, 6).map((b, i) => (
                <li key={i} className="text-[1.15rem] truncate flex items-center gap-2">
                  <span className="w-[0.6rem] h-[0.6rem] rounded-full shrink-0" style={{ background: colorOf(board, b.item) }} />
                  <span className="text-muted tabular-nums">{b.start}–{b.end}</span>
                  <span className="font-semibold">{b.item}</span>
                  <span className="text-muted">· {b.by}</span>
                </li>
              ))}
              {tomorrows.length > 6 && <li className="text-[1rem] text-muted">+ {tomorrows.length - 6} more</li>}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- orders and alerts

const ROTATE_MS = 5000;

function Orders({ board }: { board: Board | null }) {
  const o = board?.orders;
  const need = o?.need ?? [];
  const [i, setI] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (need.length < 2) return;
    const id = setInterval(() => setI((n) => n + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [need.length]);
  const cur = need.length ? need[i % need.length] : null;

  return (
    <section className={`${panel} flex flex-col gap-[0.8rem] min-h-0 ${o && !cur ? '!py-[0.9rem]' : ''}`}>
      <h2 className={`${heading} flex items-center justify-between`}>
        <span>Waiting for quotes{o && !cur && <span className="ml-4 normal-case tracking-normal font-semibold text-[1.3rem] text-muted">None right now</span>}</span>
        {need.length > 1 && <span className="normal-case tracking-normal font-semibold tabular-nums">{(i % need.length) + 1} / {need.length}</span>}
      </h2>
      {cur && (
        <>
          <div key={i % need.length} className="wall-fade flex items-center gap-[1rem] rounded-2xl bg-paper border border-line p-[0.8rem] min-h-0">
            {cur.photoUrl && !broken.has(cur.photoUrl) ? (
              <img src={cur.photoUrl} alt="" onError={() => setBroken((s) => new Set(s).add(cur.photoUrl!))}
                className="w-[8.5rem] h-[8.5rem] rounded-xl object-cover bg-card shrink-0" />
            ) : (
              <div className="w-[8.5rem] h-[8.5rem] rounded-xl bg-card border border-line shrink-0 flex items-center justify-center text-muted" aria-hidden>
                <svg viewBox="0 0 24 24" className="w-[2.4rem] h-[2.4rem]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5" /><path d="M12 13v8" />
                </svg>
              </div>
            )}
            <div className="min-w-0 flex flex-col gap-[0.5rem]">
              <p className="text-[1.8rem] font-extrabold leading-tight tracking-tight line-clamp-2">{cur.title}</p>
              <div className="flex flex-wrap items-center gap-x-[0.6rem] gap-y-[0.3rem]">
                <span className="rounded-full bg-accent/15 text-accent text-[1.15rem] font-bold px-[0.8rem] py-[0.1rem]">{cur.quantity}</span>
                {cur.brand && <span className="text-[1.15rem] text-muted truncate">{cur.brand}</span>}
              </div>
              {cur.catalogNumber && <p className="text-[1.05rem] font-mono text-muted truncate">Cat. {cur.catalogNumber}</p>}
            </div>
          </div>
          {need.length > 1 && (
            <div className="h-[0.3rem] rounded-full bg-line overflow-hidden" aria-hidden>
              <div key={i} className="wall-progress h-full bg-accent rounded-full" style={{ animationDuration: `${ROTATE_MS}ms` }} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Alerts({ board }: { board: Board | null }) {
  const a = board?.alerts;
  const rows: { tone: 'red' | 'amber'; text: string; note: string }[] = [];
  a?.instruments.forEach((i) => rows.push({ tone: 'red', text: i.name, note: INSTRUMENT_LABEL[i.status] ?? i.status }));
  a?.service.forEach((i) => rows.push({ tone: 'amber', text: i.name, note: 'Service overdue' }));
  a?.low.forEach((i) => rows.push({ tone: 'amber', text: i.name, note: `Low: ${i.left} left` }));
  a?.expiring.forEach((i) => rows.push({ tone: i.expired ? 'red' : 'amber', text: i.name, note: i.expired ? 'Expired' : `Expires ${i.date.slice(8, 10)}/${i.date.slice(5, 7)}` }));
  rows.sort((x, y) => Number(y.tone === 'red') - Number(x.tone === 'red'));

  return (
    <section className={`${panel} flex flex-col gap-[0.8rem] min-h-0 shrink-0`}>
      <h2 className={`${heading} flex items-center justify-between`}>
        <span>Lab status</span>
        {rows.length > 0 && <span className="normal-case tracking-normal font-semibold">{rows.length}</span>}
      </h2>
      {a && rows.length === 0 ? (
        <span className="self-start inline-flex items-center gap-[0.6rem] rounded-full bg-emerald-500/15 text-emerald-300 text-[1.3rem] font-bold px-[1rem] py-[0.3rem]">
          <svg viewBox="0 0 24 24" className="w-[1.3rem] h-[1.3rem]" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
          All good
        </span>
      ) : (
        <ul className="flex flex-col gap-[0.5rem] min-h-0 overflow-hidden">
          {rows.slice(0, 7).map((r, i) => (
            <li key={i} className={`flex items-center gap-3 text-[1.15rem] rounded-xl px-[0.8rem] py-[0.45rem] border-l-[0.25rem] ${r.tone === 'red' ? 'bg-red-500/8 border-red-400' : 'bg-amber-500/8 border-amber-400'}`}>
              <span className="truncate font-semibold">{r.text}</span>
              <span className={`ml-auto shrink-0 text-[1rem] ${r.tone === 'red' ? 'text-red-300' : 'text-amber-200/80'}`}>{r.note}</span>
            </li>
          ))}
          {rows.length > 7 && <li className="text-[1rem] text-muted px-[0.8rem]">+ {rows.length - 7} more</li>}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- QR codes

function QrStrip({ now, quote }: { now: Date; quote: { text: string; author: string } | null }) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
  return (
    <div className="col-span-2 grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1.15fr)] gap-[1.1rem]">
      <QrCard title="Vendors" line="Scan to see what we need and send us a quote." url={`${base}vendor.html`} />
      <Thought now={now} quote={quote} />
      <Songs now={now} />
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
    <section className={`${panel} flex items-center gap-[1rem] !p-[0.8rem]`}>
      <div className="w-[7.2rem] h-[7.2rem] shrink-0 rounded-xl bg-white p-[0.3rem] [&>svg]:w-full [&>svg]:h-full" role="img" aria-label={`QR code for ${title}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="min-w-0 max-w-[13rem] pr-[0.4rem]">
        <p className="text-[1.5rem] font-extrabold leading-tight">{title}</p>
        <p className="text-[1.05rem] text-muted mt-1 leading-snug">{line}</p>
      </div>
    </section>
  );
}
