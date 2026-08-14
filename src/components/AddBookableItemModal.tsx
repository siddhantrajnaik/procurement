import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

const COLORS = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#06B6D4', '#F97316',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AddBookableItemModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { addBookableItem } = useApp();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await addBookableItem({ name: name.trim(), description: description.trim(), color });
      setName('');
      setDescription('');
      setColor(COLORS[0]);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="add-bookable-item"
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
              <h3 className="font-bold text-white text-sm">Add Bookable Item</h3>
              <button onClick={onClose} className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-[#2A2A2A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AKTA, Ultracentrifuge, Grid Prep Bench"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm font-medium focus:ring-1 focus:ring-violet-500 focus:border-violet-500 outline-none placeholder:text-gray-600"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Optional notes about this item"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-violet-500 outline-none placeholder:text-gray-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Color</label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                        color === c ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {submitting ? 'Adding…' : 'Add Item'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
