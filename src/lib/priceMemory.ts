import { Purchase } from '../types';

/**
 * What a purchase cost the lab before.
 *
 * Two lookups, deliberately, because they light up at different stages of the
 * app's life. Item history is what you actually want — "DMEM was ₹21,674 in
 * August" — but it needs the same thing to have been ordered twice. Vendor
 * history needs only that the vendor has been used before, which is true far
 * sooner, so it carries the feature until repeat orders accumulate.
 */

export interface ItemPriceMemory {
  kind: 'item';
  /** Title of the earlier purchase that matched. */
  title: string;
  price: number;
  vendor: string;
  when: string;
}

export interface VendorPriceMemory {
  kind: 'vendor';
  vendor: string;
  orderCount: number;
  /** The most recent price from this vendor, on whatever item. */
  lastPrice: number;
  when: string;
}

export type PriceMemory = ItemPriceMemory | VendorPriceMemory;

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Vendors are entered inconsistently — "Cella", "Cella Solutions , Aarti Singh".
 * Keying on the part before the first comma folds those together.
 */
function vendorKey(vendor: string): string {
  return normalise(vendor.split(',')[0]);
}

/** Crude singular form so "falcons" matches "falcon". */
function stem(word: string): string {
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

/** Words worth matching on: drops units and bare numbers that appear everywhere. */
function tokens(title: string): Set<string> {
  const stop = new Set(['ml', 'mg', 'kit', 'for', 'the', 'and', 'with', 'ul', 'litre', 'liter']);
  return new Set(
    normalise(title)
      .split(' ')
      .filter((w) => w.length > 2 && !stop.has(w) && !/^\d+$/.test(w))
      .map(stem)
  );
}

/** The price actually paid: the approved quote, else the cheapest one on record. */
function settledQuote(p: Purchase): { price: number; vendor: string } | null {
  if (!p.quotations?.length) return null;
  const approved = p.quotations.find((q) => q.isApproved);
  if (approved) return { price: approved.price, vendor: approved.vendor };
  const cheapest = [...p.quotations].sort((a, b) => a.price - b.price)[0];
  return cheapest ? { price: cheapest.price, vendor: cheapest.vendor } : null;
}

/**
 * Most recent earlier purchase of the same thing. Requires either an exact
 * normalised title match or a majority of shared words, so "DMEM" matches
 * "DMEM high glucose" but not "DPBS for cell culture".
 */
export function findItemHistory(
  purchases: Purchase[],
  currentId: string,
  title: string
): ItemPriceMemory | null {
  const target = normalise(title);
  if (!target) return null;
  const targetTokens = tokens(title);

  const matches = purchases
    .filter((p) => p.id !== currentId)
    .filter((p) => {
      if (normalise(p.title) === target) return true;
      if (targetTokens.size === 0) return false;
      const other = tokens(p.title);
      if (other.size === 0) return false;
      const shared = [...targetTokens].filter((w) => other.has(w)).length;
      return shared / Math.min(targetTokens.size, other.size) >= 0.5;
    })
    .map((p) => ({ p, quote: settledQuote(p) }))
    .filter((m): m is { p: Purchase; quote: { price: number; vendor: string } } => m.quote !== null)
    .sort((a, b) => b.p.createdAt.localeCompare(a.p.createdAt));

  const best = matches[0];
  if (!best) return null;
  return {
    kind: 'item',
    title: best.p.title,
    price: best.quote.price,
    vendor: best.quote.vendor,
    when: best.p.createdAt,
  };
}

/** How much the lab has spent with this vendor before, across any item. */
export function findVendorHistory(
  purchases: Purchase[],
  currentId: string,
  vendor: string
): VendorPriceMemory | null {
  const key = vendorKey(vendor);
  if (!key) return null;

  const priced = purchases
    .filter((p) => p.id !== currentId)
    .flatMap((p) =>
      (p.quotations ?? [])
        .filter((q) => vendorKey(q.vendor) === key && q.price > 0)
        .map((q) => ({ price: q.price, when: p.createdAt, vendor: q.vendor }))
    );

  if (priced.length === 0) return null;
  // Deliberately not a min-max range: across different items that spread says
  // nothing useful, and one mistyped quote makes it look alarming.
  const latest = priced.reduce((a, b) => (b.when.localeCompare(a.when) > 0 ? b : a));

  return {
    kind: 'vendor',
    vendor: latest.vendor.split(',')[0].trim(),
    orderCount: new Set(
      purchases
        .filter((p) => p.id !== currentId && (p.quotations ?? []).some((q) => vendorKey(q.vendor) === key))
        .map((p) => p.id)
    ).size,
    lastPrice: latest.price,
    when: latest.when,
  };
}

/** Item history when it exists, vendor history otherwise. */
export function findPriceMemory(
  purchases: Purchase[],
  currentId: string,
  title: string,
  vendor: string
): PriceMemory | null {
  return (
    findItemHistory(purchases, currentId, title) ??
    (vendor.trim() ? findVendorHistory(purchases, currentId, vendor) : null)
  );
}
