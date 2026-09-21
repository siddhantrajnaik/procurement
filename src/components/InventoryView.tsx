import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { useSampleOverview } from '../lib/useSampleOverview';
import { InventoryItem, Sample } from '../types';
import { timeAgo, todayISO } from '../lib/format';
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
  const { setActiveTab, setPendingProfileView } = useUI();
  const { boxes, samples, loading: samplesLoading } = useSampleOverview();

  const [subTab, setSubTab] = useState<'stock' | 'samples' | 'expiry' | 'log'>('stock');
  const [sampleSearch, setSampleSearch] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'low-first'>('recent');
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionTarget, setActionTarget] = useState<{ item: InventoryItem; type: 'consume' | 'restock' | 'move' } | null>(null);
  const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);
  const [logSearch, setLogSearch] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('all');

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

  const filteredLog = useMemo(() => {
    return inventoryLog.filter((entry) => {
      if (logActionFilter !== 'all' && entry.action !== logActionFilter) return false;
      if (logSearch) {
        const q = logSearch.toLowerCase();
        return (
          entry.itemName.toLowerCase().includes(q) ||
          (entry.actor?.name.toLowerCase().includes(q) ?? false) ||
          (entry.notes?.toLowerCase().includes(q) ?? false) ||
          (entry.newLocation?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [inventoryLog, logSearch, logActionFilter]);

  const logActionTypes = useMemo(() => {
    const types = new Set(inventoryLog.map((e) => e.action));
    return Array.from(types).sort();
  }, [inventoryLog]);

  const lowStockCount = useMemo(
    () => inventoryItems.filter((i) => i.lowStockThreshold != null && i.quantity <= i.lowStockThreshold).length,
    [inventoryItems]
  );

  const expiryItems = useMemo(() => {
    const today = todayISO();
    return inventoryItems
      .filter((i) => i.expiryDate != null)
      .sort((a, b) => a.expiryDate!.localeCompare(b.expiryDate!))
      .map((item) => {
        const daysLeft = Math.ceil(
          (new Date(item.expiryDate!).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
        );
        return { item, daysLeft };
      });
  }, [inventoryItems]);

  const expiringSoonCount = useMemo(
    () => expiryItems.filter((e) => e.daysLeft <= 30).length,
    [expiryItems]
  );

  const openSampleInventory = () => {
    setPendingProfileView('samples');
    setActiveTab('profile');
  };

  /** Boxes that survive the search, each with its matching samples. */
  const sampleGroups = useMemo(() => {
    const q = sampleSearch.trim().toLowerCase();
    const match = (s: { name: string; container: string; volume: string; notes: string }) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.container.toLowerCase().includes(q) ||
      s.volume.toLowerCase().includes(q) ||
      s.notes.toLowerCase().includes(q);

    const groups = boxes.map((box) => {
      const boxMatches =
        !q ||
        box.name.toLowerCase().includes(q) ||
        box.condition.toLowerCase().includes(q) ||
        box.location.toLowerCase().includes(q);
      // A box named in the search keeps all its samples; otherwise only the
      // samples that matched are worth showing.
      const inBox = samples.filter((s) => s.boxId === box.id);
      return { box, samples: boxMatches ? inBox : inBox.filter(match) };
    });

    const loose = samples.filter((s) => s.boxId === null).filter(match);
    return {
      boxes: groups.filter((g) => g.samples.length > 0),
      loose,
    };
  }, [boxes, samples, sampleSearch]);

  const shownSampleCount = useMemo(
    () => sampleGroups.boxes.reduce((n, g) => n + g.samples.length, 0) + sampleGroups.loose.length,
    [sampleGroups]
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
        <p className="text-sm text-gray-400">
          Track lab supplies, find items, log arrivals
          {samples.length > 0 && ` · ${samples.length} sample${samples.length !== 1 ? 's' : ''}`}
        </p>
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
            onClick={() => setSubTab('samples')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              subTab === 'samples' ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Samples
          </button>
          <button
            onClick={() => setSubTab('expiry')}
            className={`relative px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              subTab === 'expiry' ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Expiry
            {expiringSoonCount > 0 && subTab !== 'expiry' && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {expiringSoonCount}
              </span>
            )}
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
        {subTab === 'samples' ? (
          <button
            onClick={openSampleInventory}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-orange-600 transition-colors font-medium text-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">science</span>
            Manage
          </button>
        ) : (
          <button
            onClick={() => { setEditTarget(null); setShowAddModal(true); }}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-orange-600 transition-colors font-medium text-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add item
          </button>
        )}
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

      {subTab === 'samples' && (
        <div className="flex flex-col gap-3">
          {samplesLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-[#2A2A2A] border-t-primary animate-spin" />
            </div>
          ) : samples.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E]">
              <span className="material-symbols-outlined text-gray-600 text-4xl mb-3">science</span>
              <h3 className="text-white font-medium text-sm mb-1">No samples yet</h3>
              <p className="text-gray-400 text-sm max-w-xs mb-4">
                Samples live in Sample Inventory. Add them there and they show up here.
              </p>
              <button
                onClick={openSampleInventory}
                className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-md hover:bg-primary/20 transition-colors font-medium text-sm"
              >
                Open Sample Inventory
              </button>
            </div>
          ) : (
            <>
              <div className="relative mb-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]">
                  search
                </span>
                <input
                  className="w-full pl-9 pr-4 py-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-white placeholder:text-gray-500"
                  placeholder="Search samples, boxes or containers..."
                  value={sampleSearch}
                  onChange={(e) => setSampleSearch(e.target.value)}
                />
              </div>

              <p className="text-xs text-gray-500">
                {shownSampleCount} sample{shownSampleCount !== 1 ? 's' : ''}
                {sampleSearch && ` matching "${sampleSearch}"`}
              </p>

              {shownSampleCount === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-gray-400 text-sm">No samples match "{sampleSearch}".</p>
                </div>
              )}

              {sampleGroups.boxes.map(({ box, samples: boxSamples }) => (
                <div key={box.id} className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#2A2A2A] flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">{box.name}</span>
                    {box.condition && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-blue-500/15 text-blue-300 border-blue-500/25">
                        {box.condition}
                      </span>
                    )}
                    {box.location && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                        {box.location}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-500 ml-auto">
                      {boxSamples.length} sample{boxSamples.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="divide-y divide-[#2A2A2A] px-4">
                    {boxSamples.map((sa) => (
                      <SampleRow key={sa.id} sample={sa} onOpen={openSampleInventory} />
                    ))}
                  </div>
                </div>
              ))}

              {sampleGroups.loose.length > 0 && (
                <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#2A2A2A] flex items-center gap-2">
                    <span className="font-bold text-white text-sm">Loose samples</span>
                    <span className="text-[11px] text-gray-500 ml-auto">
                      {sampleGroups.loose.length} sample{sampleGroups.loose.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="divide-y divide-[#2A2A2A] px-4">
                    {sampleGroups.loose.map((sa) => (
                      <SampleRow key={sa.id} sample={sa} onOpen={openSampleInventory} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {subTab === 'expiry' && (
        <div className="flex flex-col gap-3">
          {expiryItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E]">
              <span className="material-symbols-outlined text-gray-600 text-4xl mb-3">event_available</span>
              <h3 className="text-white font-medium text-sm mb-1">No expiry dates set</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                Add expiry dates when editing inventory items to track them here.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">{expiryItems.length} item{expiryItems.length !== 1 ? 's' : ''} with expiry dates</p>
              {expiryItems.map(({ item, daysLeft }) => {
                const isExpired = daysLeft < 0;
                const isUrgent = daysLeft >= 0 && daysLeft <= 7;
                const isWarning = daysLeft > 7 && daysLeft <= 30;

                let statusColor = 'text-gray-400 bg-[#2A2A2A]';
                let statusText = `${daysLeft}d left`;
                if (isExpired) {
                  statusColor = 'text-red-400 bg-red-500/10 border border-red-500/20';
                  statusText = daysLeft === -1 ? 'Expired yesterday' : `Expired ${Math.abs(daysLeft)}d ago`;
                } else if (daysLeft === 0) {
                  statusColor = 'text-red-400 bg-red-500/10 border border-red-500/20';
                  statusText = 'Expires today';
                } else if (isUrgent) {
                  statusColor = 'text-red-400 bg-red-500/10 border border-red-500/20';
                  statusText = daysLeft === 1 ? 'Expires tomorrow' : `${daysLeft}d left`;
                } else if (isWarning) {
                  statusColor = 'text-amber-300 bg-amber-500/10 border border-amber-500/20';
                }

                return (
                  <div
                    key={item.id}
                    className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3.5 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white text-sm truncate">{item.name}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-[#2A2A2A] px-2 py-0.5 rounded shrink-0">
                          {item.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{item.quantity} {item.unit}</span>
                        {item.location && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">location_on</span>
                            {item.location}
                          </span>
                        )}
                        <span>{item.expiryDate}</span>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${statusColor}`}>
                      {statusText}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
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
            <>
              <div className="relative mb-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]">
                  search
                </span>
                <input
                  className="w-full pl-9 pr-4 py-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-white placeholder:text-gray-500"
                  placeholder="Search log entries..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                />
              </div>

              {logActionTypes.length > 1 && (
                <div className="overflow-x-auto no-scrollbar flex gap-2 pb-2 mb-1">
                  <button
                    onClick={() => setLogActionFilter('all')}
                    className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                      logActionFilter === 'all'
                        ? 'bg-primary/15 text-primary border-primary/30'
                        : 'bg-[#1E1E1E] text-gray-400 border-[#2A2A2A] hover:text-gray-200'
                    }`}
                  >
                    All
                  </button>
                  {logActionTypes.map((action) => {
                    const meta = ACTION_META[action] ?? ACTION_META.adjusted;
                    return (
                      <button
                        key={action}
                        onClick={() => setLogActionFilter(action)}
                        className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors border flex items-center gap-1 ${
                          logActionFilter === action
                            ? 'bg-primary/15 text-primary border-primary/30'
                            : 'bg-[#1E1E1E] text-gray-400 border-[#2A2A2A] hover:text-gray-200'
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="text-xs text-gray-500 mb-1">{filteredLog.length} entr{filteredLog.length !== 1 ? 'ies' : 'y'}</p>

              {filteredLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-gray-400 text-sm">No matching log entries.</p>
                </div>
              ) : filteredLog.map((entry) => {
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
            })}
            </>
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

function SampleRow({ sample, onOpen }: { sample: Sample; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left py-2.5 flex items-center gap-3 hover:bg-[#242424] transition-colors rounded"
    >
      <span className="material-symbols-outlined text-[16px] text-gray-500 shrink-0">science</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-white truncate block">{sample.name}</span>
        <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
          {sample.container && <span>{sample.container}</span>}
          {sample.volume && <span>{sample.volume}</span>}
          <span>{timeAgo(sample.createdAt)}</span>
        </div>
        {sample.notes && (
          <p className="text-[11px] text-gray-500 italic truncate mt-0.5">{sample.notes}</p>
        )}
      </div>
      {sample.addedBy && (
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${avatarClasses(sample.addedBy.accent)}`}>
          {initialOf(sample.addedBy.name, sample.addedBy.handle)}
        </div>
      )}
    </button>
  );
}

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
  const expiryDays = item.expiryDate
    ? Math.ceil((new Date(item.expiryDate).getTime() - new Date(todayISO()).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpired = expiryDays != null && expiryDays < 0;
  const isExpiringSoon = expiryDays != null && expiryDays >= 0 && expiryDays <= 30;

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
          {isExpired && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded">
              Expired
            </span>
          )}
          {isExpiringSoon && !isExpired && (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
              expiryDays! <= 7
                ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                : 'text-amber-300 bg-amber-500/10 border border-amber-500/20'
            }`}>
              {expiryDays === 0 ? 'Expires today' : `${expiryDays}d to expiry`}
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

      {item.expiryDate && (
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-2">
          <span className="material-symbols-outlined text-[16px] text-gray-500">event</span>
          <span>Expires {item.expiryDate}</span>
        </div>
      )}

      {item.notes && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{item.notes}</p>
      )}

      {item.addedBy && (
        <div className="flex items-center gap-1.5 mb-3">
          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${avatarClasses(item.addedBy.accent)}`}>
            {initialOf(item.addedBy.name, item.addedBy.handle)}
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
        busyLabel="Removing…"
        onConfirm={() => removeInventoryItem(item)}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
