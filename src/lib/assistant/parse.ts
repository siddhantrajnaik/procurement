/**
 * Turns one typed or spoken command into an Intent. Pure string work: no data,
 * no matching (that is match.ts). Names and boxes come back as the raw words.
 *
 * Decisions worth knowing:
 * - "put X in BOX" is a MOVE (the thing usually already exists); "add/load/store/
 *   enter X to BOX" is an ADD. "put back X" is a RETURN, but any return verb with
 *   a destination ("put back X in BOX", "return X to BOX") is a MOVE.
 * - "show/open/list X" is a BOX lookup only when X looks like a box (or says
 *   "box X"); otherwise it is a FIND. "what's in X" / "contents of X" is always BOX.
 * - Multi-line input: filler lines ("done", "okay", "that's it") are dropped. If the
 *   first line is a bare verb/question ("took", "where is", "put back", "what is in",
 *   "move to PN01") or a complete take/restock/return/move, the lines are one command.
 *   Otherwise it is an ADD: the first line is the box if it looks like one (see isBoxish)
 *   or is an "add ... to BOX" line; every other line holds one or more items.
 */
import type { Intent, ParsedItem } from './types';

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const NUM_WORD = `(?:${[...Object.keys(UNITS), ...Object.keys(TENS), 'hundred', 'thousand'].join('|')})`;
// "and" only counts inside a number after hundred/thousand, so "tricine and sucrose" is untouched.
const NUM_RUN = new RegExp(
  `\\b(?:point[ \\t]+)?${NUM_WORD}(?:[ \\t]+${NUM_WORD}|[ \\t]+point[ \\t]+${NUM_WORD}|(?<=hundred|thousand)[ \\t]+and[ \\t]+${NUM_WORD})*\\b`,
  'gi',
);

function wordsToInt(words: string[]): string {
  const parts: string[] = [];
  let total = 0;
  let cur = 0;
  let prev: 'unit' | 'tens' | 'big' | null = null;
  const flush = () => {
    if (prev !== null) parts.push(String(total + cur));
    total = 0;
    cur = 0;
    prev = null;
  };
  for (const w of words) {
    if (w === 'and') continue;
    if (w === 'hundred') {
      cur = (cur || 1) * 100;
      prev = 'big';
    } else if (w === 'thousand') {
      total += (cur || 1) * 1000;
      cur = 0;
      prev = 'big';
    } else if (w in UNITS) {
      if (prev === 'unit') flush(); // "zero five" → "05", "one two" → "12"
      cur += UNITS[w];
      prev = 'unit';
    } else if (w in TENS) {
      if (prev === 'unit' || prev === 'tens') flush();
      cur += TENS[w];
      prev = 'tens';
    }
  }
  flush();
  return parts.join('');
}

function wordsToNumbers(s: string): string {
  return s.replace(NUM_RUN, (m) => {
    const words = m.toLowerCase().split(/[ \t]+/);
    const p = words.indexOf('point');
    if (p < 0) return wordsToInt(words);
    const decimals = words.slice(p + 1).map((w) => String(UNITS[w] ?? '')).join('');
    return `${wordsToInt(words.slice(0, p)) || '0'}.${decimals}`;
  });
}

function tidy(line: string): string {
  return line
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.?!]+$/, '')
    .trim();
}

const LEAD_FILLER =
  /^(?:please|pls|plz|kindly|hey|hi|hello|ok|okay|so|um+|uh+|can you|could you|would you|will you|can we|i've|ive|i have|we've|we have|i just|we just|i|we|just|also|now|then)\b[\s,]*/i;
const TRAIL_FILLER = /[\s,]+(?:please|pls|plz|thanks|thank you|for me|now|right now)$/i;

function stripFillers(s: string): string {
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(LEAD_FILLER, '').replace(TRAIL_FILLER, '').trim();
  }
  return s.replace(/[,;]+$/, '').trim();
}

const ARTICLE = /^(?:the|some|my|our|any|of)\s+/i;
const A_AN = /^(?:a|an)\s+/i;

