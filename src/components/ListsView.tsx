import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { avatarClasses } from '../lib/accent';
import { initialOf, timeAgo } from '../lib/format';
import { CreateListModal } from './CreateListModal';
import { ListDetailView } from './ListDetailView';

interface Props {
  onBack: () => void;
}

const stagger = (i: number): React.CSSProperties => ({
  opacity: 0,
  animation: 'fade-in 0.2s ease-out both',
  animationDelay: `${Math.min(i * 50, 400)}ms`,
});

export const ListsView: React.FC<Props> = ({ onBack }) => {
  const { labLists } = useApp();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const hasAnimated = useRef(false);
  useEffect(() => {
    if (labLists.length > 0 && !hasAnimated.current) {
      const raf = requestAnimationFrame(() => { hasAnimated.current = true; });
      return () => cancelAnimationFrame(raf);
    }
  }, [labLists.length]);
  const s = (i: number) => hasAnimated.current ? undefined : stagger(i);

  const filtered = useMemo(() => {
    if (!search) return labLists;
    const q = search.toLowerCase();
    return labLists.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q)
    );
  }, [labLists, search]);

  if (selectedListId) {
    return <ListDetailView listId={selectedListId} onBack={() => setSelectedListId(null)} />;
  }

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
          <h1 className="font-extrabold text-white text-lg tracking-tight">Lists</h1>
          <p className="text-xs text-gray-400">
            {labLists.length} list{labLists.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New List
        </button>
      </div>

      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]">
          search
        </span>
        <input
          className="w-full pl-9 pr-4 py-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-white placeholder:text-gray-500"
          placeholder="Search lists..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E]">
          <span className="material-symbols-outlined text-gray-600 text-4xl mb-3">
            {search ? 'search_off' : 'format_list_bulleted'}
          </span>
          <h3 className="text-white font-medium text-sm mb-1">
            {search ? 'No matching lists' : 'No lists yet'}
          </h3>
          <p className="text-gray-400 text-sm max-w-xs">
            {search
              ? `Nothing matches "${search}".`
              : 'Create your first list to track enzymes, chemicals, vectors, or anything else.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((list, i) => {
            const checkedCount = list.items.filter((it) => it.checked).length;
            const totalCount = list.items.length;
            const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

            return (
              <button
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className="w-full text-left bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-4 space-y-3 hover:border-primary/40 transition-colors"
                style={s(i)}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-white text-sm truncate">{list.title}</h3>
                  {list.columns.length > 0 && (
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {list.columns.length} col{list.columns.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {list.description && (
                  <p className="text-xs text-gray-400 line-clamp-2">{list.description}</p>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">
                      {totalCount} item{totalCount !== 1 ? 's' : ''}
                      {checkedCount > 0 && ` · ${checkedCount} done`}
                    </span>
                    {totalCount > 0 && (
                      <span className="text-gray-500 font-medium">{Math.round(progress)}%</span>
                    )}
                  </div>
                  {totalCount > 0 && (
                    <div className="h-1 bg-[#2A2A2A] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[8px] ${avatarClasses(list.createdBy?.accent)}`}>
                      {initialOf(list.createdBy?.name ?? '?', list.createdBy?.handle)}
                    </div>
                    <span className="text-[10px] text-gray-500">{list.createdBy?.name ?? 'Someone'}</span>
                  </div>
                  <span className="text-[10px] text-gray-600">{timeAgo(list.updatedAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <CreateListModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
};
