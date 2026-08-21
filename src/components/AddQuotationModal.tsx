import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ReceiptIndianRupee, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Quotation } from '../types';
import { SHEET_SPRING } from '../lib/motion';
import { ScrollLock } from '../lib/useScrollLock';

interface AddQuotationModalProps {
  purchaseId: string;
  isOpen: boolean;
  onClose: () => void;
  editingQuotation?: Quotation | null;
}

export const AddQuotationModal: React.FC<AddQuotationModalProps> = ({
  purchaseId,
  isOpen,
  onClose,
  editingQuotation,
}) => {
  const { addQuotation, editQuotation, vendors, purchases } = useApp();
  const isEditing = !!editingQuotation;

  const [vendor, setVendor] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && editingQuotation) {
      setVendor(editingQuotation.vendor);
      setPrice(String(editingQuotation.price));
      setNotes(editingQuotation.notes ?? '');
    } else if (!isOpen) {
      setVendor('');
      setPrice('');
      setNotes('');
    }
  }, [isOpen, editingQuotation]);

  const allVendorNames = useMemo(() => {
    const names = new Set(vendors.map((v) => v.name));
    for (const p of purchases) {
      for (const q of p.quotations) {
        names.add(q.vendor);
      }
    }
    return [...names];
  }, [vendors, purchases]);

  const frequentVendors = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const p of purchases) {
      for (const q of p.quotations) {
        freq[q.vendor] = (freq[q.vendor] ?? 0) + 1;
      }
    }
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) return sorted.slice(0, 6).map(([name]) => name);
    return allVendorNames.slice(0, 6);
  }, [purchases, allVendorNames]);

  const suggestions = useMemo(() => {
    if (!vendor.trim()) return [];
    const q = vendor.toLowerCase();
    return allVendorNames
      .filter((v) => v.toLowerCase().includes(q) && v !== vendor)
      .slice(0, 5);
  }, [vendor, allVendorNames]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!showSuggestions) return;
    const onClick = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showSuggestions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor.trim() || !price) return;
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) return;

    setSubmitting(true);
    try {
      if (isEditing && editingQuotation) {
        const ok = await editQuotation(purchaseId, editingQuotation.id, {
          vendor: vendor.trim(),
          price: numPrice,
          notes: notes.trim() || undefined,
        });
        if (ok) onClose();
      } else {
        await addQuotation(purchaseId, {
          vendor: vendor.trim(),
          price: numPrice,
          notes: notes.trim() || undefined,
        });
        setVendor('');
        setPrice('');
        setNotes('');
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="add-quotation"
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <ScrollLock />
          {/* Dim on its own layer, entry in CSS — see PurchaseThreadModal. */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs animate-overlay"
            exit={{ opacity: 0 }}
          />
          <motion.div
            exit={{ y: '100%' }}
            transition={SHEET_SPRING}
            className="animate-sheet-solid relative w-full max-w-md bg-[#1E1E1E] rounded-t-3xl sm:rounded-xl shadow-2xl border border-[#2A2A2A] overflow-hidden"
          >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2A]">
            <div className="flex items-center gap-2">
              <ReceiptIndianRupee className="w-4 h-4 text-purple-400" />
              <h3 className="font-bold text-white text-sm">{isEditing ? 'Edit Quotation' : 'Record Vendor Quotation'}</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-[#2A2A2A]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Vendor Name
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  required
                  autoComplete="off"
                  placeholder="Type to search vendors…"
                  value={vendor}
                  onChange={(e) => {
                    setVendor(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm font-medium focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none placeholder:text-gray-600"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-10 w-full mt-1 bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg shadow-xl overflow-hidden"
                  >
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setVendor(s);
                          setShowSuggestions(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {frequentVendors.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {frequentVendors.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setVendor(v);
                        setShowSuggestions(false);
                      }}
                      className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                        vendor === v
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                          : 'bg-[#2A2A2A] hover:bg-[#333] text-gray-400 border-[#333]'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Quotation Price (INR)
              </label>
              <input
                type="number"
                required
                min={0}
                step="any"
                placeholder="e.g. 27800"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm font-bold focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none placeholder:text-gray-600"
              />

            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Notes / Discount details
              </label>
              <input
                type="text"
                placeholder="e.g. Includes 10% academic discount"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none placeholder:text-gray-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !vendor.trim() || !price}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              {submitting ? 'Saving…' : isEditing ? 'Update Quotation' : 'Save Quotation'}
            </button>
          </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
