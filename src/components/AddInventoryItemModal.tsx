import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { InventoryItem, NewInventoryItemInput } from '../types';

const CATEGORIES = [
  'Reagents',
  'Consumables',
  'Antibodies',
  'Resins & Media',
  'Plasticware',
  'Equipment',
  'Kits',
  'Chemicals',
  'Buffers',
  'General',
];

const UNITS = ['mL', 'µL', 'L', 'g', 'mg', 'µg', 'pcs', 'packs', 'boxes', 'bottles', 'vials', 'plates', 'strips'];

interface Props {
  open: boolean;
  onClose: () => void;
  editItem: InventoryItem | null;
}

export const AddInventoryItemModal: React.FC<Props> = ({ open, onClose, editItem }) => {
  const { addInventoryItem, editInventoryItem, inventoryItems } = useApp();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [location, setLocation] = useState('');
  const [lowStock, setLowStock] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const existingLocations = useMemo(() => {
    const locs = new Set(inventoryItems.map((i) => i.location).filter(Boolean));
    return Array.from(locs).sort();
  }, [inventoryItems]);

  useEffect(() => {
    if (open) {
      if (editItem) {
        setName(editItem.name);
        setCategory(editItem.category);
        setQuantity(String(editItem.quantity));
        setUnit(editItem.unit);
        setLocation(editItem.location);
        setLowStock(editItem.lowStockThreshold != null ? String(editItem.lowStockThreshold) : '');
        setNotes(editItem.notes ?? '');
      } else {
        setName('');
        setCategory('General');
        setQuantity('');
        setUnit('pcs');
        setLocation('');
        setLowStock('');
        setNotes('');
      }
    }
  }, [open, editItem]);

  if (!open) return null;

  const isValid = name.trim().length > 0 && Number(quantity) >= 0 && quantity !== '';

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      if (editItem) {
        await editInventoryItem(editItem, {
          name: name.trim(),
          category,
          quantity: Number(quantity),
          unit,
          location: location.trim(),
          lowStockThreshold: lowStock ? Number(lowStock) : null,
          notes: notes.trim() || undefined,
        });
      } else {
        const input: NewInventoryItemInput = {
          name: name.trim(),
          category,
          quantity: Number(quantity),
          unit,
          location: location.trim(),
          lowStockThreshold: lowStock ? Number(lowStock) : null,
          notes: notes.trim() || undefined,
        };
        await addInventoryItem(input);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] bg-[#1E1E1E] border border-[#2A2A2A] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-[#1E1E1E] border-b border-[#2A2A2A] px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-white">
            {editItem ? 'Edit item' : 'Add to inventory'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
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
              placeholder="e.g. Ni-NTA Resin"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Quantity
              </label>
              <input
                type="number"
                min="0"
                step="any"
                className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Unit
              </label>
              <select
                className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Location
            </label>
            <input
              className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="e.g. Cold Room, Fridge 2, Shelf B"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              list="location-suggestions"
            />
            {existingLocations.length > 0 && (
              <datalist id="location-suggestions">
                {existingLocations.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Low stock alert
              <span className="text-gray-500 font-normal normal-case ml-1">(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Alert when quantity drops below..."
              value={lowStock}
              onChange={(e) => setLowStock(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Notes
              <span className="text-gray-500 font-normal normal-case ml-1">(optional)</span>
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
              placeholder="Any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-[#1E1E1E] border-t border-[#2A2A2A] px-5 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-300 bg-[#2A2A2A] rounded-md hover:bg-[#333] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!isValid || submitting}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : editItem ? 'Save changes' : 'Add item'}
          </button>
        </div>
      </div>
    </div>
  );
};