function cleanName(s: string): string {
  let prev = '';
  s = s.trim().replace(/^(?:[-*•·]|\d+[.)])\s+/, '');
  while (prev !== s) {
    prev = s;
    s = s.replace(ARTICLE, '').replace(A_AN, '').trim();
  }
  return s.replace(/[,;:.]+$/, '').trim();
}

function cleanBox(s: string): string {
  return cleanName(s).replace(/^box\s+(?=\S)/i, '').replace(/^(?:number|no)\s+/i, '').trim();
}

// Spelled-out letters from speech-to-text in box names: "see see es 05" → "c c s 05".
const SPOKEN_LETTER: Record<string, string> = {
  see: 'c', sea: 'c', es: 's', ess: 's', bee: 'b', be: 'b', dee: 'd', pee: 'p', em: 'm', en: 'n',
};

/** "see see s 05" / "c c s 05" → "ccs 05": only when every word is short and a number is present. */
function spokenBox(s: string): string {
  const w = s.split(/\s+/);
  if (w.length < 2 || !w.some((x) => /^\d/.test(x))) return s;
  if (!w.every((x) => /^(?:[a-z]{1,3}|\d{1,3}|[a-z]{1,3}\d{1,3})$/i.test(x) || x.toLowerCase() in SPOKEN_LETTER)) return s;
  const letters = w.map((x) => SPOKEN_LETTER[x.toLowerCase()] ?? x);
  // Glue runs of single letters: "c c s 05" → "ccs 05".
  const out: string[] = [];
  for (const x of letters) {
    const last = out[out.length - 1];
    if (last !== undefined && /^[a-z]+$/i.test(last) && /^[a-z]$/i.test(x)) {
      out[out.length - 1] = last + x;
    } else out.push(x);
  }
  return out.join(' ');
}

/** First-line / "BOX: items" heuristic: "CC-S05", "cc s 05", "see see s 05", "B01-C04 (Siddhant)", "PN01", "MCT-CUP", "Viral Box", "anything:". */
export function isBoxish(raw: string): boolean {
  const s = raw.trim();
  if (/:$/.test(s)) return true;
  const t = spokenBox(s.replace(/^box\s+/i, ''));
  return (
    /\bbox$/i.test(t) ||
    /^[a-z]{1,4}(?:[\s-]?[a-z]{1,3})?[\s-]?\d{1,3}(?:[\s-]?[a-z]{1,3}[\s-]?\d{1,3})?(?:\s*\(.*\))?$/i.test(t) ||
    /^[A-Z]{2,5}-[A-Z0-9]{2,5}$/.test(t)
  );
}

function splitItems(s: string): string[] {
  return s
    .split(/\s*;\s*|,\s+(?:and\s+)?|\s+and\s+|\s+&\s+/i)
    .map((x) => x.trim())
    .filter(Boolean);
}

const UNIT_RE =
  'ml|mls|millilit(?:re|er)s?|µl|μl|ul|mcl|microlit(?:re|er)s?|mg|milligram(?:me)?s?|kg|kgs|kilogram(?:me)?s?|kilos?|g|gm|gms|gram(?:me)?s?|l|lt|ltr|ltrs|lit(?:re|er)s?';
const CONT_RE = 'bottles?|box(?:es)?|tubes?|vials?|packs?|packets?|jars?|cans?|containers?|bags?';

function normUnit(u: string): string {
  const l = u.toLowerCase();
  if (/^(ml|millilit)/.test(l)) return 'mL';
  if (/^(µl|μl|ul|mcl|microlit)/.test(l)) return 'µL';
  if (/^(mg|milligram)/.test(l)) return 'mg';
  if (/^(kg|kilo)/.test(l)) return 'kg';
  if (/^g/.test(l)) return 'g';
  return 'L';
}

function normContainer(c: string): string {
  const base = c.toLowerCase().replace(/(?<=box)es$|s$/, '');
  return base === 'box' ? 'boxes' : `${base}s`;
}

