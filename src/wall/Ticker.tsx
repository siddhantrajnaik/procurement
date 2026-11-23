import { useEffect, useState } from 'react';

// Weather and air quality for IIT Delhi from Open-Meteo (free, no key, nothing private is sent).
const LAT = 28.545;
const LON = 77.192;
const WEATHER = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&hourly=precipitation_probability&daily=temperature_2m_max,temperature_2m_min,sunset&timezone=Asia%2FKolkata&forecast_days=2`;
const AIR = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=us_aqi,pm2_5,pm10&timezone=Asia%2FKolkata`;
const REFRESH_MS = 15 * 60_000;

interface Weather {
  current: { time: string; temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; weather_code: number; wind_speed_10m: number };
  hourly: { time: string[]; precipitation_probability: (number | null)[] };
  daily: { temperature_2m_max: number[]; temperature_2m_min: number[]; sunset: string[] };
}
interface Air { current: { us_aqi: number | null; pm2_5: number | null; pm10: number | null } }

const SKY = (c: number): string => {
  if (c === 0) return 'Clear sky';
  if (c <= 2) return 'Partly cloudy';
  if (c === 3) return 'Overcast';
  if (c === 45 || c === 48) return 'Foggy';
  if (c >= 51 && c <= 57) return 'Drizzle';
  if (c >= 61 && c <= 67) return 'Rain';
  if (c >= 71 && c <= 77) return 'Snow';
  if (c >= 80 && c <= 82) return 'Rain showers';
  if (c >= 95) return 'Thunderstorm';
  return 'Cloudy';
};

const AQI_BAND = (v: number): { label: string; tone: string } => {
  if (v <= 50) return { label: 'Good', tone: 'text-emerald-300' };
  if (v <= 100) return { label: 'Moderate', tone: 'text-yellow-300' };
  if (v <= 150) return { label: 'Unhealthy for sensitive groups', tone: 'text-orange-300' };
  if (v <= 200) return { label: 'Unhealthy', tone: 'text-red-300' };
  if (v <= 300) return { label: 'Very unhealthy', tone: 'text-fuchsia-300' };
  return { label: 'Hazardous', tone: 'text-rose-400' };
};

const hhmm = (iso: string) => iso.slice(11, 16);
const ampm = (iso: string) => {
  const h = Number(iso.slice(11, 13));
  return `${h % 12 || 12}${iso.slice(13, 16) === ':00' ? '' : iso.slice(13, 16)} ${h < 12 ? 'AM' : 'PM'}`;
};

type Item = { key: string; label: string; value: string; tone?: string };

function build(w: Weather | null, a: Air | null): Item[] {
  const items: Item[] = [];
  if (w) {
    const c = w.current;
    items.push({ key: 'now', label: 'IIT Delhi now', value: `${Math.round(c.temperature_2m)}°C · ${SKY(c.weather_code)}` });
    items.push({ key: 'feels', label: 'Feels like', value: `${Math.round(c.apparent_temperature)}°C` });

    // Rain: the next 12 hours from the reading time.
    const start = w.hourly.time.findIndex((t) => t >= c.time.slice(0, 13) + ':00');
    const from = start < 0 ? 0 : start;
    const probs = w.hourly.precipitation_probability.slice(from, from + 12).map((p) => p ?? 0);
    const times = w.hourly.time.slice(from, from + 12);
    const peak = Math.max(0, ...probs);
    const peakAt = times[probs.indexOf(peak)];
    items.push(
      peak < 10
        ? { key: 'rain', label: 'Rain', value: 'No rain expected in the next 12 hours', tone: 'text-emerald-300' }
        : { key: 'rain', label: 'Chance of rain', value: `${peak}% around ${ampm(peakAt)}`, tone: peak >= 50 ? 'text-sky-300' : 'text-sky-200' }
    );
    const todayIdx = w.daily.temperature_2m_max.length > 0 ? 0 : -1;
    if (todayIdx === 0) {
      items.push({ key: 'range', label: 'Today', value: `high ${Math.round(w.daily.temperature_2m_max[0])}° · low ${Math.round(w.daily.temperature_2m_min[0])}°` });
      if (w.daily.sunset[0] && w.daily.sunset[0] > c.time) items.push({ key: 'sunset', label: 'Sunset', value: hhmm(w.daily.sunset[0]) });
    }
    if (w.daily.temperature_2m_max.length > 1) {
      items.push({ key: 'tmr', label: 'Tomorrow', value: `high ${Math.round(w.daily.temperature_2m_max[1])}° · low ${Math.round(w.daily.temperature_2m_min[1])}°` });
    }
  }
  if (a?.current.us_aqi != null) {
    const band = AQI_BAND(a.current.us_aqi);
    const pm = a.current.pm2_5 != null ? ` · PM2.5 ${Math.round(a.current.pm2_5)} µg/m³` : '';
    items.splice(1, 0, { key: 'aqi', label: 'Air quality (AQI)', value: `${Math.round(a.current.us_aqi)} ${band.label}${pm}`, tone: band.tone });
  }
  return items;
}

export function Ticker() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const [w, a] = await Promise.all([
        fetch(WEATHER).then((r) => (r.ok ? (r.json() as Promise<Weather>) : null)).catch(() => null),
        fetch(AIR).then((r) => (r.ok ? (r.json() as Promise<Air>) : null)).catch(() => null),
      ]);
      if (!live) return;
      const next = build(w, a);
      if (next.length) setItems(next); // on failure keep showing the last good reading
    };
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => { live = false; clearInterval(id); };
  }, []);

  if (items.length === 0) return null;

  const line = (suffix: string) => (
    <div className="flex items-center shrink-0" aria-hidden={suffix === 'b'}>
      {items.map((it) => (
        <span key={`${suffix}-${it.key}`} className="flex items-baseline gap-[0.6rem] pr-[3.2rem]">
          <span className="text-[1rem] font-bold uppercase tracking-[0.14em] text-muted">{it.label}</span>
          <span className={`text-[1.5rem] font-bold ${it.tone ?? 'text-ink'}`}>{it.value}</span>
          <span className="pl-[2rem] text-muted/50">•</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="col-span-2 rounded-2xl bg-card border border-line overflow-hidden py-[0.7rem] ticker-mask" aria-label="Weather at IIT Delhi">
      {/* The same line twice, sliding left by exactly one copy, so it loops without a jump. */}
      <div className="ticker-track flex w-max" style={{ animationDuration: `${Math.max(40, items.length * 9)}s` }}>
        {line('a')}
        {line('b')}
      </div>
    </div>
  );
}
