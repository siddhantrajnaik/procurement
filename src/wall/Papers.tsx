import { useEffect, useState } from 'react';

// Newest structural-biology and cryo-EM papers from Europe PMC (free, no key). It lists journal articles and
// preprints together, so bioRxiv cryo-EM work shows up as soon as it is posted.
const BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';
const TERMS = ['"cryo-EM"', '"cryo-electron"', '"cryoEM"', '"cryo-ET"', '"structural biology"'].map((t) => `TITLE:${t}`).join(' OR ');
const REFRESH_MS = 3 * 60 * 60_000;
const ROTATE_MS = 10_000;
const RETRY_MS = 5 * 60_000;
const KEEP = 15;
const VIRUS = '(TITLE:"virus" OR TITLE:"viral" OR TITLE:"capsid" OR TITLE:"spike protein") AND (TITLE:"structure" OR TITLE:"structural")';

// Bird and poultry papers are not wanted on the lab wall.
const OFF_TOPIC = /(avian|birds?|chickens?|poultry|ducks?|broilers?|geese|goose|veterinary|vet microbiol)/i;

interface Paper { id: string; title: string; authors: string; journal: string; date: string; preprint: boolean }

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const niceDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${iso}T00:00:00Z`));
const clean = (t: string) => t.replace(/<[^>]+>/g, '').replace(/\.$/, '').trim();
const firstAuthors = (s: string) => {
  const list = s.replace(/\.$/, '').split(', ').filter(Boolean);
  return list.length > 3 ? `${list.slice(0, 3).join(', ')} et al.` : list.join(', ');
};

async function search(terms: string): Promise<Record<string, string>[]> {
  const from = isoDay(new Date(Date.now() - 45 * 86_400_000));
  const to = isoDay(new Date());
  const q = `(${terms}) AND (FIRST_PDATE:[${from} TO ${to}])`;
  const url = `${BASE}?query=${encodeURIComponent(q)}&resultType=lite&sort=${encodeURIComponent('P_PDATE_D desc')}&pageSize=30&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('papers');
  const data = (await res.json()) as { resultList?: { result?: Record<string, string>[] } };
  return data.resultList?.result ?? [];
}

/** Cryo-EM / structural biology and virus-structure papers, merged. Either search may fail without losing the other. */
async function fetchPapers(): Promise<Paper[]> {
  const parts = await Promise.allSettled([search(TERMS), search(VIRUS)]);
  if (parts.every((p) => p.status === 'rejected')) throw new Error('papers');
  const seen = new Set<string>();
  const all = parts.flatMap((p) => (p.status === 'fulfilled' ? p.value : []))
    .filter((r) => (seen.has(`${r.source}:${r.id}`) ? false : (seen.add(`${r.source}:${r.id}`), true)));
  return all
    .filter((r) => r.title && !/^(correction|erratum|retraction|publisher correction)\b/i.test(r.title))
    .filter((r) => !OFF_TOPIC.test(`${r.title} ${r.journalTitle ?? ''}`))
    .map((r) => ({
      id: `${r.source}:${r.id}`,
      title: clean(r.title),
      authors: firstAuthors(r.authorString ?? ''),
      journal: r.journalTitle ?? (r.source === 'PPR' ? 'Preprint' : ''),
      date: r.firstPublicationDate ?? '',
      preprint: r.source === 'PPR',
    }))
    .sort((x, y) => y.date.localeCompare(x.date))
    .slice(0, KEEP);
}

export function Papers() {
  // Europe PMC can take 15 seconds or more to answer, so the last list is kept on the device and shown straight away.
  const [papers, setPapers] = useState<Paper[]>(() => {
    try { return JSON.parse(localStorage.getItem('mb.wall.papers') ?? '[]') as Paper[]; } catch { return []; }
  });
  const [i, setI] = useState(0);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = () => {
      fetchPapers()
        .then((p) => {
          if (live && p.length) {
            setPapers(p);
            try { localStorage.setItem('mb.wall.papers', JSON.stringify(p)); } catch { /* private mode */ }
          }
          timer = setTimeout(load, REFRESH_MS);
        })
        .catch(() => { timer = setTimeout(load, RETRY_MS); }); // service down: keep the last list, try again soon
    };
    load();
    return () => { live = false; clearTimeout(timer); };
  }, []);
  useEffect(() => {
    if (papers.length < 2) return;
    const id = setInterval(() => setI((n) => n + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [papers.length]);

  const p = papers.length ? papers[i % papers.length] : null;
  return (
    <section className="rounded-3xl bg-card border border-line !p-[1.2rem] flex flex-col gap-[0.6rem] min-w-0 min-h-0">
      <h2 className="text-[1.05rem] font-bold uppercase tracking-[0.16em] text-muted flex items-center justify-between">
        <span>New in structural biology &amp; cryo-EM</span>
        {papers.length > 1 && <span className="normal-case tracking-normal font-semibold tabular-nums">{(i % papers.length) + 1} / {papers.length}</span>}
      </h2>
      {p ? (
        <div key={p.id} className="wall-fade flex-1 min-h-0 flex flex-col justify-center gap-[0.4rem]">
          <p className="text-[1.55rem] font-bold leading-snug line-clamp-3">{p.title}</p>
          <p className="text-[1.1rem] text-muted truncate">{p.authors}</p>
          <p className="text-[1.1rem] text-muted truncate">
            {p.preprint && <span className="mr-2 rounded-full bg-accent/15 text-accent font-bold text-[0.9rem] px-[0.6rem] py-[0.05rem]">PREPRINT</span>}
            {!(p.preprint && p.journal === 'Preprint') && <span className="text-ink/80 font-semibold">{p.journal} · </span>}{p.date && niceDate(p.date)}
          </p>
        </div>
      ) : (
        <p className="text-[1.2rem] text-muted">Loading the latest papers…</p>
      )}
      {papers.length > 1 && (
        <div className="h-[0.3rem] rounded-full bg-line overflow-hidden" aria-hidden>
          <div key={i} className="wall-progress h-full bg-accent rounded-full" style={{ animationDuration: `${ROTATE_MS}ms` }} />
        </div>
      )}
    </section>
  );
}
