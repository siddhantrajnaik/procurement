// Plain assertion script: `node src/lib/assistant/parse.test.ts` (Node >= 22.6 strips types).
import { parse } from './parse.ts';
import { boxKey, normalize, pick, rankByName, resolveBoxes } from './match.ts';

let pass = 0;
let fail = 0;

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function check(label: string, actual: unknown, expected: unknown): void {
  if (same(actual, expected)) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL ${label}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
  }
}

function ok(label: string, cond: boolean, detail?: unknown): void {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL ${label}${detail === undefined ? '' : `\n  ${JSON.stringify(detail)}`}`);
  }
}

const I = (name: string, count: number | null = null, amount: number | null = null, unit: string | null = null) => ({
  name,
  count,
  amount,
  unit,
});
const p = (text: string, expected: unknown) => check(JSON.stringify(text), parse(text), expected);

// --- empty / find ---
p('', { kind: 'empty' });
p('   \n  ', { kind: 'empty' });
p('where is triton', { kind: 'find', query: 'triton' });
p("where's KCl?", { kind: 'find', query: 'KCl' });
p('Where is the Triton X-100 kept', { kind: 'find', query: 'Triton X-100' });
p('find sodium azide', { kind: 'find', query: 'sodium azide' });
p('locate FCV', { kind: 'find', query: 'FCV' });
p('which box has PBS', { kind: 'find', query: 'PBS' });
p('which box is PBS in', { kind: 'find', query: 'PBS' });
p('search tween', { kind: 'find', query: 'tween' });
p('search for tween eighty', { kind: 'find', query: 'tween 80' });
p('can you please find the DMSO', { kind: 'find', query: 'DMSO' });
p('do we have any sucrose', { kind: 'find', query: 'sucrose' });
p('triton', { kind: 'find', query: 'triton' });
p('5,6-Carboxyfluorescein', { kind: 'find', query: '5,6-Carboxyfluorescein' });
p('show triton', { kind: 'find', query: 'triton' });

// --- box ---
p("what's in CC-S05", { kind: 'box', box: 'CC-S05' });
p('what is in cc s05', { kind: 'box', box: 'cc s05' });
p('whats in cc s zero five', { kind: 'box', box: 'cc s 05' });
p('show box PN01', { kind: 'box', box: 'PN01' });
p('open CC-S05', { kind: 'box', box: 'CC-S05' });
p('contents of viral box', { kind: 'box', box: 'viral box' });
p('what does B01-C01 have', { kind: 'box', box: 'B01-C01' });
p('show me the viral box', { kind: 'box', box: 'viral box' });

// --- add ---
p('add silver nitrate to CC-S05', { kind: 'add', box: 'CC-S05', items: [I('silver nitrate')] });
p('add silver nitrate, trypan blue and sodium azide to CC-S05', {
  kind: 'add',
  box: 'CC-S05',
  items: [I('silver nitrate'), I('trypan blue'), I('sodium azide')],
});
p('add silver nitrate, trypan blue, and sodium azide to cc s05', {
  kind: 'add',
  box: 'cc s05',
  items: [I('silver nitrate'), I('trypan blue'), I('sodium azide')],
});
p('load 3 bottles of KCl into CC-S04', { kind: 'add', box: 'CC-S04', items: [I('KCl', 3, null, 'bottles')] });
p('add KCl', { kind: 'add', box: null, items: [I('KCl')] });
p('add two KCl to the viral box', { kind: 'add', box: 'viral box', items: [I('KCl', 2)] });
p('add 5,6-Carboxyfluorescein, N,N-Methylenebisacrylamide to CC-S05', {
  kind: 'add',
  box: 'CC-S05',
  items: [I('5,6-Carboxyfluorescein'), I('N,N-Methylenebisacrylamide')],
});
p("add N,N,N',N'-tetramethylethylenediamine and 1,4-diazabicyclo[2.2.2]octane to B01-C01", {
  kind: 'add',
  box: 'B01-C01',
  items: [I("N,N,N',N'-tetramethylethylenediamine"), I('1,4-diazabicyclo[2.2.2]octane')],
});
p('CC-S05: silver nitrate, trypan blue', {
  kind: 'add',
  box: 'CC-S05',
  items: [I('silver nitrate'), I('trypan blue')],
});
p('store a bottle of acetone in PN01', { kind: 'add', box: 'PN01', items: [I('acetone', 1, null, 'bottles')] });
p('add a KCl', { kind: 'add', box: null, items: [I('KCl')] });
p('add KCl x3 to CC-S04', { kind: 'add', box: 'CC-S04', items: [I('KCl', 3)] });
p('add KCl ×3', { kind: 'add', box: null, items: [I('KCl', 3)] });
p('add KCl * 3', { kind: 'add', box: null, items: [I('KCl', 3)] });
p('add triton x100', { kind: 'add', box: null, items: [I('triton x100')] });
p('add 10x PBS to CC-S01', { kind: 'add', box: 'CC-S01', items: [I('10x PBS')] });
p('add to CC-S05: KCl, PBS', { kind: 'add', box: 'CC-S05', items: [I('KCl'), I('PBS')] });

// multi-line add
p('CC-S05\nsilver nitrate\n5,6-Carboxyfluorescein\ntrypan blue', {
  kind: 'add',
  box: 'CC-S05',
  items: [I('silver nitrate'), I('5,6-Carboxyfluorescein'), I('trypan blue')],
});
p('Box B01-C04 (Siddhant):\n- N,N-Methylenebisacrylamide\n- 2 bottles of Tris-free base', {
  kind: 'add',
  box: 'B01-C04 (Siddhant)',
  items: [I('N,N-Methylenebisacrylamide'), I('Tris-free base', 2, null, 'bottles')],
});
p('Viral Box\nFCV\nL-proline', { kind: 'add', box: 'Viral Box', items: [I('FCV'), I('L-proline')] });
p('add silver nitrate to CC-S05\ntrypan blue\nsodium azide, 1 g', {
  kind: 'add',
  box: 'CC-S05',
  items: [I('silver nitrate'), I('trypan blue'), I('sodium azide', null, 1, 'g')],
});
p('MCT-CUP\nLB Agar', { kind: 'add', box: 'MCT-CUP', items: [I('LB Agar')] });
p('KCl\nPBS', { kind: 'add', box: null, items: [I('KCl'), I('PBS')] });

// --- move ---
p('move FCV to PN01', { kind: 'move', items: ['FCV'], from: null, to: 'PN01' });
p('move FCV from viral box to PN01', { kind: 'move', items: ['FCV'], from: 'viral box', to: 'PN01' });
p('move FCV to PN01 from the viral box', { kind: 'move', items: ['FCV'], from: 'viral box', to: 'PN01' });
p('shift tricine, sucrose and PBS from CC-S01 to CC-S02', {
  kind: 'move',
  items: ['tricine', 'sucrose', 'PBS'],
  from: 'CC-S01',
  to: 'CC-S02',
});
p('transfer KCl into CC-S04', { kind: 'move', items: ['KCl'], from: null, to: 'CC-S04' });
p('put FCV in PN01', { kind: 'move', items: ['FCV'], from: null, to: 'PN01' });
p('put trypan blue in cc s05', { kind: 'move', items: ['trypan blue'], from: null, to: 'cc s05' });
p('put back KCl in CC-S04', { kind: 'move', items: ['KCl'], from: null, to: 'CC-S04' });
p('put the KCl back in CC-S04', { kind: 'move', items: ['KCl'], from: null, to: 'CC-S04' });
p('move FCV', { kind: 'find', query: 'FCV' });

// --- swap ---
p('swap tricine in CC-S04 with sucrose in CC-S01', {
  kind: 'swap',
  a: { item: 'tricine', box: 'CC-S04' },
  b: { item: 'sucrose', box: 'CC-S01' },
});
p('swap tricine and sucrose', { kind: 'swap', a: { item: 'tricine', box: null }, b: { item: 'sucrose', box: null } });
p('exchange FCV from viral box with PBS from PN01', {
  kind: 'swap',
  a: { item: 'FCV', box: 'viral box' },
  b: { item: 'PBS', box: 'PN01' },
});

// --- take ---
p('took 50 mL methanol', { kind: 'take', items: [I('methanol', null, 50, 'mL')] });
p('took 50ml methanol', { kind: 'take', items: [I('methanol', null, 50, 'mL')] });
p('i took fifty ml methanol', { kind: 'take', items: [I('methanol', null, 50, 'mL')] });
p('take out FCV', { kind: 'take', items: [I('FCV')] });
p('took out FCV from the viral box', { kind: 'take', items: [I('FCV')] });
p('taking 2 KCl', { kind: 'take', items: [I('KCl', 2)] });
p('used 50 ml methanol', { kind: 'take', items: [I('methanol', null, 50, 'mL')] });
p('use 10 g sucrose', { kind: 'take', items: [I('sucrose', null, 10, 'g')] });
p('borrowed the PBS', { kind: 'take', items: [I('PBS')] });
p('removed one bottle of acetone', { kind: 'take', items: [I('acetone', 1, null, 'bottles')] });
p('used 200 ul DMSO', { kind: 'take', items: [I('DMSO', null, 200, 'µL')] });
p('used 200 µl DMSO and 10 mg L-proline', {
  kind: 'take',
  items: [I('DMSO', null, 200, 'µL'), I('L-proline', null, 10, 'mg')],
});
p('took 2 L-proline', { kind: 'take', items: [I('L-proline', 2)] });
p('used two hundred and fifty microlitres of triton', { kind: 'take', items: [I('triton', null, 250, 'µL')] });

// --- return ---
p('returned FCV', { kind: 'return', items: ['FCV'] });
p('return KCl', { kind: 'return', items: ['KCl'] });
p('put back KCl', { kind: 'return', items: ['KCl'] });
p('gave back the PBS', { kind: 'return', items: ['PBS'] });
p('brought back FCV and PBS', { kind: 'return', items: ['FCV', 'PBS'] });
p('put the FCV back', { kind: 'return', items: ['FCV'] });

// --- restock ---
p('restocked 2 bottles tween 80', { kind: 'restock', items: [I('tween 80', 2, null, 'bottles')] });
p('restocked two bottles of tween eighty', { kind: 'restock', items: [I('tween 80', 2, null, 'bottles')] });
p('restock methanol 1 L', { kind: 'restock', items: [I('methanol', null, 1, 'L')] });
p('got 500 g sucrose', { kind: 'restock', items: [I('sucrose', null, 500, 'g')] });
p('refill methanol', { kind: 'restock', items: [I('methanol')] });
p('received 3 boxes of tips', { kind: 'restock', items: [I('tips', 3, null, 'boxes')] });
p('received 1.5 litre DMSO', { kind: 'restock', items: [I('DMSO', null, 1.5, 'L')] });
p('got one point five litres of DMSO', { kind: 'restock', items: [I('DMSO', null, 1.5, 'L')] });
p('restock 1 kg NaCl please', { kind: 'restock', items: [I('NaCl', null, 1, 'kg')] });

// --- match: normalize / boxKey ---
check('normalize Triton X-100', normalize('Triton X-100'), 'tritonx100');
check('normalize number words', normalize('tween eighty'), 'tweeneighty');
check('normalize zero five', normalize('cc s zero five'), 'ccs05');
for (const s of ['CC-S05', 'cc s 5', 'ccs05', 'cc s05', 'CC S 05', 'cc s zero five']) check(`boxKey ${s}`, boxKey(s), 'ccs5');
for (const s of ['B01-C01', 'b 1 c 1', 'b01 c01']) check(`boxKey ${s}`, boxKey(s), 'b1c1');
check('boxKey Viral Box', boxKey('Viral Box'), 'viral');
check('boxKey box PN01', boxKey('box PN01'), 'pn1');

// --- match: rankByName ---
const NAMES = [
  'Triton X-100',
  'Triton X',
  'Ammonium hydroxide solution',
  'Ammonium hydroxide solution Sigma',
  'Ammonium hydroxide solution 500 mL',
  '5,6-Carboxyfluorescein',
  'N,N-Methylenebisacrylamide',
  '2-mercaptoethanol',
  'Isopropanol (IPA)',
  '10x PBS',
  'LB Agar',
  'Luria Bertini Agar',
  'FCV',
  'L-proline',
  'Potassium chloride',
  'Sodium phosphate monobasic',
  'Sodium phosphate dibasic dihydrate',
  'Tris-free base',
  'Trisma base',
  'DMSO',
];
const id = (s: string) => s;
const pk = (q: string) => pick(rankByName(q, NAMES, id));
const one = (q: string) => {
  const r = pk(q);
  return r.kind === 'one' ? r.item : r;
};
const chooseNames = (q: string) => {
  const r = pk(q);
  return r.kind === 'choose' ? r.options.map((o) => o.item) : r;
};

{
  const r = chooseNames('triton');
  ok('triton → choose both Tritons', Array.isArray(r) && r.includes('Triton X-100') && r.includes('Triton X'), r);
}
check('triton x100 → one', one('triton x100'), 'Triton X-100');
check('triton x 100 → one', one('triton x 100'), 'Triton X-100');
check('Triton X-100 → one', one('Triton X-100'), 'Triton X-100');
{
  const r = rankByName('ipa', NAMES, id);
  ok('ipa → Isopropanol (IPA) first', r[0]?.item === 'Isopropanol (IPA)', r);
  ok('ipa → picked or offered', pk('ipa').kind !== 'none');
}
{
  const r = rankByName('lb agar', NAMES, id);
  ok('lb agar → LB Agar first', r[0]?.item === 'LB Agar', r);
  const lu = r.find((x) => x.item === 'Luria Bertini Agar');
  ok('lb agar → LB above Luria', !lu || lu.score < r[0].score, r);
}
check('lb agar → one', one('lb agar'), 'LB Agar');
{
  const r = chooseNames('ammonium hydroxide');
  ok(
    'ammonium hydroxide → choose among 3',
    Array.isArray(r) && r.length === 3 && r.every((x) => x.startsWith('Ammonium hydroxide')),
    r,
  );
}
// Changed with the "only identical names auto-pick" rule: substring/partial matches are offered, not picked.
check('pbs → offers 10x PBS (was one)', chooseNames('pbs'), ['10x PBS']);
check('PBS → offers 10x PBS (was one)', chooseNames('PBS'), ['10x PBS']);
check('fcv → FCV', one('fcv'), 'FCV');
check('dmso → DMSO', one('dmso'), 'DMSO');
check('mercapto ethanol → 2-mercaptoethanol (alias)', one('mercapto ethanol'), '2-mercaptoethanol');
check('mercaptoethanol → 2-mercaptoethanol (alias)', one('mercaptoethanol'), '2-mercaptoethanol');
check('carboxyfluorescein → offered, 5- and 6- are different isomers (was one)', chooseNames('carboxyfluorescein'), ['5,6-Carboxyfluorescein']);
check('5 6 carboxyfluorescein (speech)', one('5 6 carboxyfluorescein'), '5,6-Carboxyfluorescein');
check('methylene bis acrylamide → offered (was one)', chooseNames('methylene bisacrylamide'), ['N,N-Methylenebisacrylamide']);
check('l proline', one('l proline'), 'L-proline');
check('potassium chloride', one('potassium chloride'), 'Potassium chloride');
check('tritn (typo) → finds tritons', rankByName('tritn', NAMES, id)[0]?.item.startsWith('Triton'), true);
{
  const r = chooseNames('sodium phosphate');
  ok('sodium phosphate → choose 2', Array.isArray(r) && r.length === 2, r);
}
check('kcl → Potassium chloride via alias (was none)', one('kcl'), 'Potassium chloride');
check('xyzzy → none', pk('xyzzy').kind, 'none');
check('rankByName limit', rankByName('a', NAMES, id, 2).length <= 2, true);

// --- match: resolveBoxes / pick ---
const BOXES = ['CC-S05', 'CC-S04', 'CC-S50', 'B01-C01', 'B01-C10', 'B02-S03', 'B04-D01', 'PN01', 'MCT-CUP', 'Viral Box', 'B01-C04 (Siddhant)'];
const box = (q: string) => {
  const r = pick(resolveBoxes(q, BOXES, id));
  return r.kind === 'one' ? r.item : r.kind;
};
check('box cc s05', box('cc s05'), 'CC-S05');
check('box cc s 05', box('cc s 05'), 'CC-S05');
check('box ccs05', box('ccs05'), 'CC-S05');
check('box cc s zero five', box('cc s zero five'), 'CC-S05');
check('box b01 c01', box('b01 c01'), 'B01-C01');
check('box b 1 c 1', box('b 1 c 1'), 'B01-C01');
check('box viral box', box('viral box'), 'Viral Box');
check('box viral', box('viral'), 'Viral Box');
check('box pn01', box('pn01'), 'PN01');
check('box pn 1', box('pn 1'), 'PN01');
check('box mct cup', box('mct cup'), 'MCT-CUP');
check('box b01 c04', box('b01 c04'), 'B01-C04 (Siddhant)');
check('box siddhant', pick(resolveBoxes('siddhant', BOXES, id)).kind === 'none', false);
ok('cc s05 does not strongly match CC-S50', (resolveBoxes('cc s05', BOXES, id).find((r) => r.item === 'CC-S50')?.score ?? 0) < 0.8);
check('box unknown', box('fridge'), 'none');
check('pick empty', pick([]), { kind: 'none' });
check('pick weak', pick([{ item: 'x', score: 0.4 }]), { kind: 'none' });
check('pick close', pick([{ item: 'a', score: 0.9 }, { item: 'b', score: 0.85 }]).kind, 'choose');
check('pick clear', pick([{ item: 'a', score: 0.9 }, { item: 'b', score: 0.6 }]), { kind: 'one', item: 'a' });

// =====================================================================
// QA regressions (adversarial run of 360 cases). Keep permanently.
// =====================================================================

// --- 1. no confident WRONG auto-picks: one letter / one word is a different compound ---
const REAL = [
  'Methanol', 'Ethyl acetate', 'Amyl acetate', 'L-cysteine', 'Methyl green', 'Sodium dodecyl sulfate', 'Ammonium sulfate',
  'Paraformaldehyde', 'Polyethylene glycol', 'Polyethylene glycol 3350', 'Polyethylene glycol 8000 (PEG 8000)',
  'Polyethylene glycol, MW 8000', 'Isopropanol (IPA)', 'Potassium chloride', 'Sodium chloride', 'Magnesium chloride',
  'Ammonium chloride', 'Sodium phosphate monobasic', 'Triton X', 'Triton X-100', 'Tween 80', 'Beta-Alanine',
  "N,N,N',N'-tetramethylethylenediamine", '2-mercaptoethanol', 'Cupric sulfate', 'Luria Bertini Broth', 'Luria Bertini Agar',
  'LB Agar', 'Trisma hydrochloride', 'Trisma base', 'Tris-free base', 'Magnesium sulfate', 'Cesium chloride', 'Acetic acid glacial',
  'Hydrochloric Acid (HCL)', 'hydrochloric acid (35%)', 'Bis(pyridinium) bromide, DPTX', '10x PBS', 'DMSO',
];
const realOne = (q: string, list = REAL) => {
  const r = pick(rankByName(q, list, id));
  return r.kind === 'one' ? r.item : r.kind;
};
const WRONG: [string, string][] = [
  ['methyl acetate', 'Ethyl acetate'], ['l-cystine', 'L-cysteine'], ['ethyl green', 'Methyl green'], ['ethanol', 'Methanol'],
  ['sodium sulfate', 'Sodium dodecyl sulfate'], ['formaldehyde', 'Paraformaldehyde'], ['ethylene glycol', 'Polyethylene glycol'],
  ['propanol', 'Isopropanol (IPA)'], ['potassium chlorate', 'Potassium chloride'], ['ammonium chlorate', 'Ammonium chloride'],
  ['magnesium chlorate', 'Magnesium chloride'], ['sodium phosphite', 'Sodium phosphate monobasic'], ['triton x 114', 'Triton X'],
  ['tween 20', 'Tween 80'], ['peg 4000', 'Polyethylene glycol'], ['ammonium persulfate', 'Ammonium sulfate'],
  ['beta alanine methyl ester', 'Beta-Alanine'], ['2x pbs', '10x PBS'], ['pyridinium', 'Bis(pyridinium) bromide, DPTX'],
];
for (const [q, wrong] of WRONG) {
  // Full list, and narrowed to just the look-alike (as when a box scopes the list).
  ok(`no wrong auto-pick: ${q} ↛ ${wrong}`, realOne(q) !== wrong, rankByName(q, REAL, id).slice(0, 2));
  ok(`no wrong auto-pick (scoped): ${q} ↛ ${wrong}`, realOne(q, [wrong]) !== wrong);
  ok(`look-alike still offered: ${q} → ${wrong}`, rankByName(q, [wrong], id)[0]?.score >= 0.45 || /2x pbs|pyridinium|persulfate/.test(q));
}
ok('look-alike ranked below STRONG', rankByName('ethanol', ['Methanol'], id)[0].score < 0.8);
// Must still auto-pick (identical names).
for (const [q, want] of [
  ['triton x100', 'Triton X-100'], ['triton x 100', 'Triton X-100'], ['lb agar', 'LB Agar'], ['ipa', 'Isopropanol (IPA)'],
  ['isopropanol', 'Isopropanol (IPA)'], ['10x pbs', '10x PBS'], ['dmso', 'DMSO'], ['magnesium sulphate', 'Magnesium sulfate'],
  ['caesium chloride', 'Cesium chloride'], ['glacial acetic acid', 'Acetic acid glacial'], ['hcl', 'Hydrochloric Acid (HCL)'],
  ['peg 8000', 'Polyethylene glycol 8000 (PEG 8000)'],
] as const) check(`auto-pick ${q}`, realOne(q), want);
{
  const r = pick(rankByName('triton', REAL, id));
  ok('triton → choose (Triton X / Triton X-100)', r.kind === 'choose' && r.options.length >= 2, r);
  ok('triton → closest first', rankByName('triton', REAL, id)[0].item === 'Triton X');
  ok('hydrochloric acid → choose, (35%) is not an alias', pick(rankByName('hydrochloric acid', REAL, id)).kind === 'choose');
}

// --- 2. alias table (rule d) ---
for (const [q, want] of [
  ['kcl', 'Potassium chloride'], ['nacl', 'Sodium chloride'], ['sds', 'Sodium dodecyl sulfate'], ['pfa', 'Paraformaldehyde'],
  ['temed', "N,N,N',N'-tetramethylethylenediamine"], ['bme', '2-mercaptoethanol'], ['b-me', '2-mercaptoethanol'],
  ['beta mercaptoethanol', '2-mercaptoethanol'], ['β-mercaptoethanol', '2-mercaptoethanol'], ['peg', 'Polyethylene glycol'],
  ['peg 3350', 'Polyethylene glycol 3350'], ['copper sulphate', 'Cupric sulfate'], ['lb broth', 'Luria Bertini Broth'],
  ['tris hcl', 'Trisma hydrochloride'], ['isopropyl alcohol', 'Isopropanol (IPA)'], ['meoh', 'Methanol'],
] as const) check(`alias ${q}`, realOne(q), want);
check('alias etoh: no ethanol row → never Methanol', realOne('etoh') === 'Methanol', false);
ok('alias tris → offered, not auto (no exact "tris base")', pick(rankByName('tris', REAL, id)).kind !== 'one');
ok('alias lb broth does not steal lb agar', realOne('lb agar') === 'LB Agar');

// --- 3. multi-line: speech broke after the verb/question ---
p('took\n50 ml methanol\n2 kcl', { kind: 'take', items: [I('methanol', null, 50, 'mL'), I('kcl', 2)] });
p('where is\ntriton', { kind: 'find', query: 'triton' });
p('move to pn01\nfcv\npbs', { kind: 'move', items: ['fcv', 'pbs'], from: null, to: 'pn01' });
p('move from viral box to pn01\nfcv', { kind: 'move', items: ['fcv'], from: 'viral box', to: 'pn01' });
p('put back\nfcv\npbs', { kind: 'return', items: ['fcv', 'pbs'] });
p('restocked\n2 bottles tween 80', { kind: 'restock', items: [I('tween 80', 2, null, 'bottles')] });
p('what is in\ncc s05', { kind: 'box', box: 'cc s05' });
p('took 50 ml methanol\n2 kcl', { kind: 'take', items: [I('methanol', null, 50, 'mL'), I('kcl', 2)] });
p('where is the triton\nx 100', { kind: 'find', query: 'triton x 100' });
p('cc s05\nurea\ntricine\ndone', { kind: 'add', box: 'cc s05', items: [I('urea'), I('tricine')] });
p("cc s05\nurea\nthat's it", { kind: 'add', box: 'cc s05', items: [I('urea')] });
p('cc s05\nurea\nokay', { kind: 'add', box: 'cc s05', items: [I('urea')] });
p('cc s05\nurea and tricine', { kind: 'add', box: 'cc s05', items: [I('urea'), I('tricine')] });
p('cc s05\nurea, tricine, sucrose', { kind: 'add', box: 'cc s05', items: [I('urea'), I('tricine'), I('sucrose')] });
p('put in cc s05\nurea', { kind: 'add', box: 'cc s05', items: [I('urea')] });
p('urea\ndone', { kind: 'find', query: 'urea' });

// --- 4. spoken box letters ---
p('see see s 05\nurea\ntricine', { kind: 'add', box: 'see see s 05', items: [I('urea'), I('tricine')] });
p('c c s 05\nurea', { kind: 'add', box: 'c c s 05', items: [I('urea')] });
for (const s of ['see see s 05', 'c c s 05', 'see see es five', 'sea see ess 5']) check(`boxKey ${s}`, boxKey(s), 'ccs5');
check('boxKey viral box untouched', boxKey('the viral box'), 'viral');
check('boxKey bee one dee one', boxKey('bee one dee one'), 'b1d1');
const REAL_BOXES = ['CC-S05', 'CC-S01', 'CC-S10', 'B01-C04 (Siddhant)', 'B01-C05 (Sudipto)', 'B01-D01', 'Viral Box', 'PN01', 'MCT-CUP'];
const rbox = (q: string) => {
  const r = pick(resolveBoxes(q, REAL_BOXES, id));
  return r.kind === 'one' ? r.item : r.kind;
};
check('box see see s five', rbox('see see s five'), 'CC-S05');
check('box see see es 05', rbox('see see es 05'), 'CC-S05');
check('box c c s 05', rbox('c c s 05'), 'CC-S05');
check('box the viral box', rbox('the viral box'), 'Viral Box');
check('box siddhant', rbox('siddhant'), 'B01-C04 (Siddhant)');
check('box sudipto box', rbox('sudipto box'), 'B01-C05 (Sudipto)');
check('box bee one dee one', rbox('bee one dee one'), 'B01-D01');

// --- 5. find filler ---
p('where can i find sds', { kind: 'find', query: 'sds' });
p('where do we keep the dmso', { kind: 'find', query: 'dmso' });
p('can you tell me where triton is', { kind: 'find', query: 'triton' });
p('do we have triton', { kind: 'find', query: 'triton' });
p('is there any kcl', { kind: 'find', query: 'kcl' });
p('where is triton in cc s05', { kind: 'find', query: 'triton' });

// --- 6. amounts ---
p('took point five litre methanol', { kind: 'take', items: [I('methanol', null, 0.5, 'L')] });
p('took 1,000 ml methanol', { kind: 'take', items: [I('methanol', null, 1000, 'mL')] });
p('find 1,4-diazabicyclo[2.2.2]octane', { kind: 'find', query: '1,4-diazabicyclo[2.2.2]octane' });

// --- lower priority verbs ---
p('use up the methanol', { kind: 'take', items: [I('methanol')] });
p('use tris in cc s05', { kind: 'take', items: [I('tris')] });
p('put triton on cc s05', { kind: 'move', items: ['triton'], from: null, to: 'cc s05' });

// --- 7. performance ---
{
  const t = performance.now();
  parse('where is ' + 'kept '.repeat(3000) + 'x');
  parse('x' + ' in'.repeat(5000));
  const ms = performance.now() - t;
  ok(`trailing-word strip is linear (${ms.toFixed(1)} ms)`, ms < 100);
}
{
  const rows = Array.from({ length: 190 }, (_, i) => `${REAL[i % REAL.length]}${i >= REAL.length ? ` ${i}` : ''}`);
  const qs = ['triton', 'methanol', 'kcl', 'sodium sulfate', 'peg 8000', 'tritan x 100', 'glacial acetic acid', 'ethanol'];
  for (const q of qs) rankByName(q, rows, id); // warm the per-name cache
  const t = performance.now();
  for (let k = 0; k < 20; k++) for (const q of qs) rankByName(q, rows, id);
  const per = (performance.now() - t) / (20 * qs.length);
  ok(`rankByName 190 rows < 1.5 ms (${per.toFixed(3)} ms)`, per < 1.5);
}

console.log(`\n${pass} passed, ${fail} failed (${pass + fail} total)`);
if (fail) process.exit(1);
