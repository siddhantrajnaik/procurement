import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const CreateListModal: React.FC<Props> = ({ open, onClose }) => {
  const { createLabList } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setTitle(''); setDescription(''); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await createLabList({ title: title.trim(), description: description.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] bg-[#1E1E1E] border border-[#2A2A2A] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A2A] sticky top-0 bg-[#1E1E1E] z-10">
          <h2 className="font-bold text-white text-sm">New List</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-[#2A2A2A] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-8 sm:pb-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">List name *</label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Enzyme Inventory, Chemical Stock, Vectors..."
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this list for?"
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-gray-600 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="w-full py-3 bg-primary text-white font-semibold rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Creating...' : 'Create List'}
          </button>
        </form>
      </div>
    </div>
  );
};
