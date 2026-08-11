import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, X } from 'lucide-react';
import { PurchaseCard } from './PurchaseCard';
import { QuickActionSheet } from './QuickActionSheet';
import { Purchase, InventoryItem } from '../types';
import { avatarClasses } from '../lib/accent';
import { initialOf, timeAgo } from '../lib/format';

export const SearchView: React.FC = () => {
  const { purchases, inventoryItems, searchQuery, setSearchQuery, setSelectedPurchase, setEditingPurchase, setActiveTab } = useApp();
  const [activeQuickPurchase, setActiveQuickPurchase] = useState<Purchase | null>(null);

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

  const inventoryResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return inventoryItems.filter(
      (i) =>
        i.name.toLowerCase().includes(query) ||
        i.category.toLowerCase().includes(query) ||
        i.location.toLowerCase().includes(query) ||
        (i.notes?.toLowerCase().includes(query) ?? false) ||
        (i.addedBy?.name.toLowerCase().includes(query) ?? false)
    );
  }, [inventoryItems, searchQuery]);

  return (
    <div className="flex-1 flex flex-col pb-28 pt-4 max-w-3xl mx-auto w-full px-4 space-y-4">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="search"
          autoFocus
          placeholder="Search requests, inventory, vendors, people…"
          aria-label="Search"
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

      {shortcuts.length > 0 && !searchQuery && (
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
            Jump to
          </span>
          <div className="flex flex-wrap gap-1.5">
            {shortcuts.map((sc) => (
              <button
                key={sc}
                onClick={() => setSearchQuery(sc)}
                className="px-3 py-1 rounded-full text-xs font-semibold border transition-colors bg-[#1E1E1E] text-gray-300 border-[#2A2A2A] hover:bg-[#2A2A2A]"
              >
                {sc}
              </button>
            ))}
          </div>
        </div>
      )}

      {inventoryResults.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">inventory_2</span>
            Inventory ({inventoryResults.length})
          </h2>
          <div className="flex flex-col gap-2">
            {inventoryResults.map((item) => (
              <InventoryResultCard key={item.id} item={item} onNavigate={() => setActiveTab('inventory')} />
            ))}
          </div>
        </div>
      )}

      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider pt-1">
        {searchQuery
          ? `Requests (${results.length})`
          : 'All requests'}
      </h2>

      <div className="flex flex-col gap-4">
        {results.length === 0 ? (
          <div className="bg-[#1E1E1E] border border-dashed border-[#2A2A2A] rounded-xl p-8 text-center space-y-2">
            <p className="text-sm text-gray-400">
              {searchQuery
                ? `No requests match "${searchQuery}".`
                : 'No requests yet.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Clear search
              </button>
            )}
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

function InventoryResultCard({ item, onNavigate }: { item: InventoryItem; onNavigate: () => void }) {
  const isLow = item.lowStockThreshold != null && item.quantity <= item.lowStockThreshold;
  const isEmpty = item.quantity === 0;

  return (
    <button
      onClick={onNavigate}
      className="w-full text-left bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3 flex items-center gap-3 hover:border-primary/40 transition-colors"
    >
      <div className="w-10 h-10 rounded-lg bg-[#2A2A2A] flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-[20px] text-gray-400">inventory_2</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white truncate">{item.name}</span>
          <span className="text-[10px] font-semibold text-gray-400 bg-[#2A2A2A] px-1.5 py-0.5 rounded shrink-0">
            {item.category}
          </span>
          {isEmpty && (
            <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded shrink-0">
              Out
            </span>
          )}
          {isLow && !isEmpty && (
            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
              Low
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
          <span className={`font-mono font-bold ${isEmpty ? 'text-red-400' : isLow ? 'text-amber-300' : 'text-gray-300'}`}>
            {item.quantity} {item.unit}
          </span>
          {item.location && (
            <span className="flex items-center gap-0.5 truncate">
              <span className="material-symbols-outlined text-[12px]">location_on</span>
              {item.location}
            </span>
          )}
          {item.addedBy && (
            <span className="flex items-center gap-1 shrink-0">
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold ${avatarClasses(item.addedBy.accent)}`}>
                {initialOf(item.addedBy.name)}
              </span>
              {timeAgo(item.createdAt)}
            </span>
          )}
        </div>
      </div>
      <span className="material-symbols-outlined text-[16px] text-gray-600 shrink-0">chevron_right</span>
    </button>
  );
}
