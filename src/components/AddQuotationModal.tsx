import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Check, FileUp } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface AddQuotationModalProps {
  purchaseId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AddQuotationModal: React.FC<AddQuotationModalProps> = ({
  purchaseId,
  isOpen,
  onClose,
}) => {
  const { addQuotation } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const [vendor, setVendor] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor.trim() || !price) return;
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) return;

    setSubmitting(true);
    try {
      await addQuotation(purchaseId, {
        vendor: vendor.trim(),
        price: numPrice,
        notes: notes.trim() || undefined,
        file: file ?? undefined,
      });
      setVendor('');
      setPrice('');
      setNotes('');
      setFile(null);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const vendorPresets = [
    'Merck',
    'Thermo Fisher',
    'Cytiva',
    'Qiagen',
    'Abcam',
    'HiMedia',
    'Eppendorf',
    'Sigma-Aldrich',
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs">
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          className="w-full max-w-md bg-[#1E1E1E] rounded-t-3xl sm:rounded-xl shadow-2xl border border-[#2A2A2A] overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2A]">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-purple-400" />
              <h3 className="font-bold text-white text-sm">Upload Vendor Quotation</h3>
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
              <input
                type="text"
                required
                placeholder="e.g. Merck, Thermo Fisher"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm font-medium focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none placeholder:text-gray-600"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {vendorPresets.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVendor(v)}
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
              {parseFloat(price) > 25000 && (
                <p className="text-[11px] text-amber-400 font-medium mt-1">
                  Quote exceeds 25,000 — will require PI approval.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Attach Quotation (PDF / Image)
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-[#2A2A2A] bg-background hover:border-purple-500/40 text-gray-400 hover:text-purple-300 transition-colors text-xs font-medium"
              >
                <FileUp className="w-4 h-4" />
                {file ? file.name : 'Choose file (max 10 MB)'}
              </button>
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
              {submitting ? 'Uploading…' : 'Upload Quotation'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
