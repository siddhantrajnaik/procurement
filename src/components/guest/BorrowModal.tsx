import { useEffect, useMemo, useState } from 'react';
import { X, Check, Search } from 'lucide-react';
import { InventoryItem, NewLoanInput } from '../../types';
import { ScrollLock } from '../../lib/useScrollLock';

interface Props {
  /** The sheet owns its own presence animation, so it is always mounted. */
  open: boolean;
  items: InventoryItem[];
  onClose: () => void;
  onSubmit: (input: Omit<NewLoanInput, 'visitorName'>) => Promise<boolean>;
}

/**
 * Records what a visitor took away.
 *
 * Note what this deliberately does NOT do: it never calls `consumeItem`, so the
 * lab's stock counts are untouched. A guest mistyping a quantity should not be
 * able to make the inventory wrong — this is a statement about what left the
 * room, not an adjustment to what is on the shelf.
 */
export const BorrowModal: React.FC<Props> = ({ open, items, onClose, onSubmit }) => {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<InventoryItem | null>(null);
  const [freeText, setFreeText] = useState('');
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
      setSearch('');
      setPicked(null);
      setFreeText('');
      setQuantity('');
      setNotes('');
    }
  }, [open]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items.slice(0, 8);
    return items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8);
  }, [items, search]);

  // Either an inventory item is picked, or a name was typed for something that
  // was never in the inventory to begin with.
  const itemName = picked?.name ?? freeText.trim();
  const valid = itemName.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const ok = await onSubmit({
        itemId: picked?.id ?? null,
        itemName,
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
      <div
        className="animate-sheet-solid relative w-full max-w-md bg-[#1E1E1E] rounded-t-3xl sm:rounded-xl shadow-2xl border border-[#2A2A2A] overflow-hidden max-h-[90vh] flex flex-col"
      >
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
          {picked ? (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30">
              <span className="text-sm font-bold text-white truncate">{picked.name}</span>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="text-xs font-semibold text-gray-400 hover:text-white shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5" htmlFor="borrow-search">
                Item
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="borrow-search"
                  autoFocus
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setFreeText(e.target.value);
                  }}
                  placeholder="Search, or type anything"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-gray-600"
                />
              </div>

              {matches.length > 0 && (
                <div className="mt-2 space-y-1">
                  {matches.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setPicked(item);
                        setSearch('');
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg bg-background border border-[#2A2A2A] hover:border-primary/40 transition-colors"
                    >
                      <span className="text-sm text-gray-200">{item.name}</span>
                      {item.location && (
                        <span className="text-[11px] text-gray-600 ml-2">{item.location}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {search.trim() && (
                <p className="mt-2 text-[11px] text-gray-600">
                  Not in the list? Whatever you typed will be recorded as-is.
                </p>
              )}
            </div>
          )}

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
