/**
 * Fuzzy matching of spoken/typed names against real rows. Pure; no data access.
 * Scores are 0..1; the screen uses pick() to decide between auto-select,
 * "did you mean…" choices, and "not found".
 *
 * Chemistry is unforgiving: one letter ("ethanol"/"methanol") or one extra word
 * ("sodium sulfate"/"sodium dodecyl sulfate") is a different compound. So a
 * candidate can only reach STRONG (and be auto-picked) when it is the same name:
 *  (a) equal after normalisation (case, punctuation, spacing, number words),
 *  (b) the same multiset of tokens (word order ignored, "sulphate" = "sulfate"),
 *  (c) the query equals a trailing parenthetical alias ("ipa" = "Isopropanol (IPA)")
 *      or the name without that alias ("isopropanol"), or
 *  (d) an ALIASES expansion of the query ("kcl" → "potassium chloride") is exact by (a)-(c).
 * Everything else (edit distance, substring, trigrams, partial token overlap) is
 * squeezed below STRONG (max FUZZY_CAP) so it is ranked and offered, never auto-picked.
 */
import type { Ranked } from './types';

const NUMBERS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8',
  nine: '9', ten: '10', eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15',
  sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20',
};

function rawTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[µμ]/g, 'u')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((w) => NUMBERS[w] ?? w);
}

/** Lowercase, number words → digits, all non-alphanumerics removed: "Triton X-100" → "tritonx100". */
export function normalize(s: string): string {
  return rawTokens(s).join('');
}

// British/variant spellings of the same word. Only true spelling variants — never different compounds.
const SPELLING: Record<string, string> = {
  caesium: 'cesium', aluminium: 'aluminum', bertini: 'bertani', hundred: '100',
};

/** Matching tokens: rawTokens + "g250" → "g","250", β → beta, "sulph" → "sulf", spelling variants. */
function tokens(s: string): string[] {
  const out: string[] = [];
  const src = s.replace(/β/g, ' beta ').replace(/α/g, ' alpha ');
  for (const w of rawTokens(src)) {
    for (let p of w.split(/(?<=\d)(?=\p{L})|(?<=\p{L})(?=\d)/u)) {
      p = NUMBERS[p] ?? p;
      if (p.includes('sulph')) p = p.replace(/sulph/g, 'sulf');
      out.push(SPELLING[p] ?? p);
    }
  }
  return out;
}

// --- spoken letters in box names ("see see es five" → "c c s 5") ---
const SPOKEN_LETTER: Record<string, string> = {
  see: 'c', sea: 'c', es: 's', ess: 's', bee: 'b', be: 'b', dee: 'd', pee: 'p', em: 'm', en: 'n',
};

/** Maps spelled-out letters only when every token is short and a digit is present (a box-like sequence). */
function spokenBoxTokens(t: string[]): string[] {
  if (t.length < 2 || !t.some((w) => /^\d+$/.test(w))) return t;
  if (!t.every((w) => /^(?:\d{1,3}|\p{L}{1,3})$/u.test(w) || w in SPOKEN_LETTER)) return t;
  return t.map((w) => SPOKEN_LETTER[w] ?? w);
}

/** Canonical box key: "CC-S05", "cc s 5", "see see es five" → "ccs5"; "B01-C01", "b 1 c 1" → "b1c1"; "Viral Box" → "viral". */
export function boxKey(s: string): string {
  let t = rawTokens(s);
  while (t.length > 1 && /^(?:the|my|our)$/.test(t[0])) t.shift();
  if (t.length > 1 && t[0] === 'box') t.shift();
  if (t.length > 1 && t[t.length - 1] === 'box') t.pop();
  t = spokenBoxTokens(t);
  return t.join('').replace(/\d+/g, (d) => String(Number(d)));
}

