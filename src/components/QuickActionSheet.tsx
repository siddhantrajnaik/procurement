import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  CheckCircle2,
  ShoppingCart,
  Truck,
  Clock,
  Copy,
  Trash2,
  FileText,
} from 'lucide-react';
import { Purchase, PurchaseStatus } from '../types';
import { useApp } from '../context/AppContext';

interface QuickActionSheetProps {
  purchase: Purchase | null;
  onClose: () => void;
}

export const QuickActionSheet: React.FC<QuickActionSheetProps> = ({
  purchase,
  onClose,
}) => {
  const { updateStatus, showToast, deletePurchase } = useApp();

  useEffect(() => {
    if (!purchase) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [purchase, onClose]);

  if (!purchase) return null;

  const handleStatus = (status: PurchaseStatus) => {
    void updateStatus(purchase.id, status);
    onClose();
  };

  const handleCopy = () => {
    const text = `Procure: ${purchase.title} (${purchase.quantity}) requested by ${purchase.requestedBy?.name ?? 'unknown'} - Status: ${purchase.status}`;
    navigator.clipboard.writeText(text);
    showToast('Copied item details to clipboard!', 'info');
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center p-0 sm:p-4">
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="w-full max-w-md bg-[#1E1E1E] rounded-t-3xl sm:rounded-xl p-5 border border-[#2A2A2A] shadow-2xl space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
            <div>
              <h3 className="font-bold text-white text-base">{purchase.title}</h3>
              <p className="text-xs text-gray-500">Quick Actions</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-gray-500 hover:text-white hover:bg-[#2A2A2A]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
              Set Status
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleStatus('waiting')}
                className="py-2.5 px-3 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold flex items-center gap-2 border border-amber-500/20"
              >
                <Clock className="w-4 h-4" />
                Waiting Quotes
              </button>
              <button
                onClick={() => handleStatus('quotes')}
                className="py-2.5 px-3 rounded-lg bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-xs font-semibold flex items-center gap-2 border border-purple-500/20"
              >
                <FileText className="w-4 h-4" />
                Quotes Received
              </button>
              <button
                onClick={() => handleStatus('ordered')}
                className="py-2.5 px-3 rounded-lg bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 text-xs font-semibold flex items-center gap-2 border border-blue-500/20"
              >
                <ShoppingCart className="w-4 h-4" />
                Ordered
              </button>
              <button
                onClick={() => handleStatus('transit')}
                className="py-2.5 px-3 rounded-lg bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 text-xs font-semibold flex items-center gap-2 border border-indigo-500/20"
              >
                <Truck className="w-4 h-4" />
                Transit
              </button>
              <button
                onClick={() => handleStatus('delivered')}
                className="py-2.5 px-3 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs font-semibold flex items-center gap-2 border border-emerald-500/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                Delivered
              </button>
              <button
                onClick={() => handleStatus('closed')}
                className="py-2.5 px-3 rounded-lg bg-gray-500/10 text-gray-300 hover:bg-gray-500/20 text-xs font-semibold flex items-center gap-2 border border-gray-500/20"
              >
                <X className="w-4 h-4" />
                Closed
              </button>
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <button
              onClick={handleCopy}
              className="w-full text-left py-2.5 px-3 rounded-lg hover:bg-[#2A2A2A] text-xs font-medium text-gray-300 flex items-center gap-2.5 transition-colors"
            >
              <Copy className="w-4 h-4 text-gray-500" />
              Copy Purchase Info & Status
            </button>
            <button
              onClick={() => {
                void deletePurchase(purchase.id);
                onClose();
              }}
              className="w-full text-left py-2.5 px-3 rounded-lg hover:bg-red-500/10 text-xs font-medium text-red-400 flex items-center gap-2.5 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
              Delete Request
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
