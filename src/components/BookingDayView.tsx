import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { BookableItem } from '../types';
import { avatarClasses } from '../lib/accent';
import { initialOf } from '../lib/format';
import { AddBookingModal } from './AddBookingModal';
import { ConfirmModal } from './ConfirmModal';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function parseHour(time: string): number {
  return parseInt(time.split(':')[0], 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface Props {
  item: BookableItem;
  onBack: () => void;
}

export const BookingDayView: React.FC<Props> = ({ item, onBack }) => {
  const { bookings, cancelBooking } = useApp();
  const { currentUser } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const dayBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.itemId === item.id && b.date === date && b.status === 'confirmed')
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [bookings, item.id, date]
  );

  const isToday = date === todayStr();
  const currentHour = new Date().getHours();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2A2A2A] flex items-center justify-between shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="text-center">
          <h3 className="font-bold text-white text-sm">{item.name}</h3>
          {item.description && (
            <p className="text-[10px] text-gray-500">{item.description}</p>
          )}
        </div>
        <button
          onClick={() => setIsBookOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-md hover:bg-violet-700 transition-colors font-medium text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Book
        </button>
      </div>

      {/* Date nav */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#2A2A2A] shrink-0">
        <button
          onClick={() => setDate(addDays(date, -1))}
          className="p-1.5 rounded-lg hover:bg-[#2A2A2A] text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-white">{formatDate(date)}</p>
          {isToday && (
            <span className="text-[10px] font-bold text-violet-400">Today</span>
          )}
        </div>
        <button
          onClick={() => setDate(addDays(date, 1))}
          className="p-1.5 rounded-lg hover:bg-[#2A2A2A] text-gray-400 hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Today button */}
      {!isToday && (
        <div className="px-4 pt-2 shrink-0">
          <button
            onClick={() => setDate(todayStr())}
            className="text-xs text-violet-400 hover:text-violet-300 font-semibold"
          >
            Jump to today
          </button>
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="relative">
          {HOURS.map((h) => {
            const booking = dayBookings.find(
              (b) => parseHour(b.startTime) <= h && parseHour(b.endTime) > h
            );
            const isBookingStart = booking && parseHour(booking.startTime) === h;
            const bookingSpan = booking
              ? parseHour(booking.endTime) - parseHour(booking.startTime)
              : 0;
            const isPast = isToday && h < currentHour;

            return (
              <div
                key={h}
                className={`flex items-stretch min-h-[52px] border-b border-[#1a1a1a] ${isPast ? 'opacity-40' : ''}`}
              >
                {/* Hour label */}
                <div className="w-16 shrink-0 pr-2 pt-1 text-right">
                  <span className="text-[10px] font-mono text-gray-500">
                    {formatHour(h)}
                  </span>
                </div>

                {/* Slot */}
                <div className="flex-1 relative">
                  {isBookingStart && booking && (
                    <div
                      className="absolute inset-x-0 top-0 rounded-lg px-3 py-2 z-10 border cursor-pointer group"
                      style={{
                        height: `${bookingSpan * 52}px`,
                        backgroundColor: item.color + '20',
                        borderColor: item.color + '40',
                      }}
                      onClick={() => {
                        if (booking.bookedBy?.id === currentUser?.id) {
                          setCancelTarget(booking.id);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {booking.bookedBy && (
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${avatarClasses(booking.bookedBy.accent)}`}
                              >
                                {initialOf(booking.bookedBy.name, booking.bookedBy.handle)}
                              </div>
                            )}
                            <span className="text-xs font-bold text-white truncate">
                              {booking.bookedBy?.name ?? 'Unknown'}
                            </span>
                          </div>
                          {booking.purpose && (
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                              {booking.purpose}
                            </p>
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-gray-500 shrink-0 mt-0.5">
                          {formatHour(parseHour(booking.startTime))}–{formatHour(parseHour(booking.endTime))}
                        </span>
                      </div>
                      {booking.bookedBy?.id === currentUser?.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCancelTarget(booking.id);
                          }}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-black/40 text-gray-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {!booking && !isPast && (
                    <div
                      className="absolute inset-0 hover:bg-violet-500/5 rounded cursor-pointer transition-colors"
                      onClick={() => setIsBookOpen(true)}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Current time indicator */}
          {isToday && currentHour >= 7 && currentHour <= 21 && (
            <div
              className="absolute left-16 right-0 h-0.5 bg-red-500 z-20 pointer-events-none"
              style={{ top: `${(currentHour - 7) * 52 + (new Date().getMinutes() / 60) * 52}px` }}
            >
              <div className="absolute -left-1.5 -top-1 w-3 h-3 rounded-full bg-red-500" />
            </div>
          )}
        </div>
      </div>

      <AddBookingModal
        isOpen={isBookOpen}
        item={item}
        date={date}
        onClose={() => setIsBookOpen(false)}
      />

      <ConfirmModal
        open={cancelTarget !== null}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking?"
        confirmLabel="Cancel Booking"
        onConfirm={async () => {
          if (cancelTarget) await cancelBooking(cancelTarget);
          setCancelTarget(null);
        }}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
};
