import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { UrgencyLevel } from '../types';

const CATEGORIES = [
  'Reagents',
  'Resins & Media',
  'Antibodies',
  'Plasticware',
  'Consumables',
  'Equipment',
];

export const EditPurchaseModal: React.FC = () => {
  const { editingPurchase, setEditingPurchase, editPurchase } = useApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [category, setCategory] = useState('Reagents');
  const [priority, setPriority] = useState<UrgencyLevel>('normal');
  const [preferredCompany, setPreferredCompany] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editingPurchase) {
      setTitle(editingPurchase.title);
      setDescription(editingPurchase.description);
      setQuantity(editingPurchase.quantity);
      setCategory(editingPurchase.category);
      setPriority(editingPurchase.priority);
      setPreferredCompany(editingPurchase.preferredCompany ?? '');
    }
  }, [editingPurchase]);

  useEffect(() => {
    if (!editingPurchase) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditingPurchase(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editingPurchase, setEditingPurchase]);

  if (!editingPurchase) return null;

  const isValid = title.trim().length > 0 && quantity.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await editPurchase(editingPurchase.id, {
        title: title.trim(),
        description: description.trim(),
        quantity: quantity.trim(),
        category,
        priority,
        preferredCompany: preferredCompany.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingPurchase(null)} />
      <div className="relative w-full max-w-md max-h-[90vh] bg-[#1E1E1E] border border-[#2A2A2A] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-[#1E1E1E] border-b border-[#2A2A2A] px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-white">Edit request</h2>
          <button onClick={() => setEditingPurchase(null)} aria-label="Close" className="text-gray-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Item name
            </label>
            <input
              className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Quantity
              </label>
              <input
                className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <select
                className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'normal', 'urgent', 'critical'] as UrgencyLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setPriority(lvl)}
                  className={`py-1.5 rounded-md text-xs font-medium border capitalize text-center transition-colors ${
                    priority === lvl
                      ? lvl === 'urgent' || lvl === 'critical'
                        ? 'bg-red-500/10 border-red-500/30 text-red-400 font-bold'
                        : 'bg-primary/10 border-primary text-primary font-bold'
                      : 'bg-[#161616] border-[#2A2A2A] text-gray-400 hover:bg-[#2A2A2A]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Preferred vendor
              <span className="text-gray-500 font-normal normal-case ml-1">(optional)</span>
            </label>
            <input
              className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="e.g. Merck, Thermo Fisher..."
              value={preferredCompany}
              onChange={(e) => setPreferredCompany(e.target.value)}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-[#1E1E1E] border-t border-[#2A2A2A] px-5 py-4 flex gap-3">
          <button
            onClick={() => setEditingPurchase(null)}
            className="flex-1 py-2.5 text-sm font-medium text-gray-300 bg-[#2A2A2A] rounded-md hover:bg-[#333] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!isValid || submitting}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
