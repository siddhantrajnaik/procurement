import { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EquipmentCard } from './EquipmentCard';
import { EquipmentThreadModal } from './EquipmentThreadModal';
import { AddEquipmentModal } from './AddEquipmentModal';

const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'working', label: 'Working' },
  { id: 'needs_attention', label: 'Attention' },
  { id: 'down', label: 'Down' },
  { id: 'under_service', label: 'Service' },
];

interface Props {
  onBack: () => void;
}

export const EquipmentView: React.FC<Props> = ({ onBack }) => {
  const { equipment } = useApp();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const filtered = useMemo(() => {
    return equipment.filter((eq) => {
      if (filter !== 'all' && eq.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          eq.name.toLowerCase().includes(q) ||
          eq.manufacturer.toLowerCase().includes(q) ||
          eq.model.toLowerCase().includes(q) ||
          eq.location.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [equipment, filter, search]);

  const selectedEquipment = useMemo(
    () => equipment.find((e) => e.id === selectedId) ?? null,
    [equipment, selectedId]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: equipment.length };
    for (const eq of equipment) {
      counts[eq.status] = (counts[eq.status] ?? 0) + 1;
    }
    return counts;
  }, [equipment]);

  const totalOpenIssues = useMemo(
    () => equipment.reduce((sum, eq) => sum + eq.issues.filter((i) => i.status !== 'fixed').length, 0),
    [equipment]
  );

  return (
    <div className="flex-1 w-full mx-auto pb-24 md:pb-8 flex flex-col max-w-3xl px-4 md:px-0">
      {/* Header */}
      <div className="py-4 mt-2 md:mt-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Equipment
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-md hover:bg-orange-600 transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Equipment
          </button>
        </div>

        {/* Stats bar */}
        {equipment.length > 0 && (
          <div className="font-mono text-xs text-gray-300 bg-[#1E1E1E] p-3 rounded-md border border-[#2A2A2A] flex flex-wrap items-center gap-x-3 gap-y-1 divide-x divide-[#2A2A2A]">
            <span className="pr-3">
              <span className="font-bold text-white">{equipment.length}</span> instruments
            </span>
            {(statusCounts.down ?? 0) > 0 && (
              <span className="px-3 text-red-300 font-semibold">
                {statusCounts.down} down
              </span>
            )}
            {(statusCounts.needs_attention ?? 0) > 0 && (
              <span className="px-3 text-amber-300 font-semibold">
                {statusCounts.needs_attention} need attention
              </span>
            )}
            {totalOpenIssues > 0 && (
              <span className="px-3 text-red-300">
                {totalOpenIssues} open issue{totalOpenIssues > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]">
            search
          </span>
          <input
            className="w-full pl-9 pr-4 py-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-white placeholder:text-gray-500"
            placeholder="Search equipment…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="py-2 overflow-x-auto no-scrollbar flex gap-6 text-sm font-medium sticky top-16 z-40 bg-background border-b border-[#2A2A2A] mb-4">
        {STATUS_FILTERS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`whitespace-nowrap transition-colors pb-2 ${
              filter === tab.id
                ? 'text-primary border-b-2 border-primary font-semibold'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
            {(statusCounts[tab.id] ?? 0) > 0 && (
              <span className="ml-1 text-[10px] text-gray-500">({statusCounts[tab.id]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Equipment grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E]">
            <span className="material-symbols-outlined text-gray-600 text-4xl mb-3">precision_manufacturing</span>
            <h3 className="text-white font-medium text-sm mb-1">
              {equipment.length === 0 ? 'No equipment registered' : 'No equipment matches'}
            </h3>
            <p className="text-gray-400 text-sm max-w-xs">
              {equipment.length === 0
                ? 'Add your lab instruments to track their status, issues, and maintenance.'
                : 'Try a different search or filter.'}
            </p>
          </div>
        ) : (
          filtered.map((eq) => (
            <EquipmentCard
              key={eq.id}
              equipment={eq}
              onClick={() => setSelectedId(eq.id)}
            />
          ))
        )}
      </div>

      {/* Thread modal */}
      <AnimatePresence>
        {selectedEquipment && (
          <EquipmentThreadModal
            key="eq-thread"
            equipment={selectedEquipment}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>

      {/* Add modal */}
      <AddEquipmentModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
};
