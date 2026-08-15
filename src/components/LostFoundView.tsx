import { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, MapPin } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LostFoundItem, LostFoundStatus } from '../types';
import { avatarClasses } from '../lib/accent';
import { initialOf, timeAgo } from '../lib/format';
import { ReportLostItemModal } from './ReportLostItemModal';
import { LostFoundThreadModal } from './LostFoundThreadModal';

const TABS: { id: 'all' | LostFoundStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Lost' },
  { id: 'found', label: 'Found' },
  { id: 'resolved', label: 'Resolved' },
];

const STATUS_CFG: Record<LostFoundStatus, { label: string; bg: string; text: string; border: string }> = {
  open: { label: 'Lost', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  found: { label: 'Found', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  resolved: { label: 'Resolved', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
};

interface Props {
  onBack: () => void;
}

export const LostFoundView: React.FC<Props> = ({ onBack }) => {
  const { lostFoundItems } = useApp();
  const [filter, setFilter] = useState<'all' | LostFoundStatus>('all');
  const [search, setSearch] = useState('');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LostFoundItem | null>(null);

  const filtered = useMemo(() => {
    return lostFoundItems.filter((item) => {
      if (filter !== 'all' && item.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.locationLastSeen.toLowerCase().includes(q) ||
          (item.reportedBy?.name.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [lostFoundItems, filter, search]);

  const openCount = lostFoundItems.filter((i) => i.status === 'open').length;

  const liveItem = useMemo(
    () => (selectedItem ? lostFoundItems.find((i) => i.id === selectedItem.id) ?? null : null),
    [lostFoundItems, selectedItem]
  );

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
            Lost & Found
          </h1>
          <p className="text-xs text-gray-400">
            {openCount > 0
              ? `${openCount} item${openCount !== 1 ? 's' : ''} currently lost`
              : 'Nothing reported lost'}
          </p>
        </div>
        <button
          onClick={() => setIsReportOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Report Lost
        </button>
      </div>

      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]">
          search
        </span>
        <input
          className="w-full pl-9 pr-4 py-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-white placeholder:text-gray-500"
          placeholder="Search lost items..."
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
            search_off
          </span>
          <h3 className="text-white font-medium text-sm mb-1">Nothing here</h3>
          <p className="text-gray-400 text-sm max-w-xs">
            {lostFoundItems.length === 0
              ? 'No items reported lost. Hopefully it stays that way!'
              : 'No items match this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const cfg = STATUS_CFG[item.status];
            return (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="w-full text-left bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-4 space-y-2.5 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${avatarClasses(item.reportedBy?.accent)}`}>
                      {initialOf(item.reportedBy?.name ?? '?', item.reportedBy?.handle)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-white text-sm truncate">{item.title}</h3>
                      <p className="text-[11px] text-gray-500">
                        {item.reportedBy?.name ?? 'Someone'} · {timeAgo(item.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </div>

                {item.description && (
                  <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  {item.locationLastSeen ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{item.locationLastSeen}</span>
                    </div>
                  ) : (
                    <div />
                  )}
                  {item.responses.length > 0 && (
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
                      {item.responses.length}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <ReportLostItemModal
        open={isReportOpen}
        onClose={() => setIsReportOpen(false)}
      />

      <AnimatePresence>
        {liveItem && (
          <LostFoundThreadModal
            key="lf-thread"
            item={liveItem}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
