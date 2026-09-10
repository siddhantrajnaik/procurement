import { readStored, writeStored } from '../../lib/storage';

/**
 * Who the visitor is, kept on their own device.
 *
 * Visiting researchers share one `guest` profile, so a log entry keyed to that
 * profile would only ever say "Guest" — useless when you are trying to work out
 * who left a column dirty. Asking once and storing it locally gives every entry
 * a real name without an admin having to create a row per visitor.
 *
 * Same shape MuhuratView already uses for its own profile.
 */

const KEY = 'procure.guest.identity';

export interface GuestIdentity {
  name: string;
  affiliation: string;
}

export function loadGuestIdentity(): GuestIdentity | null {
  const raw = readStored(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GuestIdentity>;
    // A stored blank is the same as never having answered.
    if (!parsed || typeof parsed.name !== 'string' || !parsed.name.trim()) return null;
    return { name: parsed.name.trim(), affiliation: (parsed.affiliation ?? '').trim() };
  } catch {
    return null;
  }
}

export function saveGuestIdentity(identity: GuestIdentity): void {
  writeStored(KEY, JSON.stringify(identity));
}
