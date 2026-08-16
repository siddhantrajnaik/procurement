/**
 * localStorage that cannot throw.
 *
 * Access to localStorage raises rather than returning null when storage is
 * unavailable — blocked by enterprise policy, disabled cookies/site data, or a
 * full quota. That matters most in a `useState` initialiser, where the throw
 * happens during render and takes the whole app down to a blank screen. These
 * wrappers degrade to "no stored value" instead.
 */

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns whether the write actually landed. */
export function writeStored(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to do — the value is already unreachable */
  }
}
