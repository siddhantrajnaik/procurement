import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BookableItem } from '../types';

interface Props {
  isOpen: boolean;
  item: BookableItem | null;
  date: string;
  onClose: () => void;
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM to 9 PM

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function toTimeStr(h: number): string {
  return `${String(h).padStart(2, '0')}:00:00`;
}

export const AddBookingModal: React.FC<Props> = ({ isOpen, item, date, onClose }) => {
  const { createBooking, bookings } = useApp();

  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(10);
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStartHour(9);
    setEndHour(10);
    setPurpose('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const conflict = useMemo(() => {
    if (!item) return false;
    const newStart = toTimeStr(startHour);
    const newEnd = toTimeStr(endHour);
    return bookings.some(
      (b) =>
        b.itemId === item.id &&
        b.date === date &&
        b.status === 'confirmed' &&
        b.startTime < newEnd &&
        b.endTime > newStart
    );
  }, [bookings, item, date, startHour, endHour]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || endHour <= startHour || conflict) return;
    setSubmitting(true);
    try {
      await createBooking({
        itemId: item.id,
        date,
        startTime: toTimeStr(startHour),
        endTime: toTimeStr(endHour),
        purpose: purpose.trim(),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && item && (
        <motion.div
          key="add-booking"
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            className="w-full max-w-sm bg-[#1E1E1E] rounded-t-3xl sm:rounded-xl shadow-2xl border border-[#2A2A2A] overflow-hidden"
          >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2A]">
            <div>
              <h3 className="font-bold text-white text-sm">Book Slot</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {item.name} · {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-[#2A2A2A]">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Start Time</label>
                <select
                  value={startHour}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    setStartHour(h);
                    if (endHour <= h) setEndHour(h + 1);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-violet-500 outline-none"
                >
                  {HOURS.slice(0, -1).map((h) => (
                    <option key={h} value={h}>{formatHour(h)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">End Time</label>
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-violet-500 outline-none"
                >
                  {HOURS.filter((h) => h > startHour).map((h) => (
                    <option key={h} value={h}>{formatHour(h)}</option>
                  ))}
                </select>
              </div>
            </div>

            {conflict && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                This slot overlaps with an existing booking.
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Purpose</label>
              <input
                type="text"
                placeholder="What will you use it for?"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-violet-500 outline-none placeholder:text-gray-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || endHour <= startHour || conflict}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              {submitting ? 'Booking…' : `Book ${formatHour(startHour)} – ${formatHour(endHour)}`}
            </button>
          </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
