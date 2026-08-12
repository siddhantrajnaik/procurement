import { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Phone, Mail, Trash2, Pencil } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Vendor, VendorType } from '../types';
import { AddVendorModal } from './AddVendorModal';
import { ConfirmModal } from './ConfirmModal';
import { timeAgo } from '../lib/format';

const TABS: { id: 'all' | VendorType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'direct', label: 'Direct' },
  { id: 'third_party', label: '3rd Party' },
];

interface Props {
  onBack: () => void;
}

export const VendorsView: React.FC<Props> = ({ onBack }) => {
  const { vendors, removeVendor } = useApp();
  const [filter, setFilter] = useState<'all' | VendorType>('all');
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      if (filter !== 'all' && v.type !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          v.name.toLowerCase().includes(q) ||
          v.comment.toLowerCase().includes(q) ||
          v.contact.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vendors, filter, search]);

  const typeLabel = (t: VendorType) => (t === 'direct' ? 'Direct' : '3rd Party');

  return (
    <div className="flex-1 flex flex-col pb-28 pt-4 max-w-3xl mx-auto w-full px-4 space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-extrabold text-white text-lg tracking-tight">
            Vendor Directory
          </h1>
          <p className="text-xs text-gray-400">
            {vendors.length} vendor{vendors.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button
          onClick={() => {
            setEditingVendor(null);
            setIsAddOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Vendor
        </button>
      </div>

      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]">
          search
        </span>
        <input
          className="w-full pl-9 pr-4 py-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-white placeholder:text-gray-500"
          placeholder="Search vendors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-4 text-sm font-medium border-b border-[#2A2A2A] overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`whitespace-nowrap pb-2 transition-colors ${
              filter === tab.id
                ? 'text-primary border-b-2 border-primary font-semibold'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E]">
          <span className="material-symbols-outlined text-gray-600 text-4xl mb-3">
            storefront
          </span>
          <h3 className="text-white font-medium text-sm mb-1">No vendors found</h3>
          <p className="text-gray-400 text-sm max-w-xs">
            {vendors.length === 0
              ? 'Add your first vendor to build the directory.'
              : 'No vendors match this filter.'}
          </p>
          {vendors.length === 0 && (
            <button
              onClick={() => {
                setEditingVendor(null);
                setIsAddOpen(true);
              }}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors"
            >
              Add first vendor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              typeLabel={typeLabel}
              onEdit={() => {
                setEditingVendor(vendor);
                setIsAddOpen(true);
              }}
              onDelete={() => setDeletingVendor(vendor)}
            />
          ))}
        </div>
      )}

      <AddVendorModal
        open={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          setEditingVendor(null);
        }}
        editVendor={editingVendor}
      />

      <ConfirmModal
        open={!!deletingVendor}
        title="Remove vendor?"
        message={`"${deletingVendor?.name}" will be permanently removed from the directory.`}
        confirmLabel="Remove"
        onConfirm={async () => {
          if (deletingVendor) await removeVendor(deletingVendor.id);
          setDeletingVendor(null);
        }}
        onCancel={() => setDeletingVendor(null)}
      />
    </div>
  );
};

function VendorCard({
  vendor,
  typeLabel,
  onEdit,
  onDelete,
}: {
  vendor: Vendor;
  typeLabel: (t: VendorType) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const initials = vendor.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const isDirect = vendor.type === 'direct';
  const hasPhone = vendor.contact && /[\d+]/.test(vendor.contact);
  const hasEmail = vendor.contact && vendor.contact.includes('@');

  return (
    <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-3">
        {vendor.photoUrl ? (
          <img
            src={vendor.photoUrl}
            alt={vendor.name}
            className="w-11 h-11 rounded-lg object-cover border border-[#2A2A2A] shrink-0 bg-background"
          />
        ) : (
          <div
            className={`w-11 h-11 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border ${
              isDirect
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            }`}
          >
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-white text-sm truncate">{vendor.name}</h3>
            <span
              className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isDirect
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
              }`}
            >
              {typeLabel(vendor.type)}
            </span>
          </div>

          {vendor.contact && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
              {hasEmail ? (
                <Mail className="w-3 h-3 text-gray-500" />
              ) : hasPhone ? (
                <Phone className="w-3 h-3 text-gray-500" />
              ) : null}
              <span className="truncate">{vendor.contact}</span>
            </div>
          )}
        </div>
      </div>

      {vendor.comment && (
        <p className="text-xs text-gray-400 leading-relaxed bg-background p-2.5 rounded-lg border border-[#2A2A2A]">
          {vendor.comment}
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-gray-600">{timeAgo(vendor.createdAt)}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