// --- aliases (rule d). Keys and expansions are normalised on load. ---
const ALIAS_TABLE: [string[], string[]][] = [
  [['kcl'], ['potassium chloride']],
  [['nacl'], ['sodium chloride']],
  [['sds'], ['sodium dodecyl sulfate']],
  [['pfa'], ['paraformaldehyde']],
  [['temed'], ["N,N,N',N'-tetramethylethylenediamine", 'tetramethylethylenediamine']],
  [['ipa', 'isopropyl alcohol', '2-propanol'], ['isopropanol']],
  [['etoh', 'ethyl alcohol'], ['ethanol']],
  [['meoh', 'methyl alcohol'], ['methanol']],
  [['bme', 'b-me', 'beta me', 'beta mercaptoethanol', 'mercaptoethanol', '2-me'], ['2-mercaptoethanol']],
  [['dtt'], ['dithiothreitol']],
  [['edta'], ['ethylenediaminetetraacetic acid']],
  [['tris'], ['tris base']],
  [['tris hcl', 'tris hydrochloride'], ['tris hydrochloride', 'trisma hydrochloride']],
  [['peg'], ['polyethylene glycol']],
  [['copper sulphate', 'copper sulfate'], ['cupric sulfate', 'copper sulfate']],
  [['lb broth'], ['luria bertani broth']],
];
const ALIASES = new Map<string, string[]>();
for (const [keys, exps] of ALIAS_TABLE) for (const k of keys) ALIASES.set(tokens(k).join(''), exps);
const MAX_ALIAS_RUN = 4;

// --- per-string preparation, cached (names repeat across every query) ---
interface Prep {
  toks: string[];
  joined: string;
  /** Sorted tokens: equal bags ⇒ same words in any order. */
  bag: string;
  tri: Map<string, number>;
  triN: number;
  /** Rule (c), as joined and bag strings: a trailing "(ALIAS)" … */
  aliasForms: string[];
  /** … the name without that alias ("isopropanol" for "Isopropanol (IPA)") … */
  baseForms: string[];
  /** … and the name without a qualifier like "(35%)": ranked high, but never STRONG. */
  qualifiedForms: string[];
}

function trigrams(s: string): Map<string, number> {
  const p = `  ${s} `;
  const m = new Map<string, number>();
  for (let i = 0; i < p.length - 2; i++) {
    const g = p.slice(i, i + 3);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

const MAX_LEN = 80; // compare at most this many normalised chars; longer names are truncated for fuzzy work.

function build(s: string, withForms: boolean): Prep {
  const toks = tokens(s);
  const joined = toks.join('');
  const short = joined.slice(0, MAX_LEN);
  const prep: Prep = { toks, joined, bag: [...toks].sort().join(' '), tri: trigrams(short), triN: short.length + 1, aliasForms: [], baseForms: [], qualifiedForms: [] };
  // Only a trailing parenthetical: "Isopropanol (IPA)", never "Bis(pyridinium) bromide".
  const m = withForms ? /^(.*\S)\s+\(([^()]+)\)[\s,.]*$/u.exec(s) : null;
  if (m) {
    const forms = (x: string) => {
      const t = tokens(x);
      return t.length ? [t.join(''), [...t].sort().join(' ')] : [];
    };
    // Alias-like: has a letter, no "%" ("(PEG 8000)", "(IPA)"); otherwise a qualifier ("(35%)", "(1:10)").
    if (/\p{L}/u.test(m[2]) && !m[2].includes('%')) {
      prep.aliasForms = forms(m[2]);
      prep.baseForms = forms(m[1]);
    } else prep.qualifiedForms = forms(m[1]);
  }
  return prep;
}

const NAME_CACHE = new Map<string, Prep>();
function prepName(name: string): Prep {
  let p = NAME_CACHE.get(name);
  if (!p) {
    if (NAME_CACHE.size > 20000) NAME_CACHE.clear();
    p = build(name, true);
    NAME_CACHE.set(name, p);
  }
  return p;
}

interface Query {
  main: Prep;
  /** Alias expansions of the whole query or of a token run inside it. */
  expansions: Prep[];
}

function prepQuery(query: string): Query {
  const main = build(query, false);
  const expansions: Prep[] = [];
  const t = main.toks;
  for (let i = 0; i < t.length && expansions.length < 8; i++) {
    let key = '';
    for (let j = i; j < Math.min(t.length, i + MAX_ALIAS_RUN); j++) {
      key += t[j];
      const exps = ALIASES.get(key);
      if (!exps) continue;
      for (const e of exps) {
        expansions.push(build([...t.slice(0, i), e, ...t.slice(j + 1)].join(' '), false));
      }
    }
  }
  return { main, expansions };
}

const has = (forms: string[], q: Prep) => forms.length > 0 && (forms.includes(q.joined) || forms.includes(q.bag));

/** Rules (a)-(c) between one query form and a name; 0 if not exact (FUZZY_CAP for a qualifier-only match). */
function exactScore(q: Prep, n: Prep): number {
  if (q.joined === n.joined) return 1;
  if (q.bag === n.bag) return 0.98;
  if (has(n.aliasForms, q)) return 0.96;
  // Weaker than an alias hit, so "hydrochloric acid" vs "Hydrochloric Acid (HCL)" + "hydrochloric acid (35%)" is a choice.
  if (has(n.baseForms, q)) return 0.9;
  if (has(n.qualifiedForms, q)) return FUZZY_CAP;
  return 0;
}

/** Edit distance ≤ 1, in O(n). */
function withinOne(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1);
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

const LEV_A = new Uint16Array(MAX_LEN + 1);
const LEV_B = new Uint16Array(MAX_LEN + 1);

/** Edit distance; inputs are at most MAX_LEN chars (callers slice). */
function lev(a: string, b: string): number {
  if (a === b) return 0;
  let prev = LEV_A;
  let cur = LEV_B;
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const sub = prev[j - 1] + (ca === b.charCodeAt(j - 1) ? 0 : 1);
      const del = prev[j] + 1;
      const ins = cur[j - 1] + 1;
      cur[j] = sub < del ? (sub < ins ? sub : ins) : del < ins ? del : ins;
    }
    const t = prev;
    prev = cur;
    cur = t;
  }
  return prev[b.length];
}

