import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { InventoryItem } from '../types';

interface Props {
  target: { item: InventoryItem; type: 'consume' | 'restock' | 'move' } | null;
  onClose: () => void;
}

const CONFIG = {
  consume: {
    title: 'Record usage',
    icon: 'remove_circle',
    color: 'text-red-400',
    buttonColor: 'bg-red-500 hover:bg-red-600',
    buttonLabel: 'Record',
    placeholder: 'Amount used',
  },
  restock: {
    title: 'Restock item',
    icon: 'add_circle',
    color: 'text-emerald-400',
    buttonColor: 'bg-emerald-600 hover:bg-emerald-700',
    buttonLabel: 'Restock',
    placeholder: 'Amount to add',
  },
  move: {
    title: 'Move item',
    icon: 'swap_horiz',
    color: 'text-blue-400',
    buttonColor: 'bg-blue-600 hover:bg-blue-700',
    buttonLabel: 'Move',
    placeholder: '',
  },
};

export const InventoryActionModal: React.FC<Props> = ({ target, onClose }) => {
  const { consumeItem, restockItem, moveItem, inventoryItems } = useApp();
  const [quantity, setQuantity] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (target) {
      setQuantity('');
      setLocation('');
      setNotes('');
    }
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [target, onClose]);

  if (!target) return null;

  const { item, type } = target;
  const cfg = CONFIG[type];

  const isQuantityAction = type === 'consume' || type === 'restock';
  const isValid = isQuantityAction
    ? Number(quantity) > 0
    : location.trim().length > 0;

  const existingLocations = Array.from(
    new Set(inventoryItems.map((i) => i.location).filter(Boolean))
  ).sort();

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      if (type === 'consume') {
        await consumeItem(item, Number(quantity), notes.trim() || undefined);
      } else if (type === 'restock') {
        await restockItem(item, Number(quantity), notes.trim() || undefined);
      } else {
        await moveItem(item, location.trim(), notes.trim() || undefined);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#1E1E1E] border border-[#2A2A2A] rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-[#2A2A2A] flex items-center gap-3">
          <span className={`material-symbols-outlined text-[22px] ${cfg.color}`}>{cfg.icon}</span>
          <div>
            <h2 className="text-base font-bold text-white">{cfg.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{item.name} · {item.quantity} {item.unit} in stock</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-auto text-gray-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isQuantityAction && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Quantity ({item.unit})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                max={type === 'consume' ? item.quantity : undefined}
                className="w-full px-3 py-2.5 bg-[#161616] border border-[#2A2A2A] rounded-md text-lg font-semibold text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-center"
                placeholder={cfg.placeholder}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                autoFocus
              />
              {type === 'consume' && Number(quantity) > item.quantity && (
                <p className="text-xs text-red-400 mt-1">Cannot exceed current stock ({item.quantity} {item.unit})</p>
              )}
            </div>
          )}

          {type === 'move' && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                New location
              </label>
              {item.location && (
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                  Currently: {item.location}
                </p>
              )}
              <input
                className="w-full px-3 py-2.5 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="e.g. Cold Room, Fridge 2, Shelf B"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                list="move-location-suggestions"
                autoFocus
              />
              {existingLocations.length > 0 && (
                <datalist id="move-location-suggestions">
                  {existingLocations.map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Notes <span className="text-gray-500 font-normal normal-case">(optional)</span>
            </label>
            <input
              className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder={type === 'consume' ? 'e.g. Used for Western Blot' : type === 'restock' ? 'e.g. Received from Qiagen order' : 'e.g. Moved for easy access'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#2A2A2A] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-300 bg-[#2A2A2A] rounded-md hover:bg-[#333] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!isValid || submitting || (type === 'consume' && Number(quantity) > item.quantity)}
            className={`flex-1 py-2.5 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${cfg.buttonColor}`}
          >
            {submitting ? 'Saving...' : cfg.buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
