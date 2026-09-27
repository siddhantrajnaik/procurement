type Dim = 'volume' | 'mass';

const UNITS: Record<string, { dim: Dim; base: number }> = {
  µl: { dim: 'volume', base: 1e-6 },
  ul: { dim: 'volume', base: 1e-6 },
  microlitre: { dim: 'volume', base: 1e-6 },
  microliter: { dim: 'volume', base: 1e-6 },
  ml: { dim: 'volume', base: 1e-3 },
  millilitre: { dim: 'volume', base: 1e-3 },
  milliliter: { dim: 'volume', base: 1e-3 },
  l: { dim: 'volume', base: 1 },
  ltr: { dim: 'volume', base: 1 },
  litre: { dim: 'volume', base: 1 },
  liter: { dim: 'volume', base: 1 },
  mg: { dim: 'mass', base: 1e-3 },
  g: { dim: 'mass', base: 1 },
  gm: { dim: 'mass', base: 1 },
  gram: { dim: 'mass', base: 1 },
  kg: { dim: 'mass', base: 1e3 },
};

function lookup(unit: string | null | undefined) {
  if (!unit) return null;
  const key = unit.trim().toLowerCase().replace(/s$/, '');
  return UNITS[key] ?? UNITS[key.replace(/\.$/, '')] ?? null;
}

/**
 * The amount in the item's own unit, or null when the two cannot be converted
 * ("2 bottles" against an item kept in mL). Stock quantities are stored in the
 * item's unit, so "used 50 mL" against a bottle tracked in litres must become
 * 0.05, not 50 — the latter empties it.
 */
export function toItemUnit(amount: number, from: string | null, itemUnit: string): number | null {
  if (!from) return amount;
  const a = lookup(from);
  const b = lookup(itemUnit);
  if (!a || !b) return from.trim().toLowerCase() === itemUnit.trim().toLowerCase() ? amount : null;
  if (a.dim !== b.dim) return null;
  return Number(((amount * a.base) / b.base).toPrecision(6));
}
