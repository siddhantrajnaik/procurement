import { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import { NewLoanInput } from '../../types';
import { ScrollLock } from '../../lib/useScrollLock';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: Omit<NewLoanInput, 'visitorName'>) => Promise<boolean>;
}

/**
 * Records what a visitor took away.
 *
 * Two deliberate omissions. It never reads from or suggests against the
 * inventory, so a visitor is never shown what the lab stocks or where any of it
 * is kept — they type what they took and nothing more. And it never calls
 * `consumeItem`, so stock counts are untouched: this records what left the room
 * rather than adjusting what is on the shelf.
 *
 * The cost is that `item_id` is always null and `item_name` is free text, which
 * a lab member reconciles by eye. That is the right trade — the alternative
 * leaks the whole stock list to anyone who walks in.
 */
export const BorrowModal: React.FC<Props> = ({ open, onClose, onSubmit }) => {
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  // Start clean each time rather than resurrecting the previous entry.
  useEffect(() => {
    if (!open) {
      setItemName('');
      setQuantity('');
      setNotes('');
    }
  }, [open]);

  const valid = itemName.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const ok = await onSubmit({
        itemId: null,
        itemName: itemName.trim(),
        quantity: quantity.trim(),
        notes: notes.trim(),
      });
      if (ok) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  // See GuestInstrumentSheet: AnimatePresence left an invisible full-screen
  // wrapper mounted after closing, which blocked every tap.
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Log borrowed item"
    >
      <ScrollLock />
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs animate-overlay"
        onClick={onClose}
      />
      <div className="animate-sheet-solid relative w-full max-w-md bg-[#1E1E1E] rounded-t-3xl sm:rounded-xl shadow-2xl border border-[#2A2A2A] overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A2A]">
          <h2 className="font-bold text-white text-sm">What are you taking?</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-[#2A2A2A]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5" htmlFor="borrow-item">
              Item
            </label>
            <input
              id="borrow-item"
              autoFocus
              autoComplete="off"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="What you took"
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5" htmlFor="borrow-qty">
              How much
              <span className="text-gray-500 font-normal normal-case ml-1">(optional)</span>
            </label>
            <input
              id="borrow-qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 50 mL, 2 tubes, a pinch"
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5" htmlFor="borrow-notes">
              Note
              <span className="text-gray-500 font-normal normal-case ml-1">(optional)</span>
            </label>
            <input
              id="borrow-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. for a transfection, will return the rest"
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-gray-600"
            />
          </div>

          <button
            type="submit"
            disabled={!valid || submitting}
            className="w-full py-3 rounded-lg bg-primary hover:bg-orange-600 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {submitting ? 'Saving…' : 'Log it'}
          </button>
        </form>
      </div>
    </div>
  );
};
