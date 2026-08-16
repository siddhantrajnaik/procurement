import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Send, MapPin, Trash2, Check, Eye } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { LostFoundItem, LostFoundStatus } from '../types';
import { avatarClasses } from '../lib/accent';
import { initialOf, timeAgo } from '../lib/format';
import { ConfirmModal } from './ConfirmModal';
import { SHEET_SPRING } from '../lib/motion';
import { ScrollLock } from '../lib/useScrollLock';

interface Props {
  item: LostFoundItem | null;
  onClose: () => void;
}

const STATUS_CFG: Record<LostFoundStatus, { label: string; bg: string; text: string; border: string }> = {
  open: { label: 'Lost', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  found: { label: 'Found', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  resolved: { label: 'Resolved', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
};

export const LostFoundThreadModal: React.FC<Props> = ({ item, onClose }) => {
  const { addLostFoundResponse, updateLostFoundStatus, removeLostFoundItem } = useApp();
  const { currentUser } = useAuth();
  const [responseText, setResponseText] = useState('');
  const [posting, setPosting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDelete) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [item, onClose, showDelete]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !responseText.trim() || posting) return;
    setPosting(true);
    try {
      // Keep the draft if the post failed.
      if (await addLostFoundResponse(item.id, responseText.trim())) setResponseText('');
    } finally {
      setPosting(false);
    }
  };

  if (!item || !currentUser) return null;

  const cfg = STATUS_CFG[item.status];

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[60] flex justify-center"
        role="dialog"
        aria-modal="true"
      >
        <ScrollLock />
        {/* CSS in, spring out — see PurchaseThreadModal. */}
        <motion.div
          className="absolute inset-0 bg-black/50 sm:backdrop-blur-xs animate-overlay"
          exit={{ opacity: 0 }}
        />
        <motion.div
          exit={{ y: '100%' }}
          transition={SHEET_SPRING}
          className="animate-sheet-solid relative w-full max-w-md h-full bg-background flex flex-col overflow-hidden sm:rounded-xl sm:my-4 sm:h-[94vh] shadow-2xl border border-[#2A2A2A]"
        >
          {/* Header */}
          <div className="safe-top-modal px-4 pb-3 border-b border-[#2A2A2A] flex items-center justify-between bg-[#1E1E1E] sticky top-0 z-20">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-[#2A2A2A] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Lost & Found
            </span>
            <button
              onClick={() => setShowDelete(true)}
              className="p-1.5 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
            {/* Item card */}
            <div className="bg-[#1E1E1E] p-5 rounded-xl border border-[#2A2A2A] space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-lg font-extrabold text-white tracking-tight">{item.title}</h1>
                <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                  {cfg.label}
                </span>
              </div>

              {item.description && (
                <p className="text-xs text-gray-400 leading-relaxed bg-background p-3 rounded-lg border border-[#2A2A2A]">
                  {item.description}
                </p>
              )}

              {item.locationLastSeen && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <MapPin className="w-3.5 h-3.5 text-gray-500" />
                  <span>Last seen: <strong className="text-gray-200">{item.locationLastSeen}</strong></span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${avatarClasses(item.reportedBy?.accent)}`}>
                    {initialOf(item.reportedBy?.name ?? '?', item.reportedBy?.handle)}
                  </div>
                  <span>
                    Reported by <strong className="text-gray-300">{item.reportedBy?.name ?? 'Unknown'}</strong>
                  </span>
                </div>
                <span className="text-gray-600 text-[11px]">{timeAgo(item.createdAt)}</span>
              </div>
            </div>

            {/* Status actions */}
            {item.status !== 'resolved' && (
              <div className="flex gap-2">
                {item.status === 'open' && (
                  <button
                    onClick={() => void updateLostFoundStatus(item.id, 'found')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Mark as Found
                  </button>
                )}
                <button
                  onClick={() => void updateLostFoundStatus(item.id, 'resolved')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark Resolved
                </button>
              </div>
            )}

            {item.status === 'resolved' && item.resolvedBy && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                Resolved by <strong>{item.resolvedBy.name}</strong>
              </div>
            )}

            {/* Responses */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Responses ({item.responses.length})
              </h3>
              {item.responses.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] text-center">
                  <p className="text-xs text-gray-500">No responses yet. Know something? Reply below.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {item.responses.map((r) => (
                    <div key={r.id} className="bg-[#1E1E1E] p-3.5 rounded-xl border border-[#2A2A2A] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${avatarClasses(r.author?.accent)}`}>
                            {initialOf(r.author?.name ?? '?', r.author?.handle)}
                          </div>
                          <span className="font-bold text-white text-xs">{r.author?.name ?? 'Someone'}</span>
                        </div>
                        <span className="text-[10px] text-gray-600">{timeAgo(r.createdAt)}</span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed pl-8">{r.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Response input */}
          <div className="p-3 bg-[#1E1E1E] border-t border-[#2A2A2A] sticky bottom-0 z-20">
            <form onSubmit={handlePost} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${avatarClasses(currentUser.accent)}`}>
                {initialOf(currentUser.name, currentUser.handle)}
              </div>
              <input
                type="text"
                placeholder="I saw it in..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-full bg-background border border-[#2A2A2A] text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-gray-600"
              />
              <button
                type="submit"
                disabled={!responseText.trim() || posting}
                className="p-2 rounded-full bg-primary text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {posting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </motion.div>

      <ConfirmModal
        open={showDelete}
        title="Delete report?"
        message={`"${item.title}" and all its responses will be permanently removed.`}
        onConfirm={async () => {
          // Keep the confirm open if the delete failed, so the error toast
          // isn't contradicted by the thread disappearing.
          if (!(await removeLostFoundItem(item.id))) return;
          setShowDelete(false);
          onClose();
        }}
        onCancel={() => setShowDelete(false)}
      />
    </>
  );
};
