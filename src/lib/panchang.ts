const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export type ChoghadiyaName = 'Udveg' | 'Char' | 'Labh' | 'Amrit' | 'Kaal' | 'Shubh' | 'Rog';
export type ChoghadiyaNature = 'good' | 'neutral' | 'bad';

export interface ChoghadiyaPeriod {
  name: ChoghadiyaName;
  nameHi: string;
  nature: ChoghadiyaNature;
  start: Date;
  end: Date;
  isDay: boolean;
}

export interface RahuKaalInfo {
  start: Date;
  end: Date;
}

export interface MuhuratResult {
  current: ChoghadiyaPeriod | null;
  nextGood: ChoghadiyaPeriod | null;
  rahuKaal: RahuKaalInfo;
  isRahuKaal: boolean;
  periods: ChoghadiyaPeriod[];
  sunrise: Date;
  sunset: Date;
}

const NAMES: ChoghadiyaName[] = [
  'Udveg', 'Char', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog',
];

const HINDI: Record<ChoghadiyaName, string> = {
  Udveg: 'उद्वेग',
  Char: 'चर',
  Labh: 'लाभ',
  Amrit: 'अमृत',
  Kaal: 'काल',
  Shubh: 'शुभ',
  Rog: 'रोग',
};

const NATURE: Record<ChoghadiyaName, ChoghadiyaNature> = {
  Amrit: 'good', Shubh: 'good', Labh: 'good',
  Char: 'neutral',
  Rog: 'bad', Kaal: 'bad', Udveg: 'bad',
};

const DAY_START = [0, 3, 6, 2, 5, 1, 4];
const NIGHT_START = [5, 1, 4, 0, 3, 6, 2];
const RAHU_PERIOD = [8, 2, 7, 5, 6, 4, 3];

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((d.getTime() - start.getTime()) / 86400000) + 1;
}

export function getSunTimes(
  date: Date,
  lat: number,
  lng: number,
): { sunrise: Date; sunset: Date } {
  const y = date.getFullYear();
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const doy = dayOfYear(date);
  const gamma = (2 * Math.PI / (leap ? 366 : 365)) * (doy - 1);

  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const cosHA =
    Math.cos(toRad(90.833)) / (Math.cos(toRad(lat)) * Math.cos(decl)) -
    Math.tan(toRad(lat)) * Math.tan(decl);

  const ha = toDeg(Math.acos(Math.max(-1, Math.min(1, cosHA))));

  const sunriseUTC = 720 - 4 * (lng + ha) - eqtime;
  const sunsetUTC = 720 - 4 * (lng - ha) - eqtime;

  const base = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return {
    sunrise: new Date(base + sunriseUTC * 60000),
    sunset: new Date(base + sunsetUTC * 60000),
  };
}

function buildPeriods(
  sunrise: Date,
  sunset: Date,
  nextSunrise: Date,
  weekday: number,
): ChoghadiyaPeriod[] {
  const dayMs = sunset.getTime() - sunrise.getTime();
  const nightMs = nextSunrise.getTime() - sunset.getTime();
  const daySlot = dayMs / 8;
  const nightSlot = nightMs / 8;
  const out: ChoghadiyaPeriod[] = [];

  for (let i = 0; i < 8; i++) {
    const n = NAMES[(DAY_START[weekday] + i) % 7];
    out.push({
      name: n,
      nameHi: HINDI[n],
      nature: NATURE[n],
      start: new Date(sunrise.getTime() + i * daySlot),
      end: new Date(sunrise.getTime() + (i + 1) * daySlot),
      isDay: true,
    });
  }

  for (let i = 0; i < 8; i++) {
    const n = NAMES[(NIGHT_START[weekday] + i) % 7];
    out.push({
      name: n,
      nameHi: HINDI[n],
      nature: NATURE[n],
      start: new Date(sunset.getTime() + i * nightSlot),
      end: new Date(sunset.getTime() + (i + 1) * nightSlot),
      isDay: false,
    });
  }

  return out;
}

function rahuKaal(sunrise: Date, sunset: Date, weekday: number): RahuKaalInfo {
  const slot = (sunset.getTime() - sunrise.getTime()) / 8;
  const idx = RAHU_PERIOD[weekday] - 1;
  return {
    start: new Date(sunrise.getTime() + idx * slot),
    end: new Date(sunrise.getTime() + (idx + 1) * slot),
  };
}

