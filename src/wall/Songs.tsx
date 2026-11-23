import { useEffect, useState } from 'react';
import { istDayNumber } from './Thought';
import { SONG_BANK } from './songBank';

// One song a day to match the weather, English on one day and Hindi the next. The cover, album and year come from
// Apple's free iTunes Search (no key); the picks themselves are the lists below.
const WEATHER = 'https://api.open-meteo.com/v1/forecast?latitude=28.545&longitude=77.192&current=temperature_2m,weather_code&timezone=Asia%2FKolkata';
const REFRESH_MS = 30 * 60_000;

type Song = { t: string; a: string; alb?: string };
interface Mood { label: string; en: Song[]; hi: Song[] }

// The lab's taste, not the charts: classic and 90s American rock for the English songs, and old Hindi (Kishore Kumar,
// the 70s and the 90s) for the Hindi ones. English most days, Hindi one day in three. `alb` is the album or film,
// used only to find the right cover.
const MOODS: Record<string, Mood> = {
  rain: {
    label: 'Rainy day',
    en: [
      { t: 'Riders on the Storm', a: 'The Doors', alb: 'L.A. Woman' },
      { t: 'Have You Ever Seen the Rain?', a: 'Creedence Clearwater Revival', alb: 'Pendulum' },
      { t: "Who'll Stop the Rain", a: 'Creedence Clearwater Revival', alb: "Cosmo's Factory" },
      { t: 'November Rain', a: "Guns N' Roses", alb: 'Use Your Illusion I' },
      { t: 'Purple Rain', a: 'Prince', alb: 'Purple Rain' },
      { t: 'Fire and Rain', a: 'James Taylor', alb: 'Sweet Baby James' },
      { t: 'Rain King', a: 'Counting Crows', alb: 'August and Everything After' },
    ],
    hi: [
      { t: 'Rimjhim Gire Sawan', a: 'Kishore Kumar', alb: 'Manzil' },
      { t: 'Ek Ladki Bheegi Bhaagi Si', a: 'Kishore Kumar', alb: 'Chalti Ka Naam Gaadi' },
      { t: 'Aaj Rapat Jaayen To', a: 'Kishore Kumar', alb: 'Namak Halaal' },
      { t: 'Pyar Hua Ikrar Hua', a: 'Manna Dey, Lata Mangeshkar', alb: 'Shree 420' },
      { t: 'Tip Tip Barsa Paani', a: 'Udit Narayan, Alka Yagnik', alb: 'Mohra' },
    ],
  },
  hot: {
    label: 'Hot day',
    en: [
      { t: 'Summer in the City', a: "The Lovin' Spoonful", alb: "Hums of the Lovin' Spoonful" },
      { t: 'Hot Fun in the Summertime', a: 'Sly & The Family Stone', alb: 'Greatest Hits' },
      { t: 'Hotel California', a: 'Eagles', alb: 'Hotel California' },
      { t: "Surfin' U.S.A.", a: 'The Beach Boys', alb: "Surfin' U.S.A." },
      { t: 'Smooth', a: 'Santana, Rob Thomas', alb: 'Supernatural' },
      { t: 'Californication', a: 'Red Hot Chili Peppers', alb: 'Californication' },
      { t: 'Santeria', a: 'Sublime', alb: 'Sublime' },
    ],
    hi: [
      { t: 'Mere Sapno Ki Rani', a: 'Kishore Kumar', alb: 'Aradhana' },
      { t: 'Roop Tera Mastana', a: 'Kishore Kumar', alb: 'Aradhana' },
      { t: 'Pal Pal Dil Ke Paas', a: 'Kishore Kumar', alb: 'Blackmail' },
      { t: 'Zindagi Ek Safar Hai Suhana', a: 'Kishore Kumar', alb: 'Andaz' },
      { t: 'Chhookar Mere Man Ko', a: 'Kishore Kumar', alb: 'Yaarana' },
    ],
  },
  cool: {
    label: 'Cool day',
    en: [
      { t: "California Dreamin'", a: 'The Mamas & The Papas', alb: 'If You Can Believe Your Eyes and Ears' },
      { t: 'Landslide', a: 'Fleetwood Mac', alb: 'Fleetwood Mac' },
      { t: 'Simple Man', a: 'Lynyrd Skynyrd', alb: 'Pronounced' },
      { t: 'Peaceful Easy Feeling', a: 'Eagles', alb: 'Eagles' },
      { t: "Free Fallin'", a: 'Tom Petty', alb: 'Full Moon Fever' },
      { t: 'Time in a Bottle', a: 'Jim Croce', alb: "You Don't Mess Around with Jim" },
      { t: 'Fast Car', a: 'Tracy Chapman', alb: 'Tracy Chapman' },
    ],
    hi: [
      { t: 'Chingari Koi Bhadke', a: 'Kishore Kumar', alb: 'Amar Prem' },
      { t: 'Tere Bina Zindagi Se Koi', a: 'Kishore Kumar, Lata Mangeshkar', alb: 'Aandhi' },
      { t: 'Mere Naina Sawan Bhadon', a: 'Kishore Kumar', alb: 'Mehbooba' },
      { t: 'Tujhe Dekha To Yeh Jaana Sanam', a: 'Kumar Sanu, Lata Mangeshkar', alb: 'Dilwale Dulhania Le Jayenge' },
      { t: 'Kabhi Kabhi Mere Dil Mein', a: 'Mukesh', alb: 'Kabhi Kabhie' },
    ],
  },
  fog: {
    label: 'Foggy day',
    en: [
      { t: 'Fade Into You', a: 'Mazzy Star', alb: 'So Tonight That I Might See' },
      { t: 'Losing My Religion', a: 'R.E.M.', alb: 'Out of Time' },
      { t: 'Black', a: 'Pearl Jam', alb: 'Ten' },
      { t: 'The Sound of Silence', a: 'Simon & Garfunkel', alb: 'Sounds of Silence' },
      { t: 'Wicked Game', a: 'Chris Isaak', alb: 'Heart Shaped World' },
      { t: 'Nothing Else Matters', a: 'Metallica', alb: 'Metallica' },
    ],
    hi: [
      { t: 'Kuch To Log Kahenge', a: 'Kishore Kumar', alb: 'Amar Prem' },
      { t: 'Musafir Hoon Yaaron', a: 'Kishore Kumar', alb: 'Parichay' },
      { t: 'Chalte Chalte Mere Yeh Geet Yaad Rakhna', a: 'Kishore Kumar', alb: 'Chalte Chalte' },
      { t: 'Dil Dhoondta Hai', a: 'Bhupinder Singh, Lata Mangeshkar', alb: 'Mausam' },
    ],
  },
  morning: {
    label: 'Bright morning',
    en: [
      { t: "Don't Stop Believin'", a: 'Journey', alb: 'Escape' },
      { t: 'Learn to Fly', a: 'Foo Fighters', alb: 'There Is Nothing Left to Lose' },
      { t: 'Jump', a: 'Van Halen', alb: '1984' },
      { t: 'Africa', a: 'Toto', alb: 'Toto IV' },
      { t: 'Born to Run', a: 'Bruce Springsteen', alb: 'Born to Run' },
      { t: 'Good Riddance (Time of Your Life)', a: 'Green Day', alb: 'Nimrod' },
      { t: 'Walk Like an Egyptian', a: 'The Bangles', alb: 'Different Light' },
    ],
    hi: [
      { t: 'Zindagi Ek Safar Hai Suhana', a: 'Kishore Kumar', alb: 'Andaz' },
      { t: 'Pehla Nasha', a: 'Udit Narayan, Sadhana Sargam', alb: 'Jo Jeeta Wohi Sikandar' },
      { t: 'Yeh Jo Mohabbat Hai', a: 'Kishore Kumar', alb: 'Kati Patang' },
      { t: 'O Saathi Re', a: 'Kishore Kumar', alb: 'Muqaddar Ka Sikandar' },
      { t: 'Chhookar Mere Man Ko', a: 'Kishore Kumar', alb: 'Yaarana' },
    ],
  },
  evening: {
    label: 'Golden evening',
    en: [
      { t: 'Take It Easy', a: 'Eagles', alb: 'Eagles' },
      { t: "Sweet Child o' Mine", a: "Guns N' Roses", alb: 'Appetite for Destruction' },
      { t: 'Dust in the Wind', a: 'Kansas', alb: 'Point of Know Return' },
      { t: 'More Than a Feeling', a: 'Boston', alb: 'Boston' },
      { t: 'Faithfully', a: 'Journey', alb: 'Frontiers' },
      { t: 'Wanted Dead or Alive', a: 'Bon Jovi', alb: 'Slippery When Wet' },
      { t: 'Carry On Wayward Son', a: 'Kansas', alb: 'Leftoverture' },
    ],
    hi: [
      { t: 'Yeh Shaam Mastani', a: 'Kishore Kumar', alb: 'Kati Patang' },
      { t: 'Pyar Deewana Hota Hai', a: 'Kishore Kumar', alb: 'Kati Patang' },
      { t: 'Aanewala Pal Janewala Hai', a: 'Kishore Kumar', alb: 'Golmaal' },
      { t: 'Kuch Kuch Hota Hai', a: 'Udit Narayan, Alka Yagnik', alb: 'Kuch Kuch Hota Hai' },
      { t: 'Jaadu Teri Nazar', a: 'Udit Narayan', alb: 'Darr' },
    ],
  },
  night: {
    label: 'Quiet night',
    en: [
      { t: 'Nightswimming', a: 'R.E.M.', alb: 'Automatic for the People' },
      { t: 'Night Moves', a: 'Bob Seger', alb: 'Night Moves' },
      { t: 'Landslide', a: 'Fleetwood Mac', alb: 'Fleetwood Mac' },
      { t: 'The Sound of Silence', a: 'Simon & Garfunkel', alb: 'Sounds of Silence' },
      { t: 'Wicked Game', a: 'Chris Isaak', alb: 'Heart Shaped World' },
      { t: 'Fast Car', a: 'Tracy Chapman', alb: 'Tracy Chapman' },
    ],
    hi: [
      { t: 'Raat Kali Ek Khwab Mein Aayi', a: 'Kishore Kumar', alb: 'Buddha Mil Gaya' },
      { t: 'Phir Wahi Raat Hai', a: 'Kishore Kumar', alb: 'Ghar' },
      { t: 'Yeh Raaten Yeh Mausam', a: 'Kishore Kumar, Asha Bhosle', alb: 'Dilli Ka Thug' },
      { t: 'Tere Bina Zindagi Se Koi', a: 'Kishore Kumar, Lata Mangeshkar', alb: 'Aandhi' },
    ],
  },
  easy: {
    label: 'Easy day',
    en: [
      { t: 'Take It Easy', a: 'Eagles', alb: 'Eagles' },
      { t: 'Peaceful Easy Feeling', a: 'Eagles', alb: 'Eagles' },
      { t: 'Simple Man', a: 'Lynyrd Skynyrd', alb: 'Pronounced' },
      { t: "Free Fallin'", a: 'Tom Petty', alb: 'Full Moon Fever' },
      { t: 'Under the Bridge', a: 'Red Hot Chili Peppers', alb: 'Blood Sugar Sex Magik' },
      { t: 'More Than a Feeling', a: 'Boston', alb: 'Boston' },
      { t: 'Time in a Bottle', a: 'Jim Croce', alb: "You Don't Mess Around with Jim" },
    ],
    hi: [
      { t: 'Pal Pal Dil Ke Paas', a: 'Kishore Kumar', alb: 'Blackmail' },
      { t: 'Mere Sapno Ki Rani', a: 'Kishore Kumar', alb: 'Aradhana' },
      { t: 'Jaadu Teri Nazar', a: 'Udit Narayan', alb: 'Darr' },
      { t: 'Kuch Kuch Hota Hai', a: 'Udit Narayan, Alka Yagnik', alb: 'Kuch Kuch Hota Hai' },
      { t: 'Tujhe Dekha To Yeh Jaana Sanam', a: 'Kumar Sanu, Lata Mangeshkar', alb: 'Dilwale Dulhania Le Jayenge' },
    ],
  },
};