function dice(a: Prep, b: Prep): number {
  let common = 0;
  const [small, big] = a.tri.size <= b.tri.size ? [a.tri, b.tri] : [b.tri, a.tri];
  for (const [g, n] of small) {
    const m = big.get(g);
    if (m) common += Math.min(n, m);
  }
  return (2 * common) / (a.triN + b.triN);
}

function tokenScore(qt: string[], nt: string[]): number {
  if (!qt.length || !nt.length) return 0;
  const used = new Set<number>();
  let sum = 0;
  let all = true;
  for (const q of qt) {
    let best = 0;
    let bestJ = -1;
    for (let j = 0; j < nt.length; j++) {
      const n = nt[j];
      const s = q === n ? 1 : q.length >= 4 && n.length >= 4 && withinOne(q, n) ? 0.85 : 0;
      if (s > best) {
        best = s;
        bestJ = j;
        if (s === 1) break;
      }
    }
    if (bestJ >= 0) used.add(bestJ);
    else all = false;
    sum += best;
  }
  const qCov = sum / qt.length;
  const nCov = used.size / nt.length;
  return all ? qCov * (0.75 + 0.2 * nCov) : qCov * 0.6 * (0.5 + 0.5 * nCov);
}

/** Similarity by spelling alone (substring, tokens, edit distance, trigrams), roughly 0..0.95. */
function fuzzy(qp: Prep, np: Prep): number {
  const q = qp.joined.slice(0, MAX_LEN);
  const n = np.joined.slice(0, MAX_LEN);
  if (!q || !n) return 0;
  let best = 0;
  const [short, long] = q.length <= n.length ? [q, n] : [n, q];
  if (long.includes(short)) {
    // Very short substrings inside words ("pa" in "phosphate") are noise unless at the start.
    best = short.length < 4 && !long.startsWith(short) ? 0.5 : 0.7 + 0.2 * (short.length / long.length);
  }
  best = Math.max(best, tokenScore(qp.toks, np.toks));
  const di = dice(qp, np);
  // Whole-string edit distance only when it can matter: lengths allow sim ≥ 0.75 and the
  // strings share trigrams (≤ 25% edits always leaves dice well above 0.2) — the cheap prefilter.
  if (long.length - short.length <= 0.25 * long.length && di >= 0.2 && best < 0.9) {
    const sim = 1 - lev(q, n) / long.length;
    if (sim >= 0.75) best = Math.max(best, sim * 0.9);
  }
  return Math.max(best, di * 0.8);
}

