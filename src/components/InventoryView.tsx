import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { InventoryItem } from '../types';
import { timeAgo } from '../lib/format';
import { avatarClasses } from '../lib/accent';
import { initialOf } from '../lib/format';
import { AddInventoryItemModal } from './AddInventoryItemModal';
import { InventoryActionModal } from './InventoryActionModal';
import { ConfirmModal } from './ConfirmModal';

const ACTION_META: Record<string, { icon: string; color: string; label: string }> = {
  added:     { icon: 'add_circle',     color: 'text-emerald-400', label: 'added' },
  consumed:  { icon: 'remove_circle',  color: 'text-red-400',     label: 'used' },
  restocked: { icon: 'inventory',      color: 'text-emerald-400', label: 'restocked' },
  moved:     { icon: 'swap_horiz',     color: 'text-blue-400',    label: 'moved' },
  arrived:   { icon: 'local_shipping', color: 'text-emerald-400', label: 'received' },
  adjusted:  { icon: 'tune',           color: 'text-amber-400',   label: 'adjusted' },
  removed:   { icon: 'delete',         color: 'text-red-400',     label: 'removed' },
};

export const InventoryView: React.FC = () => {
  const { inventoryItems, inventoryLog } = useApp();

  const [subTab, setSubTab] = useState<'stock' | 'log'>('stock');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'low-first'>('recent');
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionTarget, setActionTarget] = useState<{ item: InventoryItem; type: 'consume' | 'restock' | 'move' } | null>(null);
  const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(inventoryItems.map((i) => i.category));
    return ['all', ...Array.from(cats).sort()];
  }, [inventoryItems]);

  const filteredItems = useMemo(() => {
    const filtered = inventoryItems.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.notes?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
    const sorted = [...filtered];
    if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'low-first') {
      sorted.sort((a, b) => {
        const aLow = a.lowStockThreshold != null && a.quantity <= a.lowStockThreshold ? 0 : 1;
        const bLow = b.lowStockThreshold != null && b.quantity <= b.lowStockThreshold ? 0 : 1;
        if (aLow !== bLow) return aLow - bLow;
        return a.quantity - b.quantity;
      });
    }
    return sorted;
  }, [inventoryItems, search, categoryFilter, sortBy]);

  const lowStockCount = useMemo(
    () => inventoryItems.filter((i) => i.lowStockThreshold != null && i.quantity <= i.lowStockThreshold).length,
    [inventoryItems]
  );

  return (
    <div className="flex-1 w-full mx-auto pb-24 md:pb-8 flex flex-col max-w-3xl px-4 md:px-0">
      <div className="py-4 mt-2 md:mt-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-white">Inventory</h1>
          {lowStockCount > 0 && (
            <span className="text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              {lowStockCount} low stock
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400">Track lab supplies, find items, log arrivals</p>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex gap-1 bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg p-0.5">
          <button
            onClick={() => setSubTab('stock')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              subTab === 'stock' ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Stock
          </button>
          <button
            onClick={() => setSubTab('log')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              subTab === 'log' ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Log
          </button>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowAddModal(true); }}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-orange-600 transition-colors font-medium text-sm flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add item
        </button>
      </div>

      {subTab === 'stock' && (
        <>
          <div className="relative mb-3">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]">
              search
            </span>
            <input
              className="w-full pl-9 pr-4 py-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-white placeholder:text-gray-500"
              placeholder="Search items or locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}</span>
            <select
              className="text-xs bg-[#1E1E1E] border border-[#2A2A2A] rounded-md px-2 py-1 text-gray-300 focus:outline-none focus:border-primary"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'name' | 'low-first')}
            >
              <option value="recent">Recent first</option>
              <option value="name">A-Z</option>
              <option value="low-first">Low stock first</option>
            </select>
          </div>

          {categories.length > 2 && (
            <div className="overflow-x-auto no-scrollbar flex gap-2 pb-3 mb-3 border-b border-[#2A2A2A]">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                    categoryFilter === cat
                      ? 'bg-primary/15 text-primary border-primary/30'
                      : 'bg-[#1E1E1E] text-gray-400 border-[#2A2A2A] hover:text-gray-200'
                  }`}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E]">
                <span className="material-symbols-outlined text-gray-600 text-4xl mb-3">inventory_2</span>
                <h3 className="text-white font-medium text-sm mb-1">
                  {inventoryItems.length === 0 ? 'No items yet' : 'No matches'}
                </h3>
                <p className="text-gray-400 text-sm max-w-xs">
                  {inventoryItems.length === 0
                    ? 'Add your first lab item to start tracking inventory.'
                    : 'Try a different search or category.'}
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onConsume={() => setActionTarget({ item, type: 'consume' })}
                  onRestock={() => setActionTarget({ item, type: 'restock' })}
                  onMove={() => setActionTarget({ item, type: 'move' })}
                  onEdit={() => { setEditTarget(item); setShowAddModal(true); }}
                />
              ))
            )}
          </div>
        </>
      )}

      {subTab === 'log' && (
        <div className="flex flex-col gap-2">
          {inventoryLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E]">
              <span className="material-symbols-outlined text-gray-600 text-4xl mb-3">history</span>
              <h3 className="text-white font-medium text-sm mb-1">No activity yet</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                Actions like adding, using, or moving items will appear here.
              </p>
            </div>
          ) : (
            inventoryLog.map((entry) => {
              const meta = ACTION_META[entry.action] ?? ACTION_META.adjusted;
              return (
                <div
                  key={entry.id}
                  className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3 flex gap-3"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <span className={`material-symbols-outlined text-[20px] ${meta.color}`}>
                      {meta.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200">
                      {entry.actor && (
                        <span className="font-semibold text-white">{entry.actor.name}</span>
                      )}{' '}
                      {meta.label}{' '}
                      <span className="font-medium text-white">{entry.itemName}</span>
                    </p>
                    {entry.quantityChange != null && entry.quantityChange !== 0 && (
                      <p className={`text-xs font-mono mt-0.5 ${entry.quantityChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {entry.quantityChange > 0 ? '+' : ''}{entry.quantityChange}
                      </p>
                    )}
                    {entry.action === 'moved' && entry.newLocation && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        {entry.newLocation}
                      </p>
                    )}
                    {entry.notes && (
                      <p className="text-xs text-gray-500 mt-1 italic">"{entry.notes}"</p>
                    )}
                    <p className="text-[11px] text-gray-500 mt-1">{timeAgo(entry.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <AddInventoryItemModal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setEditTarget(null); }}
        editItem={editTarget}
      />

      <InventoryActionModal
        target={actionTarget}
        onClose={() => setActionTarget(null)}
      />
    </div>
  );
};

