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

export function Picture() {
  const [pic, setPic] = useState<Pic | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = () => {
      fetchPic()
        .then((p) => { if (live) { setPic(p); setBroken(false); timer = setTimeout(load, REFRESH_MS); } })
        .catch(() => { timer = setTimeout(load, RETRY_MS); });
    };
    load();
    return () => { live = false; clearTimeout(timer); };
  }, []);

  if (!pic || broken) return null;
  return (
    <section className="relative flex-1 min-h-[11rem] rounded-3xl overflow-hidden border border-line bg-card" aria-label="Picture of the day">
      <img src={pic.src} alt={pic.caption} onError={() => setBroken(true)} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 pt-[3rem] px-[1.2rem] pb-[1rem] bg-gradient-to-t from-black/85 via-black/55 to-transparent">
        <p className="text-[0.95rem] font-bold uppercase tracking-[0.16em] text-white/70">Picture of the day</p>
        {pic.caption && <p className="text-[1.2rem] font-semibold leading-snug text-white line-clamp-2 mt-[0.2rem]">{pic.caption}</p>}
        {pic.credit && <p className="text-[0.9rem] text-white/60 mt-[0.2rem] truncate">{pic.credit}</p>}
      </div>
    </section>
  );
}
