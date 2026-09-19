const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const diff = Date.now() - then;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 2 * DAY) return 'yesterday';
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;

  return new Date(then).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/** "45m", "3h 20m", "2d 4h" — a run length, from minutes. */
export function formatMinutes(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return '';

  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = Math.round(minutes % 60);

  // Two units is as much as anyone reads off a card: an incubator run of two
  // days and four hours does not need the minutes.
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** "14 Sep, 2:30 pm" — when a run started, in the viewer's own timezone. */
export function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * `YYYY-MM-DDTHH:mm` in local time, for a `datetime-local` input.
 *
 * Same trap as `toDateStr` below: `toISOString()` would convert to UTC first and
 * hand IST a value five and a half hours in the past, so the field would open
 * showing the wrong time.
 */
export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * `YYYY-MM-DD` for a date, read in the viewer's own timezone.
 *
 * Deliberately not `toISOString().slice(0, 10)`: that converts to UTC first,
 * so anywhere ahead of UTC (IST is +5:30) it reports the previous day for the
 * first 5.5 hours after midnight — and breaks date arithmetic outright, since
 * adding a day to local midnight still lands on the same UTC date.
 */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today's calendar date, local. */
export function todayISO(): string {
  return toDateStr(new Date());
}

/** Shift a `YYYY-MM-DD` string by whole days, staying in local time. */
export function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

/**
 * Shift a `YYYY-MM-DD` string by whole months, staying in local time.
 *
 * `setMonth` clamps overflow days into the next month (Jan 31 + 1 month
 * would silently become Mar 3), which is wrong for a recurring reminder —
 * it should land on the last day of the short month instead, not skip
 * forward. Rolling back a day whenever the month didn't land where asked
 * catches exactly that case.
 */
export function addMonthsISO(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  if (d.getMonth() !== ((targetMonth % 12) + 12) % 12) d.setDate(0);
  return toDateStr(d);
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const USER_EMOJI: Record<string, string> = {
  paulomi:  '🦋',
  milan:    '🦁',
  mrittika: '🌸',
  rupam:    '🐯',
  bhawna:   '🦊',
  himanshu: '🐼',
  komal:    '🦄',
  siddhant: '🐉',
  sudipto:  '🦅',
  nalini:   '🐬',
  shalini:  '🦜',
  shaileshanand: '🦉',
  guest:    '👻',
};

export function initialOf(name: string, handle?: string): string {
  if (handle) {
    const emoji = USER_EMOJI[handle.toLowerCase()];
    if (emoji) return emoji;
  }
  return name.trim().charAt(0).toUpperCase() || '?';
}

const CUSTOM_TITLES: Record<string, string> = {
  milan: 'Godfather',
  shalini: 'Post Doc',
  shaileshanand: 'Post Doc',
};

export function roleLabel(role?: string, handle?: string): string {
  if (handle && CUSTOM_TITLES[handle.toLowerCase()]) return CUSTOM_TITLES[handle.toLowerCase()];
  if (role === 'guest') return 'Guest';
  if (role === 'pi') return 'Principal Investigator';
  return 'PhD';
}