export function getMuhurat(now: Date, lat: number, lng: number): MuhuratResult {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todaySun = getSunTimes(today, lat, lng);
  const tomorrowSun = getSunTimes(tomorrow, lat, lng);
  const yesterdaySun = getSunTimes(yesterday, lat, lng);

  const todayPeriods = buildPeriods(
    todaySun.sunrise,
    todaySun.sunset,
    tomorrowSun.sunrise,
    today.getDay(),
  );

  const rk = rahuKaal(todaySun.sunrise, todaySun.sunset, today.getDay());
  const nowMs = now.getTime();

  let current =
    todayPeriods.find((p) => nowMs >= p.start.getTime() && nowMs < p.end.getTime()) ??
    null;

  if (!current && now < todaySun.sunrise) {
    const yPeriods = buildPeriods(
      yesterdaySun.sunrise,
      yesterdaySun.sunset,
      todaySun.sunrise,
      yesterday.getDay(),
    );
    current =
      yPeriods.find((p) => nowMs >= p.start.getTime() && nowMs < p.end.getTime()) ??
      null;
  }

  const isRahuKaal = nowMs >= rk.start.getTime() && nowMs < rk.end.getTime();

  let nextGood =
    todayPeriods.find((p) => p.nature === 'good' && p.start.getTime() > nowMs) ?? null;

  if (!nextGood) {
    const tmrPeriods = buildPeriods(
      tomorrowSun.sunrise,
      tomorrowSun.sunset,
      getSunTimes(
        new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1),
        lat,
        lng,
      ).sunrise,
      tomorrow.getDay(),
    );
    nextGood = tmrPeriods.find((p) => p.nature === 'good') ?? null;
  }

  return {
    current,
    nextGood,
    rahuKaal: rk,
    isRahuKaal,
    periods: todayPeriods,
    sunrise: todaySun.sunrise,
    sunset: todaySun.sunset,
  };
}

export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Mumbai: { lat: 19.076, lng: 72.877 },
  Delhi: { lat: 28.614, lng: 77.209 },
  Bangalore: { lat: 12.972, lng: 77.594 },
  Chennai: { lat: 13.083, lng: 80.27 },
  Kolkata: { lat: 22.573, lng: 88.364 },
  Pune: { lat: 18.52, lng: 73.856 },
  Hyderabad: { lat: 17.385, lng: 78.487 },
  Goa: { lat: 15.491, lng: 73.828 },
  Ahmedabad: { lat: 23.023, lng: 72.571 },
  Nagpur: { lat: 21.146, lng: 79.089 },
};

export const DEFAULT_COORDS = { lat: 21.146, lng: 79.089 };

export interface VaraInfo {
  name: string;
  nameHi: string;
  planet: string;
  planetHi: string;
  symbol: string;
}

export const VARA: VaraInfo[] = [
  { name: 'Ravivar', nameHi: 'रविवार', planet: 'Surya', planetHi: 'सूर्य', symbol: '☉' },
  { name: 'Somvar', nameHi: 'सोमवार', planet: 'Chandra', planetHi: 'चन्द्र', symbol: '☽' },
  { name: 'Mangalvar', nameHi: 'मंगलवार', planet: 'Mangal', planetHi: 'मंगल', symbol: '♂' },
  { name: 'Budhvar', nameHi: 'बुधवार', planet: 'Budh', planetHi: 'बुध', symbol: '☿' },
  { name: 'Guruvar', nameHi: 'गुरुवार', planet: 'Brihaspati', planetHi: 'बृहस्पति', symbol: '♃' },
  { name: 'Shukravar', nameHi: 'शुक्रवार', planet: 'Shukra', planetHi: 'शुक्र', symbol: '♀' },
  { name: 'Shanivar', nameHi: 'शनिवार', planet: 'Shani', planetHi: 'शनि', symbol: '♄' },
];

export const CHOGHADIYA_MESSAGE: Record<ChoghadiyaName, string> = {
  Amrit: 'The nectar of time flows — your experiment carries divine blessing',
  Shubh: 'Stars align in your favor — begin with confidence',
  Labh: 'Fortune walks beside you — this effort shall bear fruit',
  Char: 'A time of movement — suitable for routine, not new beginnings',
  Rog: 'Rest and reflect — the right moment approaches',
  Kaal: 'Patience is the companion of wisdom — prepare, but do not begin',
  Udveg: 'Stillness holds power — let this moment pass before you act',
};

export function formatPanchangTime(d: Date): string {
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
