import { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Calendar, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { BookableItem } from '../types';
import { AddBookableItemModal } from './AddBookableItemModal';
import { BookingDayView } from './BookingDayView';
import { ConfirmModal } from './ConfirmModal';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatHour(time: string): string {
  const h = parseInt(time.split(':')[0], 10);
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

interface Props {
  onBack: () => void;
}

export const BookingView: React.FC<Props> = ({ onBack }) => {
  const { bookableItems, bookings, cancelBooking, removeBookableItem } = useApp();
  const { currentUser } = useAuth();
  const [selectedItem, setSelectedItem] = useState<BookableItem | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [tab, setTab] = useState<'items' | 'my'>('items');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const today = todayStr();

  const myBookings = useMemo(
    () =>
      bookings
        .filter(
          (b) =>
            b.bookedBy?.id === currentUser?.id &&
            b.status === 'confirmed' &&
            b.date >= today
        )
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
    [bookings, currentUser, today]
  );

  const itemMap = useMemo(() => {
    const m = new Map<string, BookableItem>();
    for (const it of bookableItems) m.set(it.id, it);
    return m;
  }, [bookableItems]);

  const todayBookingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bookings) {
      if (b.date === today && b.status === 'confirmed') {
        counts[b.itemId] = (counts[b.itemId] ?? 0) + 1;
      }
    }
    return counts;
  }, [bookings, today]);

  if (selectedItem) {
    return (
      <div className="flex-1 w-full mx-auto pb-24 md:pb-8 flex flex-col max-w-3xl">
        <BookingDayView item={selectedItem} onBack={() => setSelectedItem(null)} />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full mx-auto pb-24 md:pb-8 flex flex-col max-w-3xl px-4 md:px-0">
      {/* Header */}
      <div className="py-4 mt-2 md:mt-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Bookings
        </button>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 text-sm font-medium border-b border-[#2A2A2A] mb-4">
        <button
          onClick={() => setTab('items')}
          className={`pb-2 transition-colors ${
            tab === 'items'
              ? 'text-violet-400 border-b-2 border-violet-400 font-semibold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Items
          {bookableItems.length > 0 && (
            <span className="ml-1 text-[10px] text-gray-500">({bookableItems.length})</span>
          )}
        </button>
        <button
          onClick={() => setTab('my')}
          className={`pb-2 transition-colors ${
            tab === 'my'
              ? 'text-violet-400 border-b-2 border-violet-400 font-semibold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          My Bookings
          {myBookings.length > 0 && (
            <span className="ml-1 text-[10px] text-gray-500">({myBookings.length})</span>
          )}
        </button>
      </div>

      {tab === 'items' && (
        <>
          {bookableItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E]">
              <Calendar className="w-10 h-10 text-gray-600 mb-3" />
              <h3 className="text-white font-medium text-sm mb-1">No bookable items yet</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                Add instruments, benches, or any shared resource that lab members need to reserve.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bookableItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="bg-[#1E1E1E] p-4 rounded-xl border border-[#2A2A2A] hover:border-violet-500/30 transition-colors text-left group relative"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: item.color + '20', border: `1px solid ${item.color}40` }}
                    >
                      <Calendar className="w-5 h-5" style={{ color: item.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-white text-sm truncate">{item.name}</h3>
                      {item.description && (
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">{item.description}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {todayBookingCounts[item.id]
                          ? `${todayBookingCounts[item.id]} booking${todayBookingCounts[item.id] > 1 ? 's' : ''} today`
                          : 'No bookings today'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(item.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'my' && (
        <>
          {myBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E]">
              <Calendar className="w-10 h-10 text-gray-600 mb-3" />
              <h3 className="text-white font-medium text-sm mb-1">No upcoming bookings</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                Select an item and book a time slot to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {myBookings.map((b) => {
                const item = itemMap.get(b.itemId);
                const dateLabel = new Date(b.date + 'T00:00:00').toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                });
                const isBookingToday = b.date === today;

                return (
                  <div
                    key={b.id}
                    className="bg-[#1E1E1E] p-4 rounded-xl border border-[#2A2A2A] flex items-center gap-3"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: (item?.color ?? '#8B5CF6') + '20',
                        border: `1px solid ${item?.color ?? '#8B5CF6'}40`,
                      }}
                    >
                      <Calendar className="w-5 h-5" style={{ color: item?.color ?? '#8B5CF6' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">
                        {item?.name ?? 'Unknown'}
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        <span className={isBookingToday ? 'text-violet-400 font-semibold' : ''}>
                          {isBookingToday ? 'Today' : dateLabel}
                        </span>
                        {' · '}
                        {formatHour(b.startTime)} – {formatHour(b.endTime)}
                      </p>
                      {b.purpose && (
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{b.purpose}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setCancelTarget(b.id)}
                      className="p-1.5 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <AddBookableItemModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete Item"
        message="This will also delete all bookings for this item. Continue?"
        confirmLabel="Delete"
        busyLabel="Deleting…"
        onConfirm={async () => {
          if (deleteTarget) await removeBookableItem(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={cancelTarget !== null}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking?"
        confirmLabel="Cancel Booking"
        busyLabel="Cancelling…"
        onConfirm={async () => {
          if (cancelTarget) await cancelBooking(cancelTarget);
          setCancelTarget(null);
        }}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
};
