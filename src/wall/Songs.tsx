import { useEffect, useState } from 'react';
import { istDayNumber } from './Thought';

// One song a day to match the weather, English on one day and Hindi the next. The cover, album and year come from
// Apple's free iTunes Search (no key); the picks themselves are the lists below.
const WEATHER = 'https://api.open-meteo.com/v1/forecast?latitude=28.545&longitude=77.192&current=temperature_2m,weather_code&timezone=Asia%2FKolkata';
const REFRESH_MS = 30 * 60_000;

type Song = { t: string; a: string };
interface Mood { label: string; en: Song[]; hi: Song[] }

const MOODS: Record<string, Mood> = {
  rain: {
    label: 'Rainy day',
    en: [
      { t: 'Riders on the Storm', a: 'The Doors' },
      { t: 'Here Comes the Rain Again', a: 'Eurythmics' },
      { t: 'Set Fire to the Rain', a: 'Adele' },
      { t: "Raindrops Keep Fallin' on My Head", a: 'B.J. Thomas' },
    ],
    hi: [
      { t: 'Rimjhim Gire Sawan', a: 'Kishore Kumar' },
      { t: 'Barso Re', a: 'Shreya Ghoshal' },
      { t: 'Tip Tip Barsa Paani', a: 'Udit Narayan, Alka Yagnik' },
      { t: 'Bheegi Bheegi Raaton Mein', a: 'Adnan Sami' },
    ],
  },
  hot: {
    label: 'Hot day',
    en: [
      { t: 'Summer Breeze', a: 'Seals & Crofts' },
      { t: 'Walking on Sunshine', a: 'Katrina and the Waves' },
      { t: 'Hot Fun in the Summertime', a: 'Sly & the Family Stone' },
      { t: "I'm Yours", a: 'Jason Mraz' },
    ],
    hi: [
      { t: 'Senorita', a: 'Zindagi Na Milegi Dobara' },
      { t: 'Gallan Goodiyaan', a: 'Dil Dhadakne Do' },
      { t: 'Ilahi', a: 'Arijit Singh' },
      { t: 'Dil Chahta Hai', a: 'Shankar Mahadevan' },
    ],
  },
  cool: {
    label: 'Cool day',
    en: [
      { t: "California Dreamin'", a: 'The Mamas & the Papas' },
      { t: 'Fix You', a: 'Coldplay' },
      { t: 'Dreams', a: 'Fleetwood Mac' },
      { t: 'Better Together', a: 'Jack Johnson' },
    ],
    hi: [
      { t: 'Tum Se Hi', a: 'Mohit Chauhan' },
      { t: 'Kun Faya Kun', a: 'A. R. Rahman' },
      { t: 'Agar Tum Saath Ho', a: 'Arijit Singh, Alka Yagnik' },
      { t: 'Tum Ho', a: 'Mohit Chauhan' },
    ],
  },
  fog: {
    label: 'Foggy day',
    en: [
      { t: 'Fade Into You', a: 'Mazzy Star' },
      { t: 'Mad World', a: 'Gary Jules' },
      { t: 'Put Your Records On', a: 'Corinne Bailey Rae' },
      { t: 'Sweet Disposition', a: 'The Temper Trap' },
    ],
    hi: [
      { t: 'Phir Le Aaya Dil', a: 'Arijit Singh' },
      { t: 'Tere Bina', a: 'A. R. Rahman' },
      { t: 'Raabta', a: 'Arijit Singh' },
      { t: 'Kabira', a: 'Tochi Raina, Rekha Bhardwaj' },
    ],
  },
  morning: {
    label: 'Bright morning',
    en: [
      { t: 'Here Comes the Sun', a: 'The Beatles' },
      { t: 'Good Day Sunshine', a: 'The Beatles' },
      { t: 'Three Little Birds', a: 'Bob Marley' },
      { t: 'Banana Pancakes', a: 'Jack Johnson' },
    ],
    hi: [
      { t: 'Pehla Nasha', a: 'Udit Narayan, Sadhana Sargam' },
      { t: 'Zindagi Ek Safar Hai Suhana', a: 'Kishore Kumar' },
      { t: 'Kar Har Maidan Fateh', a: 'Sukhwinder Singh, Shreya Ghoshal' },
      { t: 'Kho Gaye Hum Kahan', a: 'Jasleen Royal, Prateek Kuhad' },
    ],
  },
  evening: {
    label: 'Golden evening',
    en: [
      { t: 'Golden Hour', a: 'JVKE' },
      { t: 'Sunset Lover', a: 'Petit Biscuit' },
      { t: 'Waiting on the World to Change', a: 'John Mayer' },
      { t: 'Better Together', a: 'Jack Johnson' },
    ],
    hi: [
      { t: 'Tum Hi Ho', a: 'Arijit Singh' },
      { t: 'Channa Mereya', a: 'Arijit Singh' },
      { t: 'Raataan Lambiyan', a: 'Jubin Nautiyal' },
      { t: 'Kabira', a: 'Tochi Raina, Rekha Bhardwaj' },
    ],
  },
  easy: {
    label: 'Easy day',
    en: [
      { t: 'Put Your Records On', a: 'Corinne Bailey Rae' },
      { t: 'Banana Pancakes', a: 'Jack Johnson' },
      { t: "I'm Yours", a: 'Jason Mraz' },
      { t: 'Sweet Disposition', a: 'The Temper Trap' },
    ],
    hi: [
      { t: 'Kho Gaye Hum Kahan', a: 'Jasleen Royal, Prateek Kuhad' },
      { t: 'Ilahi', a: 'Arijit Singh' },
      { t: 'Raataan Lambiyan', a: 'Jubin Nautiyal' },
      { t: 'Tera Ban Jaunga', a: 'Akhil Sachdeva' },
    ],
  },
};