/** Highest score a non-identical name can get: below STRONG, so it is only ever offered. */
const FUZZY_CAP = 0.79;
/** Order-preserving squeeze of fuzzy scores into [0, FUZZY_CAP]; low scores (the WEAK/none band) are unchanged. */
function squeeze(f: number): number {
  const knee = 0.6;
  return f <= knee ? f : Math.min(FUZZY_CAP, knee + (f - knee) * ((FUZZY_CAP - knee) / 0.4));
}

function scorePrepared(q: Query, n: Prep): number {
  if (!q.main.joined || !n.joined) return 0;
  let best = exactScore(q.main, n);
  if (best >= STRONG) return best;
  for (const e of q.expansions) {
    const x = exactScore(e, n);
    if (x >= STRONG) return Math.min(x, 0.95);
    best = Math.max(best, x);
  }
  let f = fuzzy(q.main, n);
  for (const e of q.expansions) f = Math.max(f, fuzzy(e, n));
  return Math.max(best, squeeze(f));
}

/** Similarity of a query to one name, 0..1. ≥ STRONG only for the same name (see top of file). */
export function score(query: string, name: string): number {
  return scorePrepared(prepQuery(query), prepName(name));
}

function rank<T>(items: T[], getScore: (t: T) => number, limit: number): Ranked<T>[] {
  const out: Ranked<T>[] = [];
  for (const item of items) {
    const s = getScore(item);
    if (s >= 0.35) out.push({ item, score: s });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function rankByName<T>(query: string, items: T[], getName: (t: T) => string, limit = 5): Ranked<T>[] {
  const q = prepQuery(query);
  return rank(items, (t) => scorePrepared(q, prepName(getName(t))), limit);
}

function digits(s: string): string {
  return s.replace(/\D/g, '');
}

function boxScore(query: string, name: string): number {
  const q = boxKey(query);
  const k = boxKey(name);
  if (!q || !k) return 0;
  if (q === k) return 1;
  // Owner/alias in parentheses: "siddhant" → "B01-C04 (Siddhant)".
  const paren = /\(([^()]+)\)\s*$/.exec(name);
  if (paren && boxKey(paren[1]) === q) return 0.95;
  const [short, long] = q.length <= k.length ? [q, k] : [k, q];
  const at = long.indexOf(short);
  // "ccs5" must not match "ccs50": a digit run may not continue past the match.
  const cutsNumber = /\d$/.test(short) && /\d/.test(long[at + short.length] ?? '');
  if (at >= 0 && !cutsNumber) {
    const ratio = short.length / long.length;
    return at === 0 ? 0.85 + 0.1 * ratio : 0.7 + 0.15 * ratio;
  }
  const fz = score(query, name) * 0.9;
  return digits(q) === digits(k) ? fz : fz * 0.5;
}

export function resolveBoxes<T>(query: string, boxes: T[], getName: (t: T) => string, limit = 5): Ranked<T>[] {
  return rank(boxes, (b) => boxScore(query, getName(b)), limit);
}

export const STRONG = 0.8;
export const WEAK = 0.45;

export function pick<T>(
  ranked: Ranked<T>[],
): { kind: 'one'; item: T } | { kind: 'choose'; options: Ranked<T>[] } | { kind: 'none' } {
  const [top, second] = ranked;
  if (!top || top.score < WEAK) return { kind: 'none' };
  if (top.score >= STRONG && (!second || second.score < top.score - 0.15)) return { kind: 'one', item: top.item };
  return { kind: 'choose', options: ranked.filter((r) => r.score >= WEAK) };
}
