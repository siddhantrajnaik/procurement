import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowLeft, Sun, Moon, Clock, AlertTriangle, MapPin, Search, X } from 'lucide-react';
import {
  getMuhurat,
  formatPanchangTime,
  formatCountdown,
  CITY_COORDS,
  DEFAULT_COORDS,
  VARA,
  CHOGHADIYA_MESSAGE,
  type MuhuratResult,
  type ChoghadiyaNature,
} from '../lib/panchang';

interface MuhuratProfile {
  name: string;
  dob: string;
  birthplace: string;
  lat?: number;
  lng?: number;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

const STORAGE_KEY = 'muhurat_profile';

function loadProfile(): MuhuratProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { name: '', dob: '', birthplace: '' };
}

const STARS = Array.from({ length: 80 }, (_, i) => ({
  left: `${(i * 17 + 23) % 100}%`,
  top: `${(i * 31 + 11) % 100}%`,
  size: 1 + (i % 3),
  delay: `${(i * 0.7) % 5}s`,
  duration: `${3 + (i % 4)}s`,
  opacity: 0.15 + (i % 5) * 0.12,
}));

const goodGlow =
  'bg-gradient-to-br from-amber-500/15 via-emerald-500/10 to-amber-500/5 border-amber-400/30';
const neutralGlow =
  'bg-gradient-to-br from-violet-500/15 via-slate-500/10 to-violet-500/5 border-violet-300/25';
const badGlow =
  'bg-gradient-to-br from-red-500/15 via-rose-500/10 to-red-500/5 border-red-400/25';

const cardGlow: Record<ChoghadiyaNature, string> = {
  good: goodGlow,
  neutral: neutralGlow,
  bad: badGlow,
};

const dotColor: Record<ChoghadiyaNature, string> = {
  good: 'bg-amber-400 shadow-amber-400/50',
  neutral: 'bg-violet-400 shadow-violet-400/50',
  bad: 'bg-red-400 shadow-red-400/50',
};

const textAccent: Record<ChoghadiyaNature, string> = {
  good: 'text-amber-300',
  neutral: 'text-violet-300',
  bad: 'text-red-300',
};

const progressBar: Record<ChoghadiyaNature, string> = {
  good: 'from-amber-400 via-yellow-300 to-amber-500',
  neutral: 'from-violet-400 via-purple-300 to-violet-500',
  bad: 'from-red-400 via-rose-300 to-red-500',
};

