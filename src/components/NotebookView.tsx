import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Search, NotebookPen } from 'lucide-react';
import * as api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { NotebookPage } from '../types';
import { timeAgo } from '../lib/format';
import { PageDetailView } from './PageDetailView';

/** First non-empty, non-heading line of the body — used as the card preview. */
function snippetOf(body: string): string {
  const line = body
    .split(/\r?\n/)
    .map((l) => l.replace(/^[#\-*>\s]+/, '').trim())
    .find((l) => l.length > 0);
  return line ? (line.length > 80 ? line.slice(0, 80) + '…' : line) : 'Empty page';
}

export const NotebookView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { currentUser } = useAuth();
  const { showToast } = useUI();
  const [pages, setPages] = useState<NotebookPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [openPageId, setOpenPageId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    setIsLoading(true);
    api
      .fetchNotebookPages(currentUser.id)
      .then((rows) => {
        if (!cancelled) setPages(rows);
      })
      .catch(() => {
        if (!cancelled) showToast('Could not load your notebook.', 'error');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser, showToast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) => p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q)
    );
  }, [pages, query]);

  const handleCreate = async () => {
    if (!currentUser || creating) return;
    setCreating(true);
    try {
      const page = await api.createNotebookPage('Untitled', '📄', currentUser.id);
      setPages((prev) => [page, ...prev]);
      setOpenPageId(page.id);
    } catch {
      showToast('Could not create the page.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const openPage = pages.find((p) => p.id === openPageId) ?? null;

  if (openPage) {
    return (
      <PageDetailView
        page={openPage}
        onBack={() => setOpenPageId(null)}
        onChange={(updated) =>
          setPages((prev) =>
            [updated, ...prev.filter((p) => p.id !== updated.id)].sort(
              (a, b) => b.updatedAt.localeCompare(a.updatedAt)
            )
          )
        }
        onDeleted={(id) => {
          setPages((prev) => prev.filter((p) => p.id !== id));
          setOpenPageId(null);
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-28 pt-4 max-w-md mx-auto w-full px-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Lab Notebook</h1>
          <p className="text-sm text-gray-400">Your private notes &amp; protocols</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors disabled:opacity-50 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          {creating ? 'Creating…' : 'New Page'}
        </button>
      </div>

      {pages.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your pages…"
            className="w-full pl-9 pr-3 py-2.5 bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[88px] rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E] px-6">
          <NotebookPen className="w-8 h-8 text-gray-600 mb-3" />
          <p className="text-sm text-gray-300 font-medium">
            {query ? 'No pages match that search' : 'Your notebook is empty'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {query
              ? 'Try a different word'
              : 'Create a page for a protocol, an experiment log, or a link to your Drive folder.'}
          </p>
          {!query && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              Create your first page
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((page) => (
            <button
              key={page.id}
              onClick={() => setOpenPageId(page.id)}
              className="w-full text-left bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3.5 hover:border-primary/40 transition-colors group flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-background border border-[#2A2A2A] flex items-center justify-center text-xl shrink-0">
                {page.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">
                  {page.title || 'Untitled'}
                </p>
                <p className="text-[11px] text-gray-500 truncate mt-0.5">
                  {snippetOf(page.body)}
                </p>
                <p className="text-[10px] text-gray-600 mt-1">
                  Edited {timeAgo(page.updatedAt)}
                  {page.driveLinks.length > 0 &&
                    ` · ${page.driveLinks.length} link${page.driveLinks.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
