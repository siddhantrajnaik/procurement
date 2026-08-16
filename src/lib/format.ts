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
  jha:      '🦉',
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
  jha: 'Post Doc',
};

export function roleLabel(role?: string, handle?: string): string {
  if (handle && CUSTOM_TITLES[handle.toLowerCase()]) return CUSTOM_TITLES[handle.toLowerCase()];
  if (role === 'guest') return 'Guest';
  if (role === 'pi') return 'Principal Investigator';
  return 'PhD';
}
