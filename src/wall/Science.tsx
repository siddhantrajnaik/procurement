import { useEffect, useState } from 'react';
import { FitText } from './FitText';
import { dominantColour } from './Songs';
import type { RGB } from './Songs';
import { FAMOUS } from './proteins';
import { Molecule3D } from './Molecule3D';
import { istDayNumber } from './Thought';

// Two slides that take turns, each with a turning 3D protein (Babylon.js):
//   1. the newest cryo-EM structure released in the Protein Data Bank (live from RCSB)
//   2. a famous "protein of the day" from a curated list
const SEARCH = 'https://search.rcsb.org/rcsbsearch/v2/query';
const DATA = 'https://data.rcsb.org/rest/v1/core/entry';
const poster = (id: string) => `https://cdn.rcsb.org/images/structures/pdb/${id.toLowerCase()}_assembly-1.jpeg`;
const SLIDE_MS = 25_000;
const REFRESH_MS = 3 * 60 * 60_000;
const RETRY_MS = 5 * 60_000;

interface Info { id: string; title: string; method: string; resolution: number | null; released: string }

const METHOD: Record<string, string> = {
  'ELECTRON MICROSCOPY': 'Cryo-EM',
  'X-RAY DIFFRACTION': 'X-ray',
  'SOLUTION NMR': 'NMR',
  'SOLID-STATE NMR': 'NMR',
  'ELECTRON CRYSTALLOGRAPHY': 'Electron crystallography',
  'NEUTRON DIFFRACTION': 'Neutron diffraction',
};

async function fetchInfo(id: string): Promise<Info> {
  const res = await fetch(`${DATA}/${id.toUpperCase()}`);
  if (!res.ok) throw new Error('entry');
  const d = (await res.json()) as {
    struct?: { title?: string };
    exptl?: { method?: string }[];
    rcsb_entry_info?: { resolution_combined?: number[] };
    rcsb_accession_info?: { initial_release_date?: string };
  };
  const m = d.exptl?.[0]?.method ?? '';
  return {
    id: id.toUpperCase(),
    title: (d.struct?.title ?? id).replace(/\s+/g, ' ').trim(),
    method: METHOD[m] ?? m.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    resolution: d.rcsb_entry_info?.resolution_combined?.[0] ?? null,
    released: d.rcsb_accession_info?.initial_release_date?.slice(0, 10) ?? '',
  };
}

/** The most recently released cryo-EM entry that is small enough to draw smoothly. */
async function newestCryoEm(): Promise<Info> {
  const since = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10);
  const term = (attribute: string, operator: string, value: string | number) => ({
    type: 'terminal', service: 'text', parameters: { attribute, operator, value },
  });
  const res = await fetch(SEARCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: {
        type: 'group', logical_operator: 'and',
        nodes: [
          term('exptl.method', 'exact_match', 'ELECTRON MICROSCOPY'),
          term('rcsb_entry_info.deposited_atom_count', 'less', 60000),
          term('rcsb_accession_info.initial_release_date', 'greater', since),
        ],
      },
      return_type: 'entry',
      request_options: { sort: [{ sort_by: 'rcsb_accession_info.initial_release_date', direction: 'desc' }], paginate: { start: 0, rows: 1 } },
    }),
  });
  if (!res.ok) throw new Error('search');
  const j = (await res.json()) as { result_set?: { identifier: string }[] };
  const id = j.result_set?.[0]?.identifier;
  if (!id) throw new Error('none');
  return fetchInfo(id);
}

