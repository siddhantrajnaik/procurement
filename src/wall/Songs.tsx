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

export function Songs({ now }: { now: Date }) {
  const [wx, setWx] = useState<{ code: number; temp: number } | null>(null);
  const [found, setFound] = useState<Found | null>(null);

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
    lookup(song).then((f) => { if (live) setFound(f); }).catch(() => { /* text only */ });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songKey]);

  return (
    <section className="rounded-3xl bg-card border border-line !p-[1rem] flex items-center gap-[1.1rem] min-w-0 min-h-0" aria-label="Song for today">
      {found?.cover ? (
        <img src={found.cover} alt="" className="h-full max-h-[9.5rem] aspect-square rounded-xl object-cover bg-paper shrink-0" />
      ) : (
        <div className="h-full max-h-[9.5rem] aspect-square rounded-xl bg-paper border border-line shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex flex-col gap-[0.3rem]">
        <p className="text-[1.05rem] font-bold uppercase tracking-[0.16em] text-muted truncate">Listen today</p>
        <p className="text-[1.6rem] font-extrabold leading-tight line-clamp-2">{song.t}</p>
        <p className="text-[1.15rem] text-ink/80 truncate">
          <span className={`mr-2 rounded-full text-[0.8rem] font-bold px-[0.5rem] py-[0.05rem] ${lang === 'hi' ? 'bg-accent/15 text-accent' : 'bg-white/10 text-ink'}`}>{lang === 'hi' ? 'HI' : 'EN'}</span>
          {song.a}
        </p>
        {found && (found.album || found.year) && (
          <p className="text-[1rem] text-muted truncate">{[found.album, found.year, found.genre].filter(Boolean).join(' · ')}</p>
        )}
        <p className="text-[1rem] text-muted/80 truncate">Picked for a {mood.label.toLowerCase()}{wx ? `, ${Math.round(wx.temp)}°C` : ''}.</p>
      </div>
    </section>
  );
}