function ItemCard({
  item,
  onConsume,
  onRestock,
  onMove,
  onEdit,
}: {
  item: InventoryItem;
  onConsume: () => void;
  onRestock: () => void;
  onMove: () => void;
  onEdit: () => void;
}) {
  const { removeInventoryItem } = useApp();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isLow =
    item.lowStockThreshold != null && item.quantity <= item.lowStockThreshold;
  const isEmpty = item.quantity === 0;

  return (
    <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-[#2A2A2A] px-2 py-0.5 rounded">
            {item.category}
          </span>
          {isEmpty && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded">
              Out of stock
            </span>
          )}
          {isLow && !isEmpty && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
              Low stock
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            title="Edit"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>

      <h3 className="font-semibold text-white text-base mb-1">{item.name}</h3>

      <div className="flex items-baseline gap-1.5 mb-2">
        <span className={`text-2xl font-bold tabular-nums ${isEmpty ? 'text-red-400' : isLow ? 'text-amber-300' : 'text-white'}`}>
          {item.quantity}
        </span>
        <span className="text-sm text-gray-400">{item.unit}</span>
        {item.lowStockThreshold != null && (
          <span className="text-xs text-gray-500 ml-1">
            (min {item.lowStockThreshold})
          </span>
        )}
      </div>

      {item.location && (
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-2">
          <span className="material-symbols-outlined text-[16px] text-gray-500">location_on</span>
          <span>{item.location}</span>
        </div>
      )}

      {item.notes && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{item.notes}</p>
      )}

      {item.addedBy && (
        <div className="flex items-center gap-1.5 mb-3">
          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${avatarClasses(item.addedBy.accent)}`}>
            {initialOf(item.addedBy.name)}
          </div>
          <span className="text-[11px] text-gray-500">
            Added by {item.addedBy.name} · {timeAgo(item.createdAt)}
          </span>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-[#2A2A2A]">
        <button
          onClick={onConsume}
          className="flex-1 py-1.5 text-xs font-medium rounded-md bg-red-500/10 text-red-400 border border-red-500/15 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1"
        >
          <span className="material-symbols-outlined text-[14px]">remove</span>
          Use
        </button>
        <button
          onClick={onRestock}
          className="flex-1 py-1.5 text-xs font-medium rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-1"
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
          Restock
        </button>
        <button
          onClick={onMove}
          className="flex-1 py-1.5 text-xs font-medium rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/15 hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-1"
        >
          <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
          Move
        </button>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        title="Remove item?"
        message={`"${item.name}" will be removed from inventory. This cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={() => removeInventoryItem(item)}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
