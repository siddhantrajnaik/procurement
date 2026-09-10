import { useEffect, useState } from 'react';
import { X, MapPin, Check, History } from 'lucide-react';
import { Equipment, EquipmentStatus } from '../../types';
import { equipmentIconSvg, EquipmentCategory } from '../../lib/equipmentIcons';
import { timeAgo } from '../../lib/format';
import { ScrollLock } from '../../lib/useScrollLock';

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
  onLogUse: () => Promise<boolean>;
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

  // Reset the confirmed state between openings, or the next instrument would
  // open already showing "Logged".
  useEffect(() => {
    if (!eq) {
      setJustLogged(false);
      setLogging(false);
    }
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
  const recent = [...(eq?.usageLog ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const handleLog = async () => {
    if (logging || justLogged) return;
    setLogging(true);
    try {
      if (await onLogUse()) {
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

          {eq.notes && (
            <p className="text-xs text-gray-400 leading-relaxed bg-background p-3 rounded-lg border border-[#2A2A2A]">
              {eq.notes}
            </p>
          )}

          {isDown && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
              This instrument is marked <strong>{st.label.toLowerCase()}</strong>. Please check with
              a lab member before using it.
            </div>
          )}

          {recent.length > 0 && (
            <div className="space-y-2 pt-1">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-gray-600" />
                Recently used
              </h3>
              <div className="space-y-1.5">
                {recent.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-gray-300 truncate">
                      {u.visitorName}
                      {u.affiliation && <span className="text-gray-500"> · {u.affiliation}</span>}
                    </span>
                    <span className="text-gray-600 shrink-0">{timeAgo(u.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