const niceDate = (iso: string) =>
  iso ? new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${iso}T00:00:00Z`)) : '';

type Kind = 'new' | 'pod';

export function Science({ now }: { now: Date }) {
  const [newest, setNewest] = useState<Info | null>(() => {
    try { return JSON.parse(localStorage.getItem('mb.wall.newest') ?? 'null') as Info | null; } catch { return null; }
  });
  const [pod, setPod] = useState<Info | null>(null);
  const [n, setN] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [tint, setTint] = useState<RGB | null>(null);

  const famous = FAMOUS[istDayNumber(now) % FAMOUS.length];

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = () => {
      newestCryoEm()
        .then((i) => {
          if (!live) return;
          setNewest(i);
          try { localStorage.setItem('mb.wall.newest', JSON.stringify(i)); } catch { /* private mode */ }
          timer = setTimeout(load, REFRESH_MS);
        })
        .catch(() => { timer = setTimeout(load, RETRY_MS); }); // keep showing the last one
    };
    load();
    return () => { live = false; clearTimeout(timer); };
  }, []);

  useEffect(() => {
    let live = true;
    setPod(null);
    fetchInfo(famous.id).then((i) => { if (live) setPod(i); }).catch(() => { if (live) setPod({ id: famous.id, title: famous.name, method: '', resolution: null, released: '' }); });
    return () => { live = false; };
  }, [famous.id, famous.name]);

  const slides: Kind[] = [];
  if (newest) slides.push('new');
  if (pod) slides.push('pod');

  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => setN((x) => x + 1), SLIDE_MS);
    return () => clearInterval(id);
  }, [slides.length]);

  const kind: Kind | undefined = slides.length ? slides[n % slides.length] : undefined;
  const info = kind === 'new' ? newest : kind === 'pod' ? pod : null;

  // A glassy wash of the structure's main colour, like the song card had.
  useEffect(() => {
    let live = true;
    setTint(null);
    if (info) void dominantColour(poster(info.id)).then((c) => { if (live) setTint(c); });
    return () => { live = false; };
  }, [info?.id]);

  if (!kind || !info) return null;

  const glass: React.CSSProperties | undefined = tint
    ? (() => {
        const top = Math.max(...tint);
        const k = top > 190 ? 190 / top : 1;
        const mean = (tint[0] + tint[1] + tint[2]) / 3;
        const [r, g, b] = tint.map((v) => Math.max(0, Math.min(255, Math.round((mean + (v - mean) * 1.5) * k))));
        return {
          background: `linear-gradient(135deg, rgba(${r},${g},${b},0.45) 0%, rgba(${r},${g},${b},0.18) 55%, rgba(30,30,30,0.92) 100%), #1E1E1E`,
          borderColor: `rgba(${r},${g},${b},0.35)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.10), 0 0 2rem rgba(${r},${g},${b},0.10)`,
        };
      })()
    : undefined;

  const meta = [info.method, info.resolution ? `${info.resolution.toFixed(1)} Å` : '', info.id].filter(Boolean).join(' · ');
  const label = kind === 'new' ? 'Newest structure' : 'Protein of the day';

  return (
    <section
      className="rounded-3xl bg-card border border-line !p-[1rem] flex items-center gap-[1.1rem] min-w-0 min-h-0 transition-[background,border-color,box-shadow] duration-1000"
      style={glass}
      aria-label={label}
    >
      <div className="relative h-full max-h-[9.5rem] aspect-square rounded-xl bg-paper/60 border border-line/60 overflow-hidden shrink-0">
        {failed.has(info.id) ? (
          <img src={poster(info.id)} alt="" className="absolute inset-0 w-full h-full object-contain bg-white" />
        ) : (
          <Molecule3D
            key={info.id}
            id={info.id}
            className="absolute inset-0 w-full h-full"
            onFail={() => setFailed((s) => new Set(s).add(info.id))}
          />
        )}
      </div>
      <div key={kind} className="wall-fade min-w-0 flex flex-col gap-[0.3rem]">
        <p className="text-[1.05rem] font-bold uppercase tracking-[0.16em] text-muted truncate">{label}</p>
        <div className="h-[3.7rem] flex items-center">
          <FitText max={1.45} min={0.95} className="w-full font-extrabold leading-tight">{kind === 'pod' ? famous.name : info.title}</FitText>
        </div>
        <p className="text-[1.05rem] text-ink/80 truncate">{meta}</p>
        <p className="text-[1rem] text-muted leading-snug line-clamp-2">
          {kind === 'pod' ? famous.fact : `Released ${niceDate(info.released)} in the Protein Data Bank`}
        </p>
      </div>
    </section>
  );
}