const istHour = (d: Date) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(d));

function pickMood(code: number, temp: number, hour: number): string {
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (temp >= 34) return 'hot';
  if (temp <= 15) return 'cool';
  if (code <= 2) return hour < 12 ? 'morning' : hour >= 16 ? 'evening' : 'easy';
  return 'easy';
}

interface Found { cover: string; album: string; year: string; genre: string }
const ITUNES = 'https://itunes.apple.com/search';

/** Cover art, album and year for a song, remembered on the device so it is only looked up once. */
async function lookup(song: Song): Promise<Found | null> {
  const key = `mb.wall.song.${song.t}|${song.a}`;
  try {
    const hit = localStorage.getItem(key);
    if (hit) return JSON.parse(hit) as Found;
  } catch { /* look it up */ }
  const url = `${ITUNES}?term=${encodeURIComponent(`${song.t} ${song.a}`)}&entity=song&limit=8&country=IN`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = (await res.json()) as { results?: { trackName: string; collectionName?: string; releaseDate?: string; primaryGenreName?: string; artworkUrl100?: string }[] };
  const want = song.t.toLowerCase();
  const rows = (j.results ?? []).filter((r) => r.artworkUrl100);
  const best =
    rows.find((r) => r.trackName.toLowerCase().startsWith(want) && !/remix|live|karaoke|cover/i.test(r.trackName)) ??
    rows.find((r) => r.trackName.toLowerCase().startsWith(want)) ??
    rows[0];
  if (!best) return null;
  const found: Found = {
    cover: (best.artworkUrl100 ?? '').replace('100x100bb', '600x600bb'),
    album: (best.collectionName ?? '').replace(/\s*\((Original Motion Picture Soundtrack|Remastered|Deluxe.*|\d{4} Mix)\)/i, '').trim(),
    year: best.releaseDate?.slice(0, 4) ?? '',
    genre: best.primaryGenreName ?? '',
  };
  try { localStorage.setItem(key, JSON.stringify(found)); } catch { /* private mode */ }
  return found;
}

type RGB = [number, number, number];

