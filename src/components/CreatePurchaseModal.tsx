import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { UrgencyLevel } from '../types';
import { SHEET_SPRING } from '../lib/motion';
import { ScrollLock } from '../lib/useScrollLock';

export const CreatePurchaseModal: React.FC = () => {
  const { createPurchase } = useApp();
  const { isCreateModalOpen, setIsCreateModalOpen } = useUI();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [preferredCompany, setPreferredCompany] = useState('');
  const [priority, setPriority] = useState<UrgencyLevel>('normal');
  const [category, setCategory] = useState('Reagents');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isCreateModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCreateModalOpen(false);
        setStep(1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isCreateModalOpen, setIsCreateModalOpen]);

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1 && title.trim()) setStep(2);
    else if (step === 2 && quantity.trim()) setStep(3);
    else if (step === 3) void handleSubmit();
  };

  const handleSubmit = async () => {
    if (!title.trim() || !quantity.trim()) return;
    setSubmitting(true);
    try {
      await createPurchase({
        title: title.trim(),
        description: description.trim(),
        quantity: quantity.trim(),
        preferredCompany: preferredCompany.trim() || undefined,
        priority,
        category,
      });
      setStep(1);
      setTitle('');
      setDescription('');
      setQuantity('');
      setPreferredCompany('');
      setPriority('normal');
      setCategory('Reagents');
      setIsCreateModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const suggestions = [
    'Cryo Grids',
    'Ni-NTA Resin',
    'Anti-His Antibody',
    'PCR Tips (10 µL)',
    'Ampicillin',
    'Taq Polymerase',
    'LB Agar Plates',
    'RNase AWAY',
  ];

  const categories = [
    'Reagents',
    'Resins & Media',
    'Antibodies',
    'Plasticware',
    'Consumables',
    'Equipment',
  ];

  const close = () => {
    setIsCreateModalOpen(false);
    setStep(1);
  };

  return (
    <AnimatePresence>
      {isCreateModalOpen && (
        <motion.div
          key="create-purchase"
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <ScrollLock />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={SHEET_SPRING}
            className="w-full max-w-md bg-[#1E1E1E] rounded-t-3xl sm:rounded-xl shadow-2xl border border-[#2A2A2A] overflow-hidden max-h-[90vh] overflow-y-auto"
          >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2A]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                New Purchase · Step {step} of 3
              </span>
            </div>
            <button
              onClick={close}
              className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-[#2A2A2A] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleNext} className="p-6 pb-8 sm:pb-6">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-bold text-white mb-1">
                    What do you need?
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Type reagent, antibody, or lab consumable name
                  </p>
                  <input
                    type="text"
                    autoFocus
                    required
                    placeholder="e.g. Cryo Grids, Ni-NTA Resin..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-medium placeholder:text-gray-600"
                  />
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-gray-500 block mb-2">
                    POPULAR IN LAB
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setTitle(item)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          title === item
                            ? 'bg-primary text-white border-primary'
                            : 'bg-background text-gray-400 border-[#2A2A2A] hover:bg-[#2A2A2A]'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Usage Note (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. For protein purification of membrane targets."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-gray-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!title.trim()}
                  className="w-full py-3.5 bg-primary text-white font-semibold rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-bold text-white mb-1">
                    How much do you need?
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Specify volume, pack count, or weight
                  </p>
                  <input
                    type="text"
                    autoFocus
                    required
                    placeholder="e.g. 100 mL, 2 boxes, 5 packs, 50 g"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-medium placeholder:text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Category
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`py-2 px-3 rounded-lg text-xs font-medium border text-left transition-colors ${
                          category === cat
                            ? 'bg-primary/10 border-primary text-primary font-semibold'
                            : 'bg-background border-[#2A2A2A] text-gray-400 hover:bg-[#2A2A2A]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-1/3 py-3 bg-[#2A2A2A] text-gray-300 font-semibold rounded-lg text-sm hover:bg-[#333] transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!quantity.trim()}
                    className="w-2/3 py-3 bg-primary text-white font-semibold rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-bold text-white mb-1">
                    Preferred Vendor (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Merck, Thermo Fisher, Cytiva..."
                    value={preferredCompany}
                    onChange={(e) => setPreferredCompany(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-medium placeholder:text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Priority Level
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['normal', 'urgent', 'critical'] as UrgencyLevel[]).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setPriority(lvl)}
                        className={`py-2 px-2 rounded-lg text-xs font-medium border capitalize text-center transition-colors ${
                          priority === lvl
                            ? lvl === 'urgent' || lvl === 'critical'
                              ? 'bg-red-500/10 border-red-500/30 text-red-400 font-bold'
                              : 'bg-primary/10 border-primary text-primary font-bold'
                            : 'bg-background border-[#2A2A2A] text-gray-400 hover:bg-[#2A2A2A]'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs text-orange-200 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    Your request will be visible to all lab members and procurement
                    in-charge instantly.
                  </span>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-1/3 py-3 bg-[#2A2A2A] text-gray-300 font-semibold rounded-lg text-sm hover:bg-[#333] transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSubmit()}
                    className="w-2/3 py-3 bg-primary text-white font-semibold rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    {submitting ? 'Submitting…' : 'Submit Request'}
                  </button>
                </div>
              </motion.div>
            )}
          </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
