import { useEffect, useState } from 'react';
import { X, Check, MapPin } from 'lucide-react';
import { Equipment, EquipmentStatus } from '../../types';
import { equipmentIconSvg, EquipmentCategory } from '../../lib/equipmentIcons';
import { ScrollLock } from '../../lib/useScrollLock';
import { formatWhen, toLocalInputValue } from '../../lib/format';

/** What the sheet collects about a run. Every field optional — one tap still works. */
export interface UsageDetails {
  purpose?: string;
  speed?: string;
  startedAt?: string | null;
  durationMinutes?: number | null;
}

type DurationUnit = 'minutes' | 'hours' | 'days';

const UNIT_MINUTES: Record<DurationUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

const STATUS_CONFIG: Record<EquipmentStatus, { label: string; color: string; bg: string; border: string }> = {
  working:         { label: 'Working',         color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  needs_attention: { label: 'Needs Attention', color: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  down:            { label: 'Down',            color: 'text-red-300',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
  under_service:   { label: 'Under Service',   color: 'text-blue-300',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
};

interface Props {
  /** Null when nothing is open — the sheet owns its own presence animation. */
  equipment: Equipment | null;
  onClose: () => void;
  onLogUse: (details: UsageDetails) => Promise<boolean>;
}

/**
 * Read-only instrument detail for a visitor.
 *
 * Deliberately NOT a reuse of EquipmentThreadModal: that renders maintenance and
 * repair costs in rupees in four places, which is exactly what a guest must not
 * see. This shows only what someone standing in front of the machine needs.
 */
export const GuestInstrumentSheet: React.FC<Props> = ({ equipment: eq, onClose, onLogUse }) => {
  const [logging, setLogging] = useState(false);
  const [justLogged, setJustLogged] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [speed, setSpeed] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [durationValue, setDurationValue] = useState('');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('minutes');

  // Reset between openings, or the next instrument would open already showing
  // "Logged" with the last visitor's numbers in it.
  useEffect(() => {
    if (!eq) {
      setJustLogged(false);
      setLogging(false);
      setPurpose('');
      setSpeed('');
      setStartedAt('');
      setDurationValue('');
      setDurationUnit('minutes');
      return;
    }
    // Prefilled to now because this is logged after the fact and most runs here
    // are short — a centrifuge spin is over before you put the tube down. An
    // incubator run started yesterday is a two-tap correction, which is the
    // right way round.
    setStartedAt(toLocalInputValue(new Date()));
  }, [eq]);

  useEffect(() => {
    if (!eq) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, eq]);

  const st = eq ? STATUS_CONFIG[eq.status] ?? STATUS_CONFIG.working : STATUS_CONFIG.working;
  const isDown = eq?.status === 'down' || eq?.status === 'under_service';
  const asksSpeed = ['centrifuge', 'shaker', 'vortex'].includes(eq?.category ?? '');

  // Minutes is what the column stores, so the unit is only ever a multiplier on
  // the way in. Anything non-positive counts as "not filled in".
  const minutes = (() => {
    const n = Number(durationValue);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * UNIT_MINUTES[durationUnit]);
  })();

  const startDate = startedAt ? new Date(startedAt) : null;
  const startValid = startDate !== null && !Number.isNaN(startDate.getTime());
  const endDate =
    startValid && minutes !== null ? new Date(startDate.getTime() + minutes * 60_000) : null;

  // Shown back rather than validated away: a run that ends in the future is
  // usually a typo, but an incubator legitimately left running is not, and this
  // screen is not the place to argue with a visitor.
  const endsAt = endDate ? formatWhen(endDate.toISOString()) : '';
  const endsInFuture = endDate !== null && endDate.getTime() > Date.now();

  const handleLog = async () => {
    if (logging || justLogged) return;
    setLogging(true);
    try {
      if (
        await onLogUse({
          purpose,
          speed,
          // Only send a start when something was actually recorded about the
          // run. A bare tap should not claim the machine ran for zero minutes
          // from the moment the sheet happened to be opened.
          startedAt: startValid && minutes !== null ? startDate!.toISOString() : null,
          durationMinutes: minutes,
        })
      ) {
        // Confirm in place rather than closing: the visitor sees the button
        // change, so there is no doubt the tap registered.
        setJustLogged(true);
        setTimeout(onClose, 900);
      }
    } finally {
      setLogging(false);
    }
  };

  // Plain conditional render, no AnimatePresence. Its exit animation completed
  // but it never unmounted the wrapper, leaving an invisible full-screen layer
  // that swallowed every tap — the app became unusable after closing a sheet.
  // Entry is the CSS keyframe below, which is the part worth keeping.
  if (!eq) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={eq.name}
    >
      <ScrollLock />
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs animate-overlay"
        onClick={onClose}
      />
      <div
        className="animate-sheet-solid relative w-full max-w-md bg-[#1E1E1E] rounded-t-3xl sm:rounded-xl shadow-2xl border border-[#2A2A2A] overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#2A2A2A]">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-lg bg-[#2A2A2A] border border-[#333] flex items-center justify-center text-gray-400 shrink-0"
              dangerouslySetInnerHTML={{ __html: equipmentIconSvg(eq.category as EquipmentCategory) }}
            />
            <div className="min-w-0">
              <h2 className="font-bold text-white text-base leading-tight truncate">{eq.name}</h2>
              {(eq.manufacturer || eq.model) && (
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {[eq.manufacturer, eq.model].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-[#2A2A2A] shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
          <div className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold ${st.bg} ${st.border} ${st.color}`}>
            {st.label}
          </div>

          {eq.location && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <MapPin className="w-4 h-4 text-gray-500 shrink-0" />
              {eq.location}
            </div>
          )}

          {isDown && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
              This instrument is marked <strong>{st.label.toLowerCase()}</strong>. Please check with
              a lab member before using it.
            </div>
          )}

          {/* Every field optional: the log is worth more filled in, but a
              visitor who just taps the button must still get a clean entry. */}
          <div className="space-y-2.5 pt-1">
            <input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What for? (optional)"
              className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-gray-600"
            />
            <div className={asksSpeed ? 'grid grid-cols-2 gap-2.5' : ''}>
              {asksSpeed && (
                <input
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value)}
                  placeholder="Speed (optional)"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-gray-600"
                />
              )}
              <input
                type="datetime-local"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                aria-label="Started at"
                className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none [color-scheme:dark]"
              />
            </div>

            {/* A number and a unit rather than free text, so the lab can add
                these up. "20 min" reads fine on a card and answers nothing when
                someone asks how many hours the incubator was busy. */}
            <div className="grid grid-cols-[1fr_auto] gap-2.5">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
                placeholder="Ran for (optional)"
                aria-label="Ran for"
                className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-gray-600"
              />
              <select
                value={durationUnit}
                onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                aria-label="Unit"
                className="px-3 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              >
                <option value="minutes">min</option>
                <option value="hours">hours</option>
                <option value="days">days</option>
              </select>
            </div>

            {endsAt && (
              <p className="text-[11px] text-gray-500 px-0.5">
                Finished {endsAt}
                {endsInFuture && ' — that is in the future'}
              </p>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-[#2A2A2A] bg-[#1E1E1E]">
          <button
            onClick={() => void handleLog()}
            disabled={logging || justLogged}
            className={`w-full py-3.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
              justLogged
                ? 'bg-emerald-600 text-white'
                : 'bg-primary hover:bg-orange-600 text-white disabled:opacity-60'
            }`}
          >
            <Check className="w-4 h-4" />
            {justLogged ? 'Logged' : logging ? 'Logging…' : 'I used this'}
          </button>
        </div>
      </div>
    </div>
  );
};
