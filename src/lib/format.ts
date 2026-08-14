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

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initialOf(name: string): string {
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