/** The cover's main colour: the most vivid, mid-bright pixels, averaged. Null if the image cannot be read. */
function dominantColour(url: string): Promise<RGB | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 32;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, 32, 32);
        const px = ctx.getImageData(0, 0, 32, 32).data;
        let r = 0, g = 0, b = 0, wsum = 0, ar = 0, ag = 0, ab = 0;
        for (let i = 0; i < px.length; i += 4) {
          const R = px[i], G = px[i + 1], B = px[i + 2];
          ar += R; ag += G; ab += B;
          const max = Math.max(R, G, B), min = Math.min(R, G, B);
          const v = max / 255, sat = max === 0 ? 0 : (max - min) / max;
          if (v < 0.18) continue;
          const w = sat * sat * (0.4 + v);
          r += R * w; g += G * w; b += B * w; wsum += w;
        }
        const n = px.length / 4;
        resolve(wsum > 1 ? [r / wsum, g / wsum, b / wsum] : [ar / n, ag / n, ab / n]);
      } catch {
        resolve(null); // the picture would not let us read it: keep the plain card
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

interface ChartEntry {
  'im:name': { label: string };
  'im:artist': { label: string };
  'im:image': { label: string }[];
  'im:collection'?: { 'im:name': { label: string } };
  'im:releaseDate'?: { label: string };
  category?: { attributes?: { label?: string } };
}
interface Trend { song: Song; found: Found; country: 'in' | 'us' }
const NOT_A_SONG = /ringtone|remix|theme|score|karaoke|instrumental|soundtrack|lofi|slowed|sped|\[(tamil|telugu|malayalam|kannada|bengali|marathi|gujarati)\]/i;

/** One song from Apple's top-songs chart (India or the US, taking turns), kept for the day on the device. */
async function fetchTrend(day: number): Promise<Trend | null> {
  const key = `mb.wall.trend.${day}`;
  try {
    const hit = localStorage.getItem(key);
    if (hit) return JSON.parse(hit) as Trend;
  } catch { /* fetch it */ }
  const country: 'in' | 'us' = day % 2 === 0 ? 'us' : 'in';
  const res = await fetch(`https://itunes.apple.com/${country}/rss/topsongs/limit=40/json`);
  if (!res.ok) return null;
  const j = (await res.json()) as { feed?: { entry?: ChartEntry[] } };
  const list = (j.feed?.entry ?? []).filter((e) => !NOT_A_SONG.test(e['im:name'].label));
  if (!list.length) return null;
  const e = list[Math.floor(day / 3) % list.length];
  const trend: Trend = {
    country,
    song: { t: e['im:name'].label.replace(/\s*[([].*$/, '').trim(), a: e['im:artist'].label },
    found: {
      cover: (e['im:image'].at(-1)?.label ?? '').replace(/\d+x\d+bb/, '600x600bb'),
      album: (e['im:collection']?.['im:name'].label ?? '').replace(/\s+-\s+(Single|EP)$/i, ''),
      year: e['im:releaseDate']?.label.slice(0, 4) ?? '',
      genre: e.category?.attributes?.label ?? '',
    },
  };
  try { localStorage.setItem(key, JSON.stringify(trend)); } catch { /* private mode */ }
  return trend;
}

export function Songs({ now }: { now: Date }) {
  const [wx, setWx] = useState<{ code: number; temp: number } | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [tint, setTint] = useState<RGB | null>(null);
  const [trend, setTrend] = useState<Trend | null>(null);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = () => {
      fetch(WEATHER)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('weather'))))
        .then((j: { current?: { temperature_2m: number; weather_code: number } }) => {
          if (live && j.current) setWx({ code: j.current.weather_code, temp: j.current.temperature_2m });
          timer = setTimeout(load, REFRESH_MS);
        })
        .catch(() => { timer = setTimeout(load, 5 * 60_000); });
    };
    load();
    return () => { live = false; clearTimeout(timer); };
  }, []);

  const mood = MOODS[wx ? pickMood(wx.code, wx.temp, istHour(now)) : 'easy'];
  const day = istDayNumber(now);
  const lang = day % 2 === 0 ? 'en' : 'hi';
  const list = mood[lang];
  const song = list[Math.floor(day / 2) % list.length];
  const songKey = `${song.t}|${song.a}`;

  useEffect(() => {
    let live = true;
    setFound(null);
    lookup(song)
      .then((f) => { if (live) setFound(f); })
      .catch(() => { /* text only */ });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songKey]);

  // Every third day the song comes from the charts instead of the weather list.
  const trendDay = day % 3 === 2;
  useEffect(() => {
    if (!trendDay) { setTrend(null); return; }
    let live = true;
    fetchTrend(day).then((t) => { if (live) setTrend(t); }).catch(() => { /* keep the weather pick */ });
    return () => { live = false; };
  }, [day, trendDay]);
  const trending = trendDay ? trend : null;
  const shownSong = trending ? trending.song : song;
  const shownFound = trending ? trending.found : found;

  useEffect(() => {
    let live = true;
    setTint(null);
    if (shownFound?.cover) void dominantColour(shownFound.cover).then((c) => { if (live) setTint(c); });
    return () => { live = false; };
  }, [shownFound?.cover]);

  // A glassy wash of the cover's colour over the dark card: stronger in one corner, fading to the card's own dark.
  const glass: React.CSSProperties | undefined = tint
    ? (() => {
        const top = Math.max(...tint);
        const k = top > 190 ? 190 / top : 1; // keep it from going pastel so white text stays readable
        const mean = (tint[0] + tint[1] + tint[2]) / 3;
        // push the colour a little further from grey so a washed-out cover still gives a visible tint
        const [r, g, b] = tint.map((v) => Math.max(0, Math.min(255, Math.round((mean + (v - mean) * 1.5) * k))));
        return {
          background: `linear-gradient(135deg, rgba(${r},${g},${b},0.55) 0%, rgba(${r},${g},${b},0.22) 55%, rgba(30,30,30,0.92) 100%), #1E1E1E`,
          borderColor: `rgba(${r},${g},${b},0.35)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.10), 0 0 2rem rgba(${r},${g},${b},0.10)`,
        };
      })()
    : undefined;

  return (
    <section
      className="rounded-3xl bg-card border border-line !p-[1rem] flex items-center gap-[1.1rem] min-w-0 min-h-0 transition-[background,border-color,box-shadow] duration-1000"
      style={glass}
      aria-label="Song for today"
    >
      {shownFound?.cover ? (
        <img src={shownFound.cover} alt="" className="h-full max-h-[9.5rem] aspect-square rounded-xl object-cover bg-paper shrink-0" />
      ) : (
        <div className="h-full max-h-[9.5rem] aspect-square rounded-xl bg-paper border border-line shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex flex-col gap-[0.3rem]">
        <p className="text-[1.05rem] font-bold uppercase tracking-[0.16em] text-muted truncate">Today's song</p>
        <p className="text-[1.6rem] font-extrabold leading-tight line-clamp-2">{shownSong.t}</p>
        <p className="text-[1.15rem] text-ink/80 truncate">
          <span className={`mr-2 rounded-full text-[0.8rem] font-bold px-[0.5rem] py-[0.05rem] ${trending || lang === 'hi' ? 'bg-accent/15 text-accent' : 'bg-white/10 text-ink'}`}>{trending ? 'TRENDING' : lang === 'hi' ? 'HI' : 'EN'}</span>
          {shownSong.a}
        </p>
        {shownFound && (shownFound.album || shownFound.year) && (
          <p className="text-[1rem] text-muted truncate">{[shownFound.album, shownFound.year, shownFound.genre].filter(Boolean).join(' · ')}</p>
        )}
        <p className="text-[1rem] text-muted/80 truncate">
          {trending ? `Trending in ${trending.country === 'in' ? 'India' : 'the US'} today` : `For a ${mood.label.toLowerCase()}${wx ? ` · ${Math.round(wx.temp)}°C` : ''}`}
        </p>
      </div>
    </section>
  );
}
