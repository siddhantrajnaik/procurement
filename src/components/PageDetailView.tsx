import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Trash2, Plus, ExternalLink, Eye, Pencil, X } from 'lucide-react';
import * as api from '../lib/api';
import { useUI } from '../context/UIContext';
import { DriveLink, NotebookPage } from '../types';
import { renderMarkdown } from '../lib/renderMarkdown';
import { ConfirmModal } from './ConfirmModal';

const EMOJI_CHOICES = [
  '📄', '🧪', '🔬', '🧬', '💊', '🦠', '📊', '📈',
  '🧫', '⚗️', '🩺', '💡', '📌', '✅', '⚠️', '🔥',
  '📝', '📚', '🗂️', '🔗', '🧠', '⭐', '🎯', '🚀',
];

interface Props {
  page: NotebookPage;
  onBack: () => void;
  onChange: (page: NotebookPage) => void;
  onDeleted: (id: string) => void;
}

export const PageDetailView: React.FC<Props> = ({ page, onBack, onChange, onDeleted }) => {
  const { showToast } = useUI();

  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [mode, setMode] = useState<'edit' | 'view'>(page.body ? 'view' : 'edit');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showAddLink, setShowAddLink] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  // What is currently persisted, so blur handlers can skip no-op saves.
  const savedRef = useRef({ title: page.title, body: page.body });
  // Server truth for the link list, so queued edits build on each other rather
  // than on a `page` prop that has not round-tripped yet.
  const linksRef = useRef<DriveLink[]>(page.driveLinks);
  // Saves run one at a time; two blurs in flight must not land out of order.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const rendered = useMemo(() => renderMarkdown(body), [body]);

  type Updates = { title?: string; icon?: string; body?: string; driveLinks?: DriveLink[] };

  /**
   * Pass a thunk when the update depends on the current link list — it is
   * evaluated once this save reaches the front of the queue, not at call time.
   */
  const save = (build: Updates | (() => Updates)): Promise<boolean> => {
    const task = queueRef.current.then(async () => {
      const updates = typeof build === 'function' ? build() : build;
      setSaving(true);
      try {
        const updated = await api.updateNotebookPage(page.id, updates);
        if (updates.title !== undefined) savedRef.current.title = updates.title;
        if (updates.body !== undefined) savedRef.current.body = updates.body;
        linksRef.current = updated.driveLinks;
        onChange(updated);
        return true;
      } catch {
        showToast('Could not save the page.', 'error');
        return false;
      } finally {
        setSaving(false);
      }
    });
    queueRef.current = task.catch(() => {});
    return task;
  };

  // Flush unsaved title/body when leaving. If that write fails we stay put —
  // navigating would unmount the only copy of the user's text.
  const handleBack = async () => {
    const pending: { title?: string; body?: string } = {};
    if (title !== savedRef.current.title) pending.title = title;
    if (body !== savedRef.current.body) pending.body = body;
    if (Object.keys(pending).length && !(await save(pending))) return;
    onBack();
  };

  useEffect(() => {
    if (!showEmoji) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowEmoji(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [showEmoji]);

  const handleAddLink = async () => {
    const raw = linkUrl.trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const label = linkTitle.trim() || url;
    if (await save(() => ({ driveLinks: [...linksRef.current, { url, title: label }] }))) {
      setLinkTitle('');
      setLinkUrl('');
      setShowAddLink(false);
    }
  };

  const handleRemoveLink = async (url: string) => {
    await save(() => ({ driveLinks: linksRef.current.filter((l) => l.url !== url) }));
  };

  return (
    <div className="flex-1 flex flex-col pb-28 pt-4 max-w-md mx-auto w-full px-4">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => void handleBack()}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Notebook
        </button>
        <div className="flex items-center gap-2">
          {saving && <span className="text-[10px] text-gray-500">Saving…</span>}
          <button
            onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] text-[11px] font-semibold text-gray-300 hover:border-primary/40 hover:text-white transition-colors"
          >
            {mode === 'edit' ? (
              <>
                <Eye className="w-3.5 h-3.5" /> Preview
              </>
            ) : (
              <>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </>
            )}
          </button>
          <button
            onClick={() => setShowDelete(true)}
            aria-label="Delete page"
            className="p-2.5 -mr-1 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete page"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Icon + title */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative shrink-0" ref={emojiRef}>
          <button
            onClick={() => setShowEmoji((v) => !v)}
            aria-expanded={showEmoji}
            aria-haspopup="menu"
            aria-label="Change page icon"
            className="w-12 h-12 rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] flex items-center justify-center text-2xl hover:border-primary/40 transition-colors"
            title="Change icon"
          >
            {page.icon}
          </button>

          {showEmoji && (
            <div
              role="menu"
              className="absolute top-14 left-0 z-30 w-72 p-2 rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] shadow-2xl grid grid-cols-6 gap-1"
            >
              {EMOJI_CHOICES.map((emoji) => (
                <button
                  key={emoji}
                  role="menuitem"
                  onClick={() => {
                    setShowEmoji(false);
                    void save({ icon: emoji });
                  }}
                  className={`aspect-square rounded-lg text-lg flex items-center justify-center transition-colors ${
                    page.icon === emoji ? 'bg-primary/20 border border-primary/40' : 'hover:bg-[#2A2A2A]'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title !== savedRef.current.title) void save({ title });
          }}
          placeholder="Untitled"
          aria-label="Page title"
          className="flex-1 min-w-0 bg-transparent text-xl font-extrabold text-white placeholder:text-gray-700 focus:outline-none"
        />
      </div>

      {/* Body */}
      {mode === 'edit' ? (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => {
            if (body !== savedRef.current.body) void save({ body });
          }}
          placeholder={
            'Write your protocol or notes here.\n\n# Heading\n**bold**  *italic*  `code`\n- bullet point\n1. numbered step\n[link](https://example.com)'
          }
          className="w-full min-h-[320px] p-4 bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl text-sm text-gray-200 leading-relaxed placeholder:text-gray-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-y font-mono"
        />
      ) : (
        <div
          className="notebook-prose min-h-[320px] p-4 bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl text-sm text-gray-200"
          dangerouslySetInnerHTML={{
            __html: rendered || '<p class="text-gray-600">This page is empty. Tap Edit to start writing.</p>',
          }}
        />
      )}

      {/* Drive links */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Attached Links
          </h2>
          <button
            onClick={() => setShowAddLink((v) => !v)}
            className="text-xs text-primary hover:text-orange-400 transition-colors flex items-center gap-1 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Link
          </button>
        </div>

        {showAddLink && (
          <div className="bg-[#1E1E1E] border border-primary/30 rounded-xl p-4 mb-3 space-y-3">
            <input
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="Label (e.g. Raw data folder)"
              className="w-full px-3 py-2 bg-background border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="URL (e.g. drive.google.com/…)"
              className="w-full px-3 py-2 bg-background border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-2">
              <button
                onClick={() => void handleAddLink()}
                disabled={saving || !linkUrl.trim()}
                className="flex-1 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Add'}
              </button>
              <button
                onClick={() => {
                  setShowAddLink(false);
                  setLinkTitle('');
                  setLinkUrl('');
                }}
                className="px-4 py-2 bg-[#2A2A2A] text-gray-300 rounded-md text-sm font-medium hover:bg-[#333] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {page.driveLinks.length === 0 && !showAddLink ? (
          <p className="text-xs text-gray-600 px-1">
            No links yet — attach a Drive folder, a paper, or a protocol.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {page.driveLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3 hover:border-primary/30 transition-colors group flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <ExternalLink className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-primary transition-colors">
                    {link.title}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">{link.url}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleRemoveLink(link.url);
                  }}
                  aria-label={`Remove link ${link.title}`}
                  className="p-2.5 -mr-1 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </a>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={showDelete}
        title="Delete page?"
        message={`"${page.title || 'Untitled'}" and everything on it will be permanently removed.`}
        onConfirm={async () => {
          try {
            await api.deleteNotebookPage(page.id);
            showToast('Page deleted.', 'warning');
            onDeleted(page.id);
          } catch {
            showToast('Could not delete the page.', 'error');
          } finally {
            setShowDelete(false);
          }
        }}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
};
