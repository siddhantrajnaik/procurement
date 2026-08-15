import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EQUIPMENT_CATEGORIES, EquipmentCategory, equipmentIconSvg } from '../lib/equipmentIcons';
import { SHEET_SPRING } from '../lib/motion';
import { ScrollLock } from '../lib/useScrollLock';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AddEquipmentModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { addEquipment } = useApp();

  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [category, setCategory] = useState<EquipmentCategory>('other');
  const [location, setLocation] = useState('');
  const [serviceVendor, setServiceVendor] = useState('');
  const [serviceContact, setServiceContact] = useState('');
  const [servicePhone, setServicePhone] = useState('');
  const [notes, setNotes] = useState('');
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
      await addEquipment({
        name: name.trim(),
        model: model.trim(),
        manufacturer: manufacturer.trim(),
        category,
        location: location.trim(),
        serviceVendor: serviceVendor.trim(),
        serviceContactPerson: serviceContact.trim(),
        servicePhone: servicePhone.trim(),
        notes: notes.trim(),
      });
      setName('');
      setModel('');
      setManufacturer('');
      setCategory('other');
      setLocation('');
      setServiceVendor('');
      setServiceContact('');
      setServicePhone('');
      setNotes('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="add-equipment"
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
            className="animate-sheet-solid relative w-full max-w-md bg-[#1E1E1E] rounded-t-3xl sm:rounded-xl shadow-2xl border border-[#2A2A2A] overflow-hidden max-h-[90vh] flex flex-col"
          >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2A] shrink-0">
            <h3 className="font-bold text-white text-sm">Add Equipment</h3>
            <button onClick={onClose} className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-[#2A2A2A]">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Equipment Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Eppendorf 5424R Centrifuge"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-gray-600"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Manufacturer</label>
                <input
                  type="text"
                  placeholder="e.g. Eppendorf"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-primary outline-none placeholder:text-gray-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Model</label>
                <input
                  type="text"
                  placeholder="e.g. 5424R"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-primary outline-none placeholder:text-gray-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {EQUIPMENT_CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      category === c.value
                        ? 'bg-primary/20 text-primary border-primary/30'
                        : 'bg-[#2A2A2A] text-gray-400 border-[#333] hover:border-gray-400'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 inline-block"
                      dangerouslySetInnerHTML={{ __html: equipmentIconSvg(c.value) }}
                    />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Location</label>
              <input
                type="text"
                placeholder="e.g. Room 204, Bench 3"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-primary outline-none placeholder:text-gray-600"
              />
            </div>

            <div className="bg-background p-3 rounded-lg border border-[#2A2A2A] space-y-3">
              <p className="text-[11px] font-bold text-gray-500 uppercase">Service Contact</p>
              <input
                type="text"
                placeholder="Vendor / Company name"
                value={serviceVendor}
                onChange={(e) => setServiceVendor(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-primary outline-none placeholder:text-gray-600"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Contact person name"
                  value={serviceContact}
                  onChange={(e) => setServiceContact(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-primary outline-none placeholder:text-gray-600"
                />
                <input
                  type="tel"
                  placeholder="Phone number"
                  value={servicePhone}
                  onChange={(e) => setServicePhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-primary outline-none placeholder:text-gray-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Notes</label>
              <input
                type="text"
                placeholder="Any additional info"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-primary outline-none placeholder:text-gray-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="w-full py-3 bg-primary hover:bg-orange-600 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              {submitting ? 'Adding…' : 'Add Equipment'}
            </button>
          </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
