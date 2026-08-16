import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Package, Check, Truck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Purchase } from '../types';
import { avatarClasses } from '../lib/accent';
import { initialOf, timeAgo } from '../lib/format';
import { SHEET_SPRING } from '../lib/motion';
import { ScrollLock } from '../lib/useScrollLock';

interface RecordDeliveryModalProps {
  purchase: Purchase | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RecordDeliveryModal: React.FC<RecordDeliveryModalProps> = ({
  purchase,
  isOpen,
  onClose,
}) => {
  const { recordDelivery } = useApp();
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setQty('');
    setNotes('');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const submit = async (isFinal: boolean) => {
    if (!purchase || !qty.trim() || submitting) return;
    setSubmitting(true);
    try {
      const ok = await recordDelivery(purchase.id, qty.trim(), notes.trim(), isFinal);
      if (ok) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const p = purchase;
  const deliveries = p?.deliveries ?? [];

  return (
    <AnimatePresence>
      {isOpen && p && (
        <motion.div
          key="record-delivery"
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <ScrollLock />
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs animate-overlay"
            onClick={onClose}
            exit={{ opacity: 0 }}
          />
          <motion.div
            exit={{ y: '100%' }}
            transition={SHEET_SPRING}
            className="animate-sheet-solid relative w-full max-w-md bg-[#1E1E1E] rounded-t-3xl sm:rounded-xl shadow-2xl border border-[#2A2A2A] overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2A]">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Record Delivery
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-[#2A2A2A] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Purchase context */}
              <div className="bg-background p-3 rounded-lg border border-[#2A2A2A]">
                <p className="text-sm font-bold text-white">{p.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ordered: <span className="text-gray-300 font-semibold">{p.quantity}</span>
                </p>
              </div>

              {/* Previous deliveries */}
              {deliveries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Previous deliveries ({deliveries.length})
                  </p>
                  <div className="space-y-1.5">
                    {deliveries.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-2 bg-background p-2.5 rounded-lg border border-[#2A2A2A]"
                      >
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[8px] shrink-0 ${avatarClasses(d.receivedBy?.accent)}`}
                        >
                          {initialOf(d.receivedBy?.name ?? '?', d.receivedBy?.handle)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-amber-300">
                            {d.quantityReceived}
                          </span>
                          {d.notes && (
                            <span className="text-[11px] text-gray-500 ml-1.5">
                              — {d.notes}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-600 shrink-0">
                          {timeAgo(d.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity input */}
              <div>
                <label className="block text-sm font-bold text-white mb-1">
                  What arrived?
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  How much was received in this batch
                </p>
                <input
                  type="text"
                  autoFocus
                  placeholder={`e.g. 6 bottles, 2 packs, 50 mL...`}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-medium placeholder:text-gray-600"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Remaining expected next week"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-gray-600"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-1 pb-2 sm:pb-0">
                <button
                  type="button"
                  disabled={!qty.trim() || submitting}
                  onClick={() => void submit(false)}
                  className="flex-1 py-3 bg-amber-500/15 text-amber-300 font-semibold rounded-lg text-sm border border-amber-500/25 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  <Truck className="w-4 h-4" />
                  {submitting ? 'Saving...' : 'Partial'}
                </button>
                <button
                  type="button"
                  disabled={!qty.trim() || submitting}
                  onClick={() => void submit(true)}
                  className="flex-1 py-3 bg-emerald-500/15 text-emerald-300 font-semibold rounded-lg text-sm border border-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  {submitting ? 'Saving...' : 'All received'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
