import { useEffect, useState } from 'react';

// Newest structural-biology and cryo-EM papers from Europe PMC (free, no key). It lists journal articles and
// preprints together, so bioRxiv cryo-EM work shows up as soon as it is posted.
const BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';
const TERMS = ['"cryo-EM"', '"cryo-electron"', '"cryoEM"', '"cryo-ET"', '"structural biology"'].map((t) => `TITLE:${t}`).join(' OR ');
const REFRESH_MS = 3 * 60 * 60_000;
const ROTATE_MS = 10_000;
const KEEP = 12;

interface Paper { id: string; title: string; authors: string; journal: string; date: string; preprint: boolean }

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const niceDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${iso}T00:00:00Z`));
const clean = (t: string) => t.replace(/<[^>]+>/g, '').replace(/\.$/, '').trim();
const firstAuthors = (s: string) => {
  const list = s.replace(/\.$/, '').split(', ').filter(Boolean);
  return list.length > 3 ? `${list.slice(0, 3).join(', ')} et al.` : list.join(', ');
};

async function fetchPapers(): Promise<Paper[]> {
  const from = isoDay(new Date(Date.now() - 45 * 86_400_000));
  const to = isoDay(new Date());
  const q = `(${TERMS}) AND (FIRST_PDATE:[${from} TO ${to}])`;
  const url = `${BASE}?query=${encodeURIComponent(q)}&resultType=lite&sort=${encodeURIComponent('P_PDATE_D desc')}&pageSize=40&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('papers');
  const data = (await res.json()) as { resultList?: { result?: Record<string, string>[] } };
  return (data.resultList?.result ?? [])
    .filter((r) => r.title && !/^(correction|erratum|retraction|publisher correction)\b/i.test(r.title))
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
  const [papers, setPapers] = useState<Paper[]>([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    let live = true;
    const load = () => fetchPapers().then((p) => { if (live && p.length) setPapers(p); }).catch(() => { /* keep the last list */ });
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => { live = false; clearInterval(id); };
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
            <span className="text-ink/80 font-semibold">{p.journal}</span>{p.date && <> · {niceDate(p.date)}</>}
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
