import { useEffect, useState } from 'react';

// A new picture every day: Wikimedia Commons "Picture of the Day" (free, no key, credit shown as the licence asks).
const FEED = 'https://api.wikimedia.org/feed/v1/wikipedia/en/featured';
const REFRESH_MS = 6 * 60 * 60_000;
const RETRY_MS = 10 * 60_000;

interface Pic { src: string; caption: string; credit: string }

const ymd = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(d).replace(/-/g, '/'); // 2026/11/18

const plain = (t: string) => t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function fetchPic(): Promise<Pic> {
  // Today's picture may not be out yet when India is ahead of UTC, so fall back to yesterday's.
  for (const back of [0, 1]) {
    const res = await fetch(`${FEED}/${ymd(new Date(Date.now() - back * 86_400_000))}`);
    if (!res.ok) continue;
    const j = (await res.json()) as {
      image?: {
        thumbnail?: { source: string };
        description?: { text?: string };
        artist?: { text?: string };
        license?: { type?: string };
      };
    };
    const i = j.image;
    if (i?.thumbnail?.source) {
      const by = i.artist?.text ? plain(i.artist.text) : '';
      return {
        src: i.thumbnail.source,
        caption: plain(i.description?.text ?? ''),
        credit: [by && `Photo: ${by}`, i.license?.type].filter(Boolean).join(' · '),
      };
    }
  }
  throw new Error('picture');
}

interface Motm { title: string; blurb: string; image: string }
const SLIDE_MS = 20_000;

/** Two slides that take turns: the daily picture and PDB-101's Molecule of the Month. */
export function Picture({ motm }: { motm: Motm | null }) {
  const [pic, setPic] = useState<Pic | null>(null);
  const [picBroken, setPicBroken] = useState(false);
  const [motmBroken, setMotmBroken] = useState(false);
  const [n, setN] = useState(0);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = () => {
      fetchPic()
        .then((p) => { if (live) { setPic(p); setPicBroken(false); timer = setTimeout(load, REFRESH_MS); } })
        .catch(() => { timer = setTimeout(load, RETRY_MS); });
    };
    load();
    return () => { live = false; clearTimeout(timer); };
  }, []);

  const slides: ('pic' | 'motm')[] = [];
  if (pic && !picBroken) slides.push('pic');
  if (motm && !motmBroken) slides.push('motm');

  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => setN((x) => x + 1), SLIDE_MS);
    return () => clearInterval(id);
  }, [slides.length]);

  if (slides.length === 0) return null;
  const which = slides[n % slides.length];

  return (
    <section className="relative flex-1 min-h-[11rem] rounded-3xl overflow-hidden border border-line bg-card" aria-label={which === 'pic' ? 'Picture of the day' : 'Molecule of the month'}>
      <div key={which} className="wall-fade absolute inset-0">
        {which === 'pic' && pic && (
          <>
            <img src={pic.src} alt={pic.caption} onError={() => setPicBroken(true)} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 pt-[3rem] px-[1.2rem] pb-[1rem] bg-gradient-to-t from-black/85 via-black/55 to-transparent">
              <p className="text-[0.95rem] font-bold uppercase tracking-[0.16em] text-white/70">Picture of the day</p>
              {pic.caption && <p className="text-[1.2rem] font-semibold leading-snug text-white line-clamp-1 mt-[0.2rem]">{pic.caption}</p>}
              {pic.credit && <p className="text-[0.9rem] text-white/60 mt-[0.2rem] truncate">{pic.credit}</p>}
            </div>
          </>
        )}
        {which === 'motm' && motm && (
          <>
            <div className="absolute inset-0 bg-white" />
            <img src={motm.image} alt={motm.title} onError={() => setMotmBroken(true)} className="absolute inset-x-0 top-0 h-[calc(100%-5.6rem)] w-full object-contain p-[0.6rem]" />
            <div className="absolute inset-x-0 bottom-0 px-[1.2rem] py-[0.8rem] bg-[#161616] border-t border-line">
              <p className="text-[0.95rem] font-bold uppercase tracking-[0.16em] text-accent">Molecule of the month</p>
              <p className="text-[1.35rem] font-bold leading-tight text-ink truncate mt-[0.1rem]">{motm.title}</p>
              {motm.blurb && <p className="text-[1.05rem] text-muted leading-snug truncate">{motm.blurb}</p>}
              <p className="sr-only">RCSB PDB-101</p>
            </div>
          </>
        )}
      </div>
      {slides.length > 1 && (
        <div className="absolute top-[0.8rem] right-[0.9rem] flex gap-[0.4rem]" aria-hidden>
          {slides.map((x) => (
            <span key={x} className={`h-[0.5rem] rounded-full ${x === which ? 'w-[1.4rem] bg-accent' : 'w-[0.5rem] bg-black/40 ring-1 ring-white/40'}`} />
          ))}
        </div>
      )}
    </section>
  );
}