// The first lists above are the core; songBank.ts adds many more for every mood (no repeats of a title within a mood).
for (const [mood, extra] of Object.entries(SONG_BANK)) {
  const m = MOODS[mood];
  if (!m) continue;
  for (const lang of ['en', 'hi'] as const) {
    const have = new Set(m[lang].map((x) => x.t.toLowerCase()));
    for (const song of extra[lang]) if (!have.has(song.t.toLowerCase())) { m[lang].push(song); have.add(song.t.toLowerCase()); }
  }
}

const istHour = (d: Date) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(d));

function pickMood(code: number, temp: number, hour: number): string {
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (temp >= 34) return 'hot';
  if (temp <= 15) return 'cool';
  if (hour >= 21 || hour < 5) return 'night';
  if (code <= 2) return hour < 12 ? 'morning' : hour >= 16 ? 'evening' : 'easy';
  return 'easy';
}

interface Found { cover: string; album: string; year: string; genre: string }
const ITUNES = 'https://itunes.apple.com/search';

/** Cover art, album and year for a song, remembered on the device so it is only looked up once. */
async function lookup(song: Song): Promise<Found | null> {
  const key = `mb.wall.song2.${song.t}|${song.a}`;
  try {
    const hit = localStorage.getItem(key);
    if (hit) return JSON.parse(hit) as Found;
  } catch { /* look it up */ }
  const url = `${ITUNES}?term=${encodeURIComponent(`${song.t} ${song.a.split(',')[0]} ${song.alb ?? ''}`.trim())}&entity=song&limit=25&country=IN`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = (await res.json()) as { results?: { trackName: string; collectionName?: string; releaseDate?: string; primaryGenreName?: string; artworkUrl100?: string }[] };
  // Apple spells Hindi titles its own way (Nahi, Samnewali...), so compare the first two words loosely.
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const want = norm(song.t).split(' ').slice(0, 2).join(' ');
  const starts = (r: { trackName: string }) => norm(r.trackName).startsWith(want);
  const rows = (j.results ?? []).filter((r) => r.artworkUrl100);
  const alb = (song.alb ?? '').toLowerCase();
  // Not the right record: remixes, lo-fi and tribute versions, and compilation albums.
  const NOT_ORIGINAL = /remix|live|karaoke|cover|remaster|lofi|lo-fi|unplugged|acoustic|reprise|tribute|version|recreat|mashup|slowed|reverb/i;
  const COMPILATION = /best of|hits|greatest|collection|ultimate|essential|classics|evergreen|romantic|celebrating|retro|golden|jukebox|top \d|playlist|super/i;
  const plain = (r: { trackName: string; collectionName?: string }) =>
    starts(r) && !NOT_ORIGINAL.test(`${r.trackName} ${r.collectionName ?? ''}`);
  // Naming the right album is a strong hint, so a remastered copy of it is fine.
  const loose = (r: { trackName: string; collectionName?: string }) =>
    starts(r) && !/remix|live|karaoke|cover|lofi|lo-fi|tribute|mashup|slowed|reverb/i.test(`${r.trackName} ${r.collectionName ?? ''}`);
  const oldestFirst = (x: { releaseDate?: string }, y: { releaseDate?: string }) => (x.releaseDate ?? '9').localeCompare(y.releaseDate ?? '9');
  const original = rows.filter((r) => plain(r) && !COMPILATION.test(r.collectionName ?? '')).sort(oldestFirst);
  const best =
    (alb ? rows.filter(loose).find((r) => (r.collectionName ?? '').toLowerCase().includes(alb)) : undefined) ??
    original[0] ??
    rows.filter(plain).sort(oldestFirst)[0] ??
    rows.find((r) => starts(r)) ??
    (alb ? rows.find((r) => (r.collectionName ?? '').toLowerCase().includes(alb)) : undefined) ??
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

export type RGB = [number, number, number];

/** The cover's main colour: the most vivid, mid-bright pixels, averaged. Null if the image cannot be read. */
export function dominantColour(url: string): Promise<RGB | null> {
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

export function Songs({ now }: { now: Date }) {
  const [wx, setWx] = useState<{ code: number; temp: number } | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [tint, setTint] = useState<RGB | null>(null);

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
  const lang = day % 3 === 2 ? 'hi' : 'en';
  const list = mood[lang];
  const song = list[day % list.length];
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

  useEffect(() => {
    let live = true;
    setTint(null);
    if (found?.cover) void dominantColour(found.cover).then((c) => { if (live) setTint(c); });
    return () => { live = false; };
  }, [found?.cover]);

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
      {found?.cover ? (
        <img src={found.cover} alt="" className="h-full max-h-[9.5rem] aspect-square rounded-xl object-cover bg-paper shrink-0" />
      ) : (
        <div className="h-full max-h-[9.5rem] aspect-square rounded-xl bg-paper border border-line shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex flex-col gap-[0.3rem]">
        <p className="text-[1.05rem] font-bold uppercase tracking-[0.16em] text-muted truncate">Today's song</p>
        <p className="text-[1.6rem] font-extrabold leading-tight line-clamp-2">{song.t}</p>
        <p className="text-[1.15rem] text-ink/80 truncate">
          <span className={`mr-2 rounded-full text-[0.8rem] font-bold px-[0.5rem] py-[0.05rem] ${lang === 'hi' ? 'bg-accent/15 text-accent' : 'bg-white/10 text-ink'}`}>{lang === 'hi' ? 'HI' : 'EN'}</span>
          {song.a}
        </p>
        {found && (found.album || found.year) && (
          <p className="text-[1rem] text-muted truncate">{[found.album, found.year, found.genre].filter(Boolean).join(' · ')}</p>
        )}
        <p className="text-[1rem] text-muted/80 truncate">For a {mood.label.toLowerCase()}{wx ? ` · ${Math.round(wx.temp)}°C` : ''}</p>
      </div>
    </section>
  );
}
