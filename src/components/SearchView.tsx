import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, X } from 'lucide-react';
import { PurchaseCard } from './PurchaseCard';
import { QuickActionSheet } from './QuickActionSheet';
import { Purchase } from '../types';

export const SearchView: React.FC = () => {
  const { purchases, searchQuery, setSearchQuery, setSelectedPurchase } = useApp();
  const [activeQuickPurchase, setActiveQuickPurchase] = useState<Purchase | null>(null);

  // Built from live data so the chips always point at something that exists.
  const shortcuts = useMemo(() => {
    const vendors = purchases.flatMap((p) => p.quotations.map((q) => q.vendor));
    const categories = purchases.map((p) => p.category);
    return Array.from(new Set([...categories, ...vendors])).slice(0, 8);
  }, [purchases]);

  const results = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return purchases;
    return purchases.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        (p.requestedBy?.name.toLowerCase().includes(query) ?? false) ||
        (p.preferredCompany?.toLowerCase().includes(query) ?? false) ||
        p.quotations.some((q) => q.vendor.toLowerCase().includes(query)) ||
        p.comments.some((c) => c.body.toLowerCase().includes(query))
    );
  }, [purchases, searchQuery]);

  return (
    <div className="flex-1 flex flex-col pb-28 pt-4 max-w-3xl mx-auto w-full px-4 space-y-4">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="search"
          autoFocus
          placeholder="Search items, vendors, people, replies…"
          aria-label="Search purchases"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {shortcuts.length > 0 && (
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
            Jump to
          </span>
          <div className="flex flex-wrap gap-1.5">
            {shortcuts.map((sc) => (
              <button
                key={sc}
                onClick={() => setSearchQuery(sc)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  searchQuery.toLowerCase() === sc.toLowerCase()
                    ? 'bg-primary text-white border-primary'
                    : 'bg-[#1E1E1E] text-gray-300 border-[#2A2A2A] hover:bg-[#2A2A2A]'
                }`}
              >
                {sc}
              </button>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider pt-1">
        {searchQuery ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'All requests'}
      </h2>

      <div className="flex flex-col gap-4">
        {results.length === 0 ? (
          <div className="bg-[#1E1E1E] border border-dashed border-[#2A2A2A] rounded-xl p-8 text-center space-y-2">
            <p className="text-sm text-gray-400">No purchases match “{searchQuery}”.</p>
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          results.map((purchase) => (
            <PurchaseCard
              key={purchase.id}
              purchase={purchase}
              onClick={() => setSelectedPurchase(purchase)}
              onOpenQuickMenu={(p, e) => {
                e.stopPropagation();
                setActiveQuickPurchase(p);
              }}
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
