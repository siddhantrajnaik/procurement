import { useEffect, useState } from 'react';
import { ScrollLock } from '../lib/useScrollLock';
import { SampleBox } from '../types';

const CONDITIONS = ['-80°C', '-20°C', '4°C', 'RT', 'LN₂'];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; condition: string; location: string }) => Promise<void>;
  editBox: SampleBox | null;
  existingLocations: string[];
}

export const AddBoxModal: React.FC<Props> = ({ open, onClose, onSubmit, editBox, existingLocations }) => {
  const [name, setName] = useState('');
  const [condition, setCondition] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (editBox) {
        setName(editBox.name);
        setCondition(editBox.condition);
        setLocation(editBox.location);
      } else {
        setName('');
        setCondition('');
        setLocation('');
      }
    }
  }, [open, editBox]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isValid = name.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), condition, location: location.trim() });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <ScrollLock />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] bg-[#1E1E1E] border border-[#2A2A2A] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-y-auto animate-sheet">
        <div className="sticky top-0 bg-[#1E1E1E] border-b border-[#2A2A2A] px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-white">{editBox ? 'Edit box' : 'New storage box'}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Box name</label>
            <input
              className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="e.g. COM3, SID4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Storage condition</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(condition === c ? '' : c)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    condition === c
                      ? 'bg-primary/15 text-primary border-primary/30'
                      : 'bg-[#161616] text-gray-400 border-[#2A2A2A] hover:text-gray-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Or type custom condition..."
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Location</label>
            <input
              className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="e.g. Freezer Room, Shelf 2"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              list="box-location-suggestions"
            />
            {existingLocations.length > 0 && (
              <datalist id="box-location-suggestions">
                {existingLocations.map((loc) => <option key={loc} value={loc} />)}
              </datalist>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-[#1E1E1E] border-t border-[#2A2A2A] px-5 py-4 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-300 bg-[#2A2A2A] rounded-md hover:bg-[#333] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!isValid || submitting}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : editBox ? 'Save' : 'Create box'}
          </button>
        </div>
      </div>
    </div>
  );
};
