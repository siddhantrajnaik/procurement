/**
 * Contract between the parser (parse.ts / match.ts) and the assistant screen.
 * The parser only turns words into these shapes; it never touches data.
 * Names and boxes here are still the raw words the person used — resolving
 * them against real rows is match.ts's job, done by the screen.
 */

export interface ParsedItem {
  /** The words naming the thing, quantity words stripped: "KCl", "methanol". */
  name: string;
  /** How many containers: "3 bottles of KCl", "KCl x3", "two KCl" → 3. */
  count: number | null;
  /** An amount with a unit: "50 mL methanol" → 50. */
  amount: number | null;
  /** The unit as written, normalised: "mL", "L", "g", "mg", "µL", "bottles"… */
  unit: string | null;
}

export type Intent =
  /** "where is triton", "find KCl", "which box has FCV", or any unrecognised text. */
  | { kind: 'find'; query: string }
  /** "what's in CC-S05", "show box PN01", "open CC-S05". */
  | { kind: 'box'; box: string }
  /** "add silver nitrate, trypan blue to CC-S05", or a first line naming a box followed by one item per line. */
  | { kind: 'add'; box: string | null; items: ParsedItem[] }
  /** "move FCV and PBS from viral box to PN01" — from is optional. */
  | { kind: 'move'; items: string[]; from: string | null; to: string }
  /** "swap tricine in CC-S04 with sucrose in CC-S01" — boxes optional. */
  | { kind: 'swap'; a: { item: string; box: string | null }; b: { item: string; box: string | null } }
  /** "took 50 mL methanol", "took out FCV", "taking 2 KCl". */
  | { kind: 'take'; items: ParsedItem[] }
  /** "returned FCV", "put back KCl", "gave back the PBS". */
  | { kind: 'return'; items: string[] }
  /** "restocked 2 bottles tween 80", "got 500 g sucrose", "refill methanol 1 L". */
  | { kind: 'restock'; items: ParsedItem[] }
  /** "what's running low", "what's expiring". Produced by the AI parser only. */
  | { kind: 'low' }
  /** "we need 2 boxes of falcons, urgent" — raise a purchase request. AI parser only. */
  | { kind: 'request'; title: string; quantity: string; priority: 'normal' | 'urgent' | 'critical'; note: string }
  /** Nothing usable (empty input). */
  | { kind: 'empty' };

export interface Ranked<T> {
  item: T;
  /** 0..1, 1 = exact after normalisation. */
  score: number;
}
