import { useEffect, useState } from 'react';
import { istDayNumber } from './Thought';

// Songs to match the weather: half English, half Hindi. Four per language per mood, two of each shown a day,
// rotating daily. Titles and artists only.
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

export function Songs({ now }: { now: Date }) {
  const [wx, setWx] = useState<{ code: number; temp: number } | null>(null);

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
  const two = (list: Song[]) => [list[(day * 2) % list.length], list[(day * 2 + 1) % list.length]];
  const songs = [
    ...two(mood.en).map((s) => ({ ...s, lang: 'EN' })),
    ...two(mood.hi).map((s) => ({ ...s, lang: 'HI' })),
  ];

  return (
    <section className="rounded-3xl bg-card border border-line !p-[1.2rem] flex flex-col gap-[0.5rem] min-w-0 min-h-0" aria-label="Songs for today">
      <h2 className="text-[1.05rem] font-bold uppercase tracking-[0.16em] text-muted flex items-center justify-between gap-3">
        <span>Listen today</span>
        <span className="normal-case tracking-normal font-semibold truncate">{mood.label}{wx ? ` · ${Math.round(wx.temp)}°C` : ''}</span>
      </h2>
      <ul className="flex-1 min-h-0 grid grid-cols-2 gap-x-[1.2rem] gap-y-[0.4rem] content-center">
        {songs.map((s) => (
          <li key={`${s.lang}-${s.t}`} className="min-w-0 flex items-start gap-[0.6rem]">
            <span className={`mt-[0.2rem] shrink-0 rounded-full text-[0.8rem] font-bold px-[0.5rem] py-[0.05rem] ${s.lang === 'HI' ? 'bg-accent/15 text-accent' : 'bg-white/10 text-ink'}`}>{s.lang}</span>
            <span className="min-w-0 leading-tight">
              <span className="block text-[1.2rem] font-bold truncate">{s.t}</span>
              <span className="block text-[0.95rem] text-muted truncate">{s.a}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
