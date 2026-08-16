import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Plus, Trash2, X, Columns3 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ListColumn } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { ScrollLock } from '../lib/useScrollLock';

interface Props {
  listId: string;
  onBack: () => void;
}

type ColType = ListColumn['type'];

const COL_TYPE_LABELS: Record<ColType, string> = { text: 'Text', number: 'Number', checkbox: 'Checkbox' };

const stagger = (i: number): React.CSSProperties => ({
  opacity: 0,
  animation: 'fade-in 0.2s ease-out both',
  animationDelay: `${Math.min(i * 40, 400)}ms`,
});

export const ListDetailView: React.FC<Props> = ({ listId, onBack }) => {
  const { labLists, addListItem, updateListItem, removeListItem, updateLabList, removeLabList } = useApp();

  const list = useMemo(() => labLists.find((l) => l.id === listId) ?? null, [labLists, listId]);

  const [newItemName, setNewItemName] = useState('');
  const [newItemData, setNewItemData] = useState<Record<string, unknown>>({});
  const [adding, setAdding] = useState(false);
  const [showDeleteList, setShowDeleteList] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<ColType>('text');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editData, setEditData] = useState<Record<string, unknown>>({});

  const hasAnimated = useRef(false);
  useEffect(() => {
    if (list && list.items.length > 0 && !hasAnimated.current) {
      const raf = requestAnimationFrame(() => { hasAnimated.current = true; });
      return () => cancelAnimationFrame(raf);
    }
  }, [list]);
  const s = (i: number) => hasAnimated.current ? undefined : stagger(i);

  useEffect(() => {
    if (!list) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDeleteList && !showAddColumn && !deleteItemId) onBack();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [list, onBack, showDeleteList, showAddColumn, deleteItemId]);

  if (!list) return null;

  const sortedItems = [...list.items].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return a.sortOrder - b.sortOrder;
  });
  const checkedCount = list.items.filter((i) => i.checked).length;

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || adding) return;
    setAdding(true);
    const name = newItemName.trim();
    const data = { ...newItemData };
    try {
      await addListItem(listId, { name, data });
      setNewItemName('');
      setNewItemData({});
    } finally {
      setAdding(false);
    }
  };

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    const col: ListColumn = { name: newColName.trim(), type: newColType };
    if (list.columns.some((c) => c.name.toLowerCase() === col.name.toLowerCase())) return;
    await updateLabList(listId, { columns: [...list.columns, col] });
    setNewColName('');
    setNewColType('text');
    setShowAddColumn(false);
  };

  const handleRemoveColumn = async (colName: string) => {
    await updateLabList(listId, { columns: list.columns.filter((c) => c.name !== colName) });
  };

  const startEdit = (item: typeof sortedItems[0]) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditData({ ...item.data });
  };

  const saveEdit = async () => {
    if (!editingItemId || !editName.trim()) return;
    await updateListItem(editingItemId, { name: editName.trim(), data: editData });
    setEditingItemId(null);
  };

  const handleDeleteItem = async () => {
    if (!deleteItemId) return;
    await removeListItem(deleteItemId);
    setDeleteItemId(null);
  };

  const deleteItemName = deleteItemId
    ? list.items.find((i) => i.id === deleteItemId)?.name ?? 'this item'
    : '';

  const renderColumnInput = (col: ListColumn, value: unknown, onChange: (val: unknown) => void) => {
    if (col.type === 'checkbox') {
      return (
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-[#2A2A2A] bg-background text-primary focus:ring-primary focus:ring-1 accent-primary"
          />
          <span className="text-[10px] text-gray-500">{col.name}</span>
        </label>
      );
    }
    return (
      <input
        type={col.type === 'number' ? 'number' : 'text'}
        placeholder={col.name}
        value={(value as string | number) ?? ''}
        onChange={(e) => onChange(col.type === 'number' ? (e.target.value ? Number(e.target.value) : '') : e.target.value)}
        className="w-full px-2.5 py-1.5 rounded bg-background border border-[#2A2A2A] text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-gray-600"
      />
    );
  };

  return (
    <div className="flex-1 flex flex-col pb-28 pt-4 max-w-3xl mx-auto w-full px-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-white text-lg tracking-tight truncate">{list.title}</h1>
          <p className="text-xs text-gray-400">
            {list.items.length} item{list.items.length !== 1 ? 's' : ''}
            {checkedCount > 0 && ` · ${checkedCount} checked`}
          </p>
        </div>
        <button
          onClick={() => setShowAddColumn(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded-lg transition-colors"
          title="Manage columns"
        >
          <Columns3 className="w-4 h-4" />
          <span className="hidden sm:inline">Columns</span>
        </button>
        <button
          onClick={() => setShowDeleteList(true)}
          className="p-1.5 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Delete list"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {list.description && (
        <p className="text-xs text-gray-400 bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg p-3">{list.description}</p>
      )}

      {/* Column badges */}
      {list.columns.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {list.columns.map((col) => (
            <span key={col.name} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {col.name}
              <span className="text-blue-500/60">({COL_TYPE_LABELS[col.type]})</span>
            </span>
          ))}
        </div>
      )}

      {/* Add item form */}
      <form onSubmit={handleAddItem} className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Add an item..."
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-gray-600"
          />
          <button
            type="submit"
            disabled={!newItemName.trim() || adding}
            className="px-3 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {list.columns.length > 0 && newItemName.trim() && (
          <div className="grid grid-cols-2 gap-2 pl-1">
            {list.columns.map((col) => (
              <div key={col.name}>
                {renderColumnInput(col, newItemData[col.name], (val) =>
                  setNewItemData((prev) => ({ ...prev, [col.name]: val }))
                )}
              </div>
            ))}
          </div>
        )}
      </form>

      {/* Items list */}
      {sortedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E]">
          <span className="material-symbols-outlined text-gray-600 text-4xl mb-3">checklist</span>
          <h3 className="text-white font-medium text-sm mb-1">Empty list</h3>
          <p className="text-gray-400 text-sm max-w-xs">Add your first item above.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sortedItems.map((item, i) => {
            const isEditing = editingItemId === item.id;

            if (isEditing) {
              return (
                <div key={item.id} className="bg-[#1E1E1E] border border-primary/40 rounded-xl p-3 space-y-2.5">
                  <input
                    type="text"
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void saveEdit(); if (e.key === 'Escape') setEditingItemId(null); }}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {list.columns.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {list.columns.map((col) => (
                        <div key={col.name}>
                          {renderColumnInput(col, editData[col.name], (val) =>
                            setEditData((prev) => ({ ...prev, [col.name]: val }))
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => void saveEdit()} className="flex-1 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-orange-600 transition-colors">Save</button>
                    <button onClick={() => setEditingItemId(null)} className="flex-1 py-1.5 text-xs font-semibold bg-[#2A2A2A] text-gray-300 rounded-lg hover:bg-[#333] transition-colors">Cancel</button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className={`bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3 flex items-start gap-3 transition-colors hover:border-[#333] ${item.checked ? 'opacity-60' : ''}`}
                style={s(i)}
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => void updateListItem(item.id, { checked: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-[#2A2A2A] bg-background text-primary focus:ring-primary focus:ring-1 accent-primary shrink-0"
                />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startEdit(item)}>
                  <p className={`text-sm font-medium ${item.checked ? 'line-through text-gray-500' : 'text-white'}`}>
                    {item.name}
                  </p>
                  {list.columns.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {list.columns.map((col) => {
                        const val = item.data[col.name];
                        if (val === undefined || val === '' || val === null) return null;
                        if (col.type === 'checkbox') {
                          return (
                            <span key={col.name} className="text-[10px] text-gray-500">
                              {col.name}: {val ? 'Yes' : 'No'}
                            </span>
                          );
                        }
                        return (
                          <span key={col.name} className="text-[10px] text-gray-500">
                            {col.name}: <strong className="text-gray-300">{String(val)}</strong>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setDeleteItemId(item.id)}
                  className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Column modal */}
      {showAddColumn && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
          <ScrollLock />
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay" onClick={() => setShowAddColumn(false)} />
          <div className="relative w-full max-w-sm bg-[#1E1E1E] border border-[#2A2A2A] rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4 animate-sheet">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Manage Columns</h3>
              <button onClick={() => setShowAddColumn(false)} className="p-1 rounded-full text-gray-500 hover:text-white hover:bg-[#2A2A2A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {list.columns.length > 0 && (
              <div className="space-y-1.5">
                {list.columns.map((col) => (
                  <div key={col.name} className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-[#2A2A2A]">
                    <div>
                      <span className="text-xs font-medium text-white">{col.name}</span>
                      <span className="text-[10px] text-gray-500 ml-1.5">({COL_TYPE_LABELS[col.type]})</span>
                    </div>
                    <button onClick={() => void handleRemoveColumn(col.name)} className="p-1 rounded text-gray-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddColumn} className="space-y-3 border-t border-[#2A2A2A] pt-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Add Column</p>
              <input
                type="text"
                placeholder="Column name (e.g. Catalog #, Storage Temp)"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-gray-600"
              />
              <div className="flex gap-2">
                {(['text', 'number', 'checkbox'] as ColType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewColType(t)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      newColType === t
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-background text-gray-400 border-[#2A2A2A] hover:border-gray-500'
                    }`}
                  >
                    {COL_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={!newColName.trim() || list.columns.some((c) => c.name.toLowerCase() === newColName.trim().toLowerCase())}
                className="w-full py-2.5 bg-primary text-white font-semibold rounded-lg text-sm hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add Column
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showDeleteList}
        title="Delete list?"
        message={`"${list.title}" and all its items will be permanently removed.`}
        onConfirm={async () => {
          await removeLabList(listId);
          setShowDeleteList(false);
          onBack();
        }}
        onCancel={() => setShowDeleteList(false)}
      />

      <ConfirmModal
        open={!!deleteItemId}
        title="Delete item?"
        message={`"${deleteItemName}" will be removed from this list.`}
        onConfirm={handleDeleteItem}
        onCancel={() => setDeleteItemId(null)}
      />
    </div>
  );
};