export const MuhuratView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [profile, setProfile] = useState<MuhuratProfile>(loadProfile);
  const [tick, setTick] = useState(0);
  const [placeQuery, setPlaceQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const searchPlace = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=in&addressdetails=0`;
        const res = await fetch(url, {
          headers: { 'Accept-Language': 'en' },
        });
        if (res.ok) {
          const data: NominatimResult[] = await res.json();
          setSuggestions(data);
          setShowSuggestions(data.length > 0);
        }
      } catch {
        /* network error — keep existing suggestions */
      } finally {
        setIsSearching(false);
      }
    }, 350);
  }, []);

  const selectPlace = useCallback((result: NominatimResult) => {
    const name = result.display_name.split(',')[0].trim();
    setProfile((p) => ({
      ...p,
      birthplace: name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    }));
    setPlaceQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  }, []);

  const getCoords = useCallback(() => {
    if (profile.lat != null && profile.lng != null) {
      return { lat: profile.lat, lng: profile.lng };
    }
    const city = Object.keys(CITY_COORDS).find((c) =>
      profile.birthplace.toLowerCase().includes(c.toLowerCase()),
    );
    return city ? CITY_COORDS[city] : DEFAULT_COORDS;
  }, [profile.birthplace, profile.lat, profile.lng]);

  const muhurat: MuhuratResult = useMemo(() => {
    void tick;
    const c = getCoords();
    return getMuhurat(new Date(), c.lat, c.lng);
  }, [getCoords, tick]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  const { current, nextGood, rahuKaal, isRahuKaal, periods, sunrise, sunset } =
    muhurat;

  const nowMs = Date.now();
  const timeLeft = current ? current.end.getTime() - nowMs : 0;
  const nextGoodIn = nextGood ? nextGood.start.getTime() - nowMs : 0;
  const progress = current
    ? Math.min(
        100,
        ((nowMs - current.start.getTime()) /
          (current.end.getTime() - current.start.getTime())) *
          100,
      )
    : 0;

  const vara = VARA[new Date().getDay()];

  return (
    <div
      className="flex-1 flex flex-col max-w-md mx-auto w-full relative overflow-hidden"
      style={{
        background:
          'linear-gradient(160deg, #0a0618 0%, #130b2e 30%, #0e1a3a 60%, #0a0618 100%)',
      }}
    >
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50% { opacity: 0.9; transform: scale(1.2); }
        }
        @keyframes float-up {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(251,191,36,0.1); }
          50% { box-shadow: 0 0 40px rgba(251,191,36,0.25); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .star {
          position: absolute;
          border-radius: 50%;
          background: white;
          animation: twinkle var(--dur) ease-in-out var(--delay) infinite;
          pointer-events: none;
        }
        .glass {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .glass-strong {
          background: rgba(255,255,255,0.07);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.12);
        }
        .shimmer-text {
          background: linear-gradient(90deg, #fbbf24, #fde68a, #fbbf24, #f59e0b);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

      {/* Star field */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {STARS.map((s, i) => (
          <div
            key={i}
            className="star"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              opacity: s.opacity,
              '--dur': s.duration,
              '--delay': s.delay,
            } as React.CSSProperties}
          />
        ))}
        {/* Large ambient orbs */}
        <div
          className="absolute w-64 h-64 rounded-full opacity-[0.07]"
          style={{
            background:
              'radial-gradient(circle, rgba(139,92,246,0.5), transparent 70%)',
            top: '10%',
            right: '-15%',
          }}
        />
        <div
          className="absolute w-48 h-48 rounded-full opacity-[0.05]"
          style={{
            background:
              'radial-gradient(circle, rgba(251,191,36,0.5), transparent 70%)',
            bottom: '20%',
            left: '-10%',
          }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 px-4 py-3 flex items-center gap-3 border-b border-white/[0.06]">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white/90 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h2 className="text-sm font-bold flex items-center gap-2">
          <span className="shimmer-text">Shubh Muhurat</span>
        </h2>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto no-scrollbar p-4 pb-28 space-y-4">
        {/* Personal Details */}
        <div className="glass rounded-2xl p-4 space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/30">
            Personal Details
          </h3>
          <div className="space-y-2.5">
            <input
              type="text"
              placeholder="Your name"
              value={profile.name}
              onChange={(e) =>
                setProfile((p) => ({ ...p, name: e.target.value }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:ring-1 focus:ring-amber-400/50 focus:border-amber-400/30 outline-none placeholder:text-white/20 transition-colors"
            />
            <input
              type="date"
              value={profile.dob}
              onChange={(e) =>
                setProfile((p) => ({ ...p, dob: e.target.value }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:ring-1 focus:ring-amber-400/50 focus:border-amber-400/30 outline-none [color-scheme:dark] transition-colors"
            />
            {/* Location autocomplete */}
            <div className="relative" ref={suggestionsRef}>
              {profile.birthplace ? (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-amber-400/20">
                  <MapPin className="w-4 h-4 text-amber-400/70 shrink-0" />
                  <span className="text-sm text-white flex-1">{profile.birthplace}</span>
                  <button
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, birthplace: '', lat: undefined, lng: undefined }))}
                    aria-label="Clear birth place"
                    className="p-2 -mr-1 rounded-full hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search birth place..."
                    value={placeQuery}
                    onChange={(e) => {
                      setPlaceQuery(e.target.value);
                      searchPlace(e.target.value);
                    }}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:ring-1 focus:ring-amber-400/50 focus:border-amber-400/30 outline-none placeholder:text-white/20 transition-colors"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-white/20 border-t-amber-400 rounded-full animate-spin" />
                  )}
                </div>
              )}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1.5 rounded-xl bg-[#1a1230] border border-white/10 shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectPlace(s)}
                      className="w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-b-0"
                    >
                      <MapPin className="w-3.5 h-3.5 text-amber-400/50 mt-0.5 shrink-0" />
                      <span className="text-xs text-white/70 leading-relaxed">{s.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(CITY_COORDS).map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() =>
                    setProfile((p) => ({
                      ...p,
                      birthplace: city,
                      lat: CITY_COORDS[city].lat,
                      lng: CITY_COORDS[city].lng,
                    }))
                  }
                  className={`px-2.5 py-1 rounded-full text-[11px] border transition-all ${
                    profile.birthplace === city
                      ? 'bg-amber-400/15 text-amber-300 border-amber-400/30 shadow-sm shadow-amber-400/10'
                      : 'bg-white/[0.03] hover:bg-white/[0.06] text-white/40 border-white/[0.06] hover:text-white/60'
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Vara — Sanskrit Day Info */}
        <div className="glass rounded-2xl p-4 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
            style={{
              background:
                'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(139,92,246,0.15))',
              border: '1px solid rgba(251,191,36,0.2)',
            }}
          >
            {vara.symbol}
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm">
              {vara.name}{' '}
              <span className="text-white/40 font-medium">{vara.nameHi}</span>
            </p>
            <p className="text-[11px] text-white/40">
              Ruling planet:{' '}
              <span className="text-amber-300/70 font-semibold">
                {vara.symbol} {vara.planet}
              </span>{' '}
              <span className="text-white/25">{vara.planetHi}</span>
            </p>
          </div>
        </div>

        {/* Current Status — hero card */}
        {current && (
          <div
            className={`rounded-2xl border p-5 space-y-4 ${cardGlow[current.nature]}`}
            style={{
              animation:
                current.nature === 'good'
                  ? 'glow-pulse 4s ease-in-out infinite'
                  : undefined,
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                  Current Choghadiya
                </p>
                <h2 className="text-3xl font-extrabold text-white mt-1 tracking-tight">
                  {current.name}
                </h2>
                <p className="text-lg text-white/50 font-medium -mt-0.5">
                  {current.nameHi}
                </p>
              </div>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background:
                    current.nature === 'good'
                      ? 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(16,185,129,0.15))'
                      : current.nature === 'neutral'
                        ? 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(148,163,184,0.15))'
                        : 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(244,63,94,0.15))',
                  border: `1px solid ${current.nature === 'good' ? 'rgba(251,191,36,0.25)' : current.nature === 'neutral' ? 'rgba(139,92,246,0.25)' : 'rgba(239,68,68,0.25)'}`,
                }}
              >
                {current.isDay ? (
                  <Sun
                    className={`w-7 h-7 ${textAccent[current.nature]}`}
                    style={{
                      animation: 'float-up 4s ease-in-out infinite',
                    }}
                  />
                ) : (
                  <Moon
                    className={`w-7 h-7 ${textAccent[current.nature]}`}
                    style={{
                      animation: 'float-up 4s ease-in-out infinite',
                    }}
                  />
                )}
              </div>
            </div>

            {/* Spiritual message */}
            <p
              className="text-sm italic leading-relaxed"
              style={{
                color:
                  current.nature === 'good'
                    ? 'rgba(253,230,138,0.8)'
                    : current.nature === 'neutral'
                      ? 'rgba(196,181,253,0.7)'
                      : 'rgba(252,165,165,0.7)',
              }}
            >
              "{CHOGHADIYA_MESSAGE[current.name]}"
            </p>

            {/* Time + countdown */}
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-white/40">
                <Clock className="w-3.5 h-3.5" />
                {formatPanchangTime(current.start)} –{' '}
                {formatPanchangTime(current.end)}
              </span>
              <span className={`font-bold ${textAccent[current.nature]}`}>
                {formatCountdown(timeLeft)} left
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${progressBar[current.nature]} transition-all duration-1000`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Nature badge */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide ${
                  current.nature === 'good'
                    ? 'bg-amber-400/15 text-amber-300 border border-amber-400/20'
                    : current.nature === 'neutral'
                      ? 'bg-violet-400/15 text-violet-300 border border-violet-400/20'
                      : 'bg-red-400/15 text-red-300 border border-red-400/20'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    current.nature === 'good'
                      ? 'bg-amber-400'
                      : current.nature === 'neutral'
                        ? 'bg-violet-400'
                        : 'bg-red-400'
                  }`}
                />
                {current.nature === 'good'
                  ? 'Shubh — Begin your experiment'
                  : current.nature === 'neutral'
                    ? 'Neutral — Routine work only'
                    : 'Ashubh — Wait for better timing'}
              </span>
            </div>
          </div>
        )}

        {/* Rahu Kaal */}
        {isRahuKaal ? (
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{
              background:
                'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(220,38,38,0.06))',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15 border border-red-500/20 shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-red-300">
                Rahu Kaal Active
              </p>
              <p className="text-[11px] text-red-400/60">
                {formatPanchangTime(rahuKaal.start)} –{' '}
                {formatPanchangTime(rahuKaal.end)} · Avoid starting new work
              </p>
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] border border-white/[0.06] shrink-0">
              <AlertTriangle className="w-4 h-4 text-white/25" />
            </div>
            <p className="text-xs text-white/35">
              <span className="font-semibold text-white/50">Rahu Kaal</span>{' '}
              {formatPanchangTime(rahuKaal.start)} –{' '}
              {formatPanchangTime(rahuKaal.end)}
            </p>
          </div>
        )}

        {/* Next good period */}
        {nextGood && current?.nature !== 'good' && nextGoodIn > 0 && (
          <div
            className="rounded-2xl p-4 flex items-center justify-between"
            style={{
              background:
                'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(16,185,129,0.04))',
              border: '1px solid rgba(251,191,36,0.15)',
            }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">
                Next Shubh Period
              </p>
              <p className="text-sm font-bold text-amber-300/90 mt-0.5">
                {nextGood.name}{' '}
                <span className="text-white/30 font-medium">
                  {nextGood.nameHi}
                </span>
              </p>
              <p className="text-[11px] text-white/30">
                {formatPanchangTime(nextGood.start)} –{' '}
                {formatPanchangTime(nextGood.end)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-extrabold shimmer-text">
                {formatCountdown(nextGoodIn)}
              </p>
              <p className="text-[10px] text-white/20">from now</p>
            </div>
          </div>
        )}

        {/* Sunrise / Sunset */}
        <div className="flex gap-3">
          <div className="flex-1 glass rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-400/10 border border-amber-400/15">
              <Sun className="w-4 h-4 text-amber-400/80" />
            </div>
            <div>
              <p className="text-[10px] text-white/25 font-medium">Sunrise</p>
              <p className="text-sm font-bold text-white/80">
                {formatPanchangTime(sunrise)}
              </p>
            </div>
          </div>
          <div className="flex-1 glass rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-400/10 border border-indigo-400/15">
              <Moon className="w-4 h-4 text-indigo-400/80" />
            </div>
            <div>
              <p className="text-[10px] text-white/25 font-medium">Sunset</p>
              <p className="text-sm font-bold text-white/80">
                {formatPanchangTime(sunset)}
              </p>
            </div>
          </div>
        </div>

        {/* Full Timeline */}
        <div className="glass-strong rounded-2xl p-4 space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/25">
            Today's Choghadiya
          </h3>

          {/* Day */}
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold text-amber-400/60 flex items-center gap-1.5 mb-1">
              <Sun className="w-3 h-3" /> Day — Sunrise to Sunset
            </p>
            {periods
              .filter((p) => p.isDay)
              .map((p, i) => {
                const isNow =
                  current &&
                  p.start.getTime() === current.start.getTime() &&
                  p.end.getTime() === current.end.getTime();
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                      isNow
                        ? `${cardGlow[p.nature]} border`
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-2 h-2 rounded-full shadow-sm ${dotColor[p.nature]}`}
                      />
                      <span
                        className={`font-semibold ${isNow ? 'text-white' : 'text-white/60'}`}
                      >
                        {p.name}
                      </span>
                      <span className="text-white/20">{p.nameHi}</span>
                    </div>
                    <span className="text-white/25 font-medium tabular-nums">
                      {formatPanchangTime(p.start)} –{' '}
                      {formatPanchangTime(p.end)}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Night */}
          <div className="space-y-0.5 pt-1">
            <p className="text-[10px] font-semibold text-indigo-400/60 flex items-center gap-1.5 mb-1">
              <Moon className="w-3 h-3" /> Night — Sunset to Sunrise
            </p>
            {periods
              .filter((p) => !p.isDay)
              .map((p, i) => {
                const isNow =
                  current &&
                  p.start.getTime() === current.start.getTime() &&
                  p.end.getTime() === current.end.getTime();
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                      isNow
                        ? `${cardGlow[p.nature]} border`
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-2 h-2 rounded-full shadow-sm ${dotColor[p.nature]}`}
                      />
                      <span
                        className={`font-semibold ${isNow ? 'text-white' : 'text-white/60'}`}
                      >
                        {p.name}
                      </span>
                      <span className="text-white/20">{p.nameHi}</span>
                    </div>
                    <span className="text-white/25 font-medium tabular-nums">
                      {formatPanchangTime(p.start)} –{' '}
                      {formatPanchangTime(p.end)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Footer blessing */}
        <p className="text-center text-[11px] text-white/15 italic py-2">
          Om Shri Ganeshaya Namah
        </p>
      </div>
    </div>
  );
};
