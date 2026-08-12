import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Vendor, VendorType } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  editVendor: Vendor | null;
}

export const AddVendorModal: React.FC<Props> = ({ open, onClose, editVendor: editItem }) => {
  const { addVendor, editVendor } = useApp();

  const [name, setName] = useState('');
  const [type, setType] = useState<VendorType>('direct');
  const [comment, setComment] = useState('');
  const [contact, setContact] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && editItem) {
      setName(editItem.name);
      setType(editItem.type);
      setComment(editItem.comment);
      setContact(editItem.contact);
      setPhotoUrl(editItem.photoUrl ?? '');
    } else if (open) {
      setName('');
      setType('direct');
      setComment('');
      setContact('');
      setPhotoUrl('');
    }
  }, [open, editItem]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      if (editItem) {
        await editVendor(editItem.id, {
          name: name.trim(),
          type,
          comment: comment.trim(),
          contact: contact.trim(),
          photoUrl: photoUrl.trim(),
        });
      } else {
        await addVendor({
          name: name.trim(),
          type,
          comment: comment.trim(),
          contact: contact.trim(),
          photoUrl: photoUrl.trim(),
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const TYPES: { id: VendorType; label: string }[] = [
    { id: 'direct', label: 'Direct Vendor' },
    { id: 'third_party', label: '3rd Party' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] bg-[#1E1E1E] border border-[#2A2A2A] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A2A] sticky top-0 bg-[#1E1E1E] z-10">
          <h2 className="font-bold text-white text-sm">
            {editItem ? 'Edit Vendor' : 'Add Vendor'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-[#2A2A2A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-8 sm:pb-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Vendor Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Merck, Thermo Fisher, SRL..."
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={`py-2.5 px-3 rounded-lg text-xs font-medium border text-center transition-colors ${
                    type === t.id
                      ? 'bg-primary/10 border-primary text-primary font-semibold'
                      : 'bg-background border-[#2A2A2A] text-gray-400 hover:bg-[#2A2A2A]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Contact (Phone / Email)
            </label>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="e.g. +91 98765 43210 or sales@vendor.com"
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Photo URL
            </label>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Special Comment
            </label>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Reliable for antibodies, ships within 3 days..."
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-gray-600 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="w-full py-3 bg-primary text-white font-semibold rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving
              ? editItem ? 'Saving...' : 'Adding...'
              : editItem ? 'Save Changes' : 'Add Vendor'}
          </button>
        </form>
      </div>
    </div>
  );
};
