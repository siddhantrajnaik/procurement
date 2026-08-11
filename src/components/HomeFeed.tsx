import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { PurchaseCard } from './PurchaseCard';
import { QuickActionSheet } from './QuickActionSheet';
import { Purchase } from '../types';
import { formatRupees } from '../lib/format';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'waiting', label: 'Requested' },
  { id: 'ordered', label: 'Ordered' },
  { id: 'transit', label: 'In transit' },
  { id: 'delivered', label: 'Delivered' },
];

export const HomeFeed: React.FC = () => {
  const {
    purchases,
    setSelectedPurchase,
    setIsCreateModalOpen,
    setEditingPurchase,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    currentUser,
  } = useApp();
  const [activeQuickPurchase, setActiveQuickPurchase] = useState<Purchase | null>(null);

  const filtered = useMemo(
    () =>
      purchases.filter((p) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matches =
            p.title.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            (p.requestedBy?.name.toLowerCase().includes(q) ?? false);
          if (!matches) return false;
        }
        if (filterStatus === 'all') return true;
        // "Requested" covers both pre-quote and quotes-received states.
        if (filterStatus === 'waiting') return p.status === 'waiting' || p.status === 'quotes';
        return p.status === filterStatus;
      }),
    [purchases, searchQuery, filterStatus]
  );

  const pendingCount = purchases.filter(
    (p) => p.status === 'waiting' || p.status === 'quotes'
  ).length;
  const awaitingApproval = purchases.filter((p) => p.requiresPiApproval && !p.piApproved).length;
  const committedSpend = purchases.reduce(
    (total, p) => total + (p.quotations.find((q) => q.isApproved)?.price ?? 0),
    0
  );

  const isAdmin = currentUser?.role !== 'lab_member';

  return (
    <div className="flex-1 w-full mx-auto pb-24 md:pb-8 flex flex-col max-w-3xl px-4 md:px-0">
      <div className="py-4 mt-2 md:mt-6 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]">
            search
          </span>
          <input
            className="w-full pl-9 pr-4 py-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-white placeholder:text-gray-500"
            placeholder="Search requests…"
            aria-label="Search requests"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-orange-600 transition-colors font-medium text-sm"
        >
          New request
        </button>
      </div>

      {isAdmin && (
        <div className="font-mono text-xs text-gray-300 bg-[#1E1E1E] p-3 rounded-md border border-[#2A2A2A] flex flex-wrap items-center gap-x-3 gap-y-1 divide-x divide-[#2A2A2A]">
          <span className="pr-3">
            Committed: <span className="font-bold text-white">{formatRupees(committedSpend)}</span>
          </span>
          <span className="px-3">{pendingCount} pending</span>
          {awaitingApproval > 0 && (
            <span className="px-3 text-amber-300 font-semibold">
              {awaitingApproval} awaiting PI
            </span>
          )}
        </div>
      )}

      <div className="py-3 mt-2 overflow-x-auto no-scrollbar flex gap-6 text-sm font-medium sticky top-16 z-40 bg-background border-b border-[#2A2A2A] mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`whitespace-nowrap transition-colors pb-2 ${
              filterStatus === tab.id
                ? 'text-primary border-b-2 border-primary font-semibold'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E]">
            <span className="material-symbols-outlined text-gray-600 text-4xl mb-3">inbox</span>
            <h3 className="text-white font-medium text-sm mb-1">No requests found</h3>
            <p className="text-gray-400 text-sm max-w-xs">
              {purchases.length === 0
                ? 'Nothing has been requested yet. Create the first request.'
                : 'No requests match this filter.'}
            </p>
          </div>
        ) : (
          filtered.map((purchase) => (
            <PurchaseCard
              key={purchase.id}
              purchase={purchase}
              onClick={() => setSelectedPurchase(purchase)}
              onOpenQuickMenu={(p, e) => {
                e.stopPropagation();
                setActiveQuickPurchase(p);
              }}
              onEdit={(p) => setEditingPurchase(p)}
            />
          ))
        )}
      </div>

      <QuickActionSheet
        purchase={activeQuickPurchase}
        onClose={() => setActiveQuickPurchase(null)}
      />
    </div>
  );
};