const LEAD_ONE = new RegExp(`^(?:a|an|1)\\s+(${CONT_RE})\\s+(?:of\\s+)?(.+)$`, 'i');
const LEAD_AMOUNT = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${UNIT_RE})(?=\\s|$)\\s*(?:of\\s+)?(.*)$`, 'i');
const LEAD_COUNT = new RegExp(`^(\\d+)\\s+(?:(${CONT_RE})\\s+(?:of\\s+)?)?(.+)$`, 'i');
const TRAIL_AMOUNT = new RegExp(`^(.+?)\\s+(\\d+(?:\\.\\d+)?)\\s*(${UNIT_RE})$`, 'i');
const TRAIL_COUNT = new RegExp(`^(.+?)\\s+(\\d+)\\s+(${CONT_RE})$`, 'i');
// "KCl x3" / "KCl x 3" (max two digits so "triton x100" stays a name), "KCl ×3", "KCl * 3".
const TRAIL_TIMES = /^(.+?)(?:\s+x\s?(\d{1,2})|\s*[×*]\s*(\d+))$/i;

export function parseItem(raw: string): ParsedItem {
  let s = raw.trim().replace(/^(?:[-*•·]|\d+[.)])\s+/, '');
  while (ARTICLE.test(s)) s = s.replace(ARTICLE, '');
  let count: number | null = null;
  let amount: number | null = null;
  let unit: string | null = null;
  let m: RegExpExecArray | null;

  if ((m = LEAD_ONE.exec(s))) {
    count = 1;
    unit = normContainer(m[1]);
    s = m[2];
  } else {
    s = s.replace(A_AN, '');
    if ((m = LEAD_AMOUNT.exec(s))) {
      amount = Number(m[1]);
      unit = normUnit(m[2]);
      s = m[3];
    } else if ((m = LEAD_COUNT.exec(s))) {
      count = Number(m[1]);
      unit = m[2] ? normContainer(m[2]) : null;
      s = m[3];
    } else if ((m = TRAIL_AMOUNT.exec(s))) {
      amount = Number(m[2]);
      unit = normUnit(m[3]);
      s = m[1];
    } else if ((m = TRAIL_COUNT.exec(s))) {
      count = Number(m[2]);
      unit = normContainer(m[3]);
      s = m[1];
    } else if ((m = TRAIL_TIMES.exec(s))) {
      count = Number(m[2] ?? m[3]);
      s = m[1];
    }
  }
  return { name: cleanName(s), count, amount, unit };
}

function parseItems(s: string): ParsedItem[] {
  return splitItems(s).map(parseItem).filter((i) => i.name || i.amount !== null);
}

function names(s: string): string[] {
  return splitItems(s).map((x) => parseItem(x).name).filter(Boolean);
}

/** Splits "X to BOX" at the LAST to/into/onto (falling back to in/inside/on). */
function splitTarget(body: string): { head: string; target: string } | null {
  const m =
    /^(?:(.*)\s)?(?:to|into|onto)\s+(.+)$/i.exec(body) ?? /^(?:(.*)\s)?(?:in|inside|on)\s+(.+)$/i.exec(body);
  return m ? { head: (m[1] ?? '').trim(), target: m[2].trim() } : null;
}

function parseMove(body: string): Intent | null {
  const t = splitTarget(body);
  if (!t) return null;
  let head = t.head;
  let to = t.target;
  let from: string | null = null;
  let m = /^(.*)\sfrom\s+(.+)$/i.exec(to); // "move X to B from A"
  if (m) {
    to = m[1];
    from = m[2];
  } else if ((m = /^(.*)\sfrom\s+(.+)$/i.exec(head))) {
    head = m[1];
    from = m[2];
  }
  const items = names(head);
  if (!items.length) return null;
  return { kind: 'move', items, from: from ? cleanBox(from) : null, to: cleanBox(to) };
}

function parseSwapSide(s: string): { item: string; box: string | null } {
  const m = /^(.*)\s(?:in|from|of)\s+(.+)$/i.exec(s);
  return m ? { item: cleanName(m[1]), box: cleanBox(m[2]) } : { item: cleanName(s), box: null };
}

const RE = {
  swap: /^(?:swap|swapped|exchange|exchanged|switch|switched|interchange)\s+(.+)$/i,
  putBack: /^(?:put|place|placed|keep|kept)\s+(.+?)\s+back(?:\s+(in|into|to|inside|onto)\s+(.+))?$/i,
  ret: /^(?:returned|return|returning|returns|put back|putting back|placed back|place back|gave back|give back|giving back|brought back|bring back|bringing back|kept back|keep back|got back)\s+(.+)$/i,
  move: /^(move|moved|moving|shift|shifted|shifting|transfer|transferred|transferring|relocate|relocated|put|place|placed|keep|kept)\s+(.+)$/i,
  add: /^(?:add|added|adding|load|loaded|loading|store|stored|storing|enter|entered|insert|inserted|log|logged|register|registered)\s+(.+)$/i,
  addAlone: /^(?:add|load|store|enter|insert|log|register|put)\s*:?$/i,
  take: /^(?:took|take|taking|takes|taken|used|use|using|uses|borrowed|borrow|borrowing|removed|remove|removing|consumed|consume|grabbed|grab|withdrew|withdraw)(?:\s+out(?:\s+of)?|\s+up)?\s+(.+)$/i,
  restock: /^(?:restocked|restock|restocking|refilled|refill|refilling|replenished|replenish|got|received|receive|bought|purchased|topped up|top up)\s+(.+)$/i,
  boxQ: /^(?:what(?:'s|s| is)?\s+(?:there\s+)?(?:in|inside)|(?:show|list|tell)\s+(?:me\s+)?(?:the\s+)?contents?\s+of|contents?\s+of|what\s+does)\s+(.+?)(?:\s+(?:have|has|contain|contains|hold|holds))?$/i,
  open: /^(?:show|open|list|view|display|check)\s+(?:me\s+)?(?:the\s+)?(box\s+)?(.+)$/i,
  find: /^(?:(?:tell|show)\s+me\s+where(?:'s|s| is| are)?|where\s+(?:can|could|do|did|does|should)\s+(?:i|we|you)\s+(?:find|keep|put|get|store)|where(?:'s|s| is| are| r)?|find(?:\s+me)?|locate|search(?:\s+for)?|look\s+(?:for|up)|lookup|looking\s+for|need|get\s+me|in\s+which\s+box\s+is|which\s+box\s+(?:has|have|contains|holds|is)|which\s+box|do\s+we\s+have(?:\s+any)?|is\s+there(?:\s+any)?|have\s+we\s+got|any)\s+(.+)$/i,
};

const FIND_TRAIL = new Set(['kept', 'stored', 'located', 'placed', 'it', 'in', 'at', 'now', 'there', 'present', 'lying', 'is', 'are']);

function find(s: string): Intent {
  // Drop trailing "kept / in / is …" words; word-wise so long inputs stay linear.
  const w = s.trim().split(/\s+/);
  let end = w.length;
  while (end > 1 && FIND_TRAIL.has(w[end - 1].toLowerCase()) && (w[end - 1].toLowerCase() !== 'it' || w[end - 2]?.toLowerCase() === 'in')) end--;
  let q = w.slice(0, end).join(' ');
  // "where is triton in cc s05": find has no box field; keep the query to the thing.
  const inBox = /^(.+?)\s+(?:in|inside)\s+(.+)$/i.exec(q);
  if (inBox && isBoxish(cleanBox(inBox[2]))) q = inBox[1];
  q = cleanName(q);
  return q ? { kind: 'find', query: q } : { kind: 'empty' };
}

function parseLine(line: string): Intent {
  let m: RegExpExecArray | null;

  if ((m = /^([^:]{1,40}):\s*(.+)$/.exec(line)) && isBoxish(m[1])) {
    return { kind: 'add', box: cleanBox(m[1]), items: parseItems(m[2]) };
  }

  if ((m = RE.swap.exec(line))) {
    const parts = /^(.+?)\s+with\s+(.+)$/i.exec(m[1]) ?? /^(.+?)\s+and\s+(.+)$/i.exec(m[1]);
    if (parts) return { kind: 'swap', a: parseSwapSide(parts[1]), b: parseSwapSide(parts[2]) };
    return find(m[1]);
  }

  if ((m = RE.putBack.exec(line))) {
    if (m[3]) return { kind: 'move', items: names(m[1]), from: null, to: cleanBox(m[3]) };
    return { kind: 'return', items: names(m[1]) };
  }
  if ((m = RE.ret.exec(line))) {
    return parseMove(m[1]) ?? { kind: 'return', items: names(m[1]) };
  }

  if ((m = RE.move.exec(line))) {
    const moved = parseMove(m[2]);
    if (moved) return moved;
    // A bare "put 3 bottles of KCl" is an add with no box; a bare "move FCV" is a lookup.
    if (/^(?:put|place|placed|keep|kept)$/i.test(m[1])) return { kind: 'add', box: null, items: parseItems(m[2]) };
    return find(m[2]);
  }

  if ((m = RE.add.exec(line))) {
    const t = splitTarget(m[1]);
    if (!t) return { kind: 'add', box: null, items: parseItems(m[1]) };
    const colon = /^([^:]+):\s*(.+)$/.exec(t.target); // "add to CC-S05: a, b"
    if (colon && !t.head) return { kind: 'add', box: cleanBox(colon[1]), items: parseItems(colon[2]) };
    return { kind: 'add', box: cleanBox(t.target), items: parseItems(t.head) };
  }

  if ((m = RE.take.exec(line))) {
    let body = m[1].replace(/\s+(?:from|out of)\s+.+$/i, '').replace(/\s+out$/i, '');
    // "use tris in cc s05": take has no box field, but keep the name clean.
    const inBox = /^(.+?)\s+(?:in|inside)\s+(.+)$/i.exec(body);
    if (inBox && isBoxish(cleanBox(inBox[2]))) body = inBox[1];
    return { kind: 'take', items: parseItems(body) };
  }

  if ((m = RE.restock.exec(line))) {
    return { kind: 'restock', items: parseItems(m[1].replace(/\s+from\s+.+$/i, '')) };
  }

  if ((m = RE.boxQ.exec(line))) return { kind: 'box', box: cleanBox(m[1]) };
  if ((m = RE.open.exec(line))) {
    if (m[1] || isBoxish(m[2]) || /^(?:the\s+)?box$/i.test(m[2])) return { kind: 'box', box: cleanBox(m[2]) };
    return find(m[2]);
  }
  if ((m = RE.find.exec(line))) return find(m[1]);

  return find(line);
}

/** Items on one dictated line, split like a single-line command: "urea and tricine" → 2 items. */
function lineItems(line: string): ParsedItem[] {
  const out: ParsedItem[] = [];
  for (const it of splitItems(line).map(parseItem)) {
    const prev = out[out.length - 1];
    // "sodium azide, 1 g": a nameless amount belongs to the item before it.
    if (!it.name && prev && prev.amount === null && prev.count === null) {
      out[out.length - 1] = { ...prev, count: it.count, amount: it.amount, unit: it.unit };
    } else if (it.name) out.push(it);
  }
  return out;
}

const FILLER_LINE = /^(?:done|ok|okay|that'?s it|thats all|that'?s all|that is it|that is all|stop|next|finish(?:ed)?|end)$/i;
const PROBE = 'zzprobe';

/** True when `first` is a bare verb/question waiting for its object: "took", "where is", "put back", "what is in". */
function isBareHead(first: string): 'list' | 'phrase' | null {
  const r = parseLine(`${first} ${PROBE}`);
  const only = (xs: string[]) => xs.length === 1 && xs[0] === PROBE;
  if (r.kind === 'find' && r.query === PROBE) return 'phrase';
  if (r.kind === 'box' && r.box === PROBE) return 'phrase';
  if ((r.kind === 'take' || r.kind === 'restock') && only(r.items.map((i) => i.name))) return 'list';
  if (r.kind === 'return' && only(r.items)) return 'list';
  return null;
}

const MOVE_VERB =
  /^(move|moved|moving|shift|shifted|shifting|transfer|transferred|transferring|relocate|relocated|return|returned|put back)\s+((?:from\s+.+?\s+)?(?:to|into|onto|in|inside)\s+.+)$/i;

function parseMultiLine(input: string[]): Intent {
  const lines = input.filter((l) => {
    const s = stripFillers(l);
    return s && !FILLER_LINE.test(s);
  });
  if (!lines.length) return { kind: 'empty' };
  if (lines.length === 1) return parseSingle(lines[0]);
  const first = stripFillers(lines[0]);
  const restLines = lines.slice(1);
  const rest = restLines.flatMap(lineItems);
  let m: RegExpExecArray | null;

  if (RE.addAlone.test(first)) return { kind: 'add', box: null, items: rest };

  // Speech broke right after the verb/question: "took⏎50 ml methanol⏎2 kcl", "where is⏎triton".
  const bare = isBareHead(first);
  if (bare === 'list') return parseLine(`${first} ${restLines.join(', ')}`);
  if (bare === 'phrase') return parseLine(`${first} ${restLines.join(' ')}`);
  // "move to pn01⏎fcv⏎pbs" → "move fcv, pbs to pn01".
  if ((m = MOVE_VERB.exec(first))) return parseLine(`${m[1]} ${restLines.join(', ')} ${m[2]}`);
  // A complete take/restock/return line followed by more items: one command.
  const firstIntent = parseLine(first);
  if (firstIntent.kind === 'take' || firstIntent.kind === 'restock') {
    return { ...firstIntent, items: [...firstIntent.items, ...rest] };
  }
  if (firstIntent.kind === 'return') return { kind: 'return', items: [...firstIntent.items, ...rest.map((i) => i.name)] };
  // (A multi-line "put X in BOX" stays an ADD below: dictating new things into a box.)
  if (firstIntent.kind === 'move' && !/^(?:put|place|placed|keep|kept)\s+(?!back\b)/i.test(first)) return { ...firstIntent, items: [...firstIntent.items, ...rest.map((i) => i.name)] };
  // A question broken mid-name: "where is the triton⏎x 100".
  if (RE.find.test(first) || RE.boxQ.test(first)) return parseLine(`${first} ${restLines.join(' ')}`);

  if ((m = RE.add.exec(first)) ?? (m = /^put\s+(?!back\b)(.+)$/i.exec(first))) {
    const t = splitTarget(m[1]);
    const head = t ? t.head : m[1];
    const items = head ? [...lineItems(head), ...rest] : rest;
    return { kind: 'add', box: t ? cleanBox(t.target) : null, items };
  }
  if ((m = /^([^:]{1,40}):\s*(.+)$/.exec(first)) && isBoxish(m[1])) {
    return { kind: 'add', box: cleanBox(m[1]), items: [...lineItems(m[2]), ...rest] };
  }
  if (isBoxish(first)) return { kind: 'add', box: cleanBox(first), items: rest };
  return { kind: 'add', box: null, items: lines.flatMap(lineItems) };
}

function parseSingle(raw: string): Intent {
  const line = stripFillers(raw);
  return line ? parseLine(line) : { kind: 'empty' };
}

/** Far longer than any real command; bounds the work on pasted junk. */
const MAX_INPUT = 10000;
// "1,000 ml" → "1000 ml": a thousands separator only (digits,3 digits), so "5,6-Carboxyfluorescein" is untouched.
const THOUSANDS = /(?<![\d,.])\d{1,3}(?:,\d{3})+(?![\d,'-])/g;

export function parse(text: string): Intent {
  const lines = (text ?? '')
    .slice(0, MAX_INPUT)
    .split(/\r?\n/)
    .map((l) => tidy(wordsToNumbers(l.replace(THOUSANDS, (n) => n.replace(/,/g, '')))))
    .filter(Boolean);
  if (!lines.length) return { kind: 'empty' };
  if (lines.length > 1) return parseMultiLine(lines);
  return parseSingle(lines[0]);
}
