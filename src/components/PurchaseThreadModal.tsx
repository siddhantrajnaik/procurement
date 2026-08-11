import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Send,
  Paperclip,
  ShieldAlert,
  Plus,
  Trash2,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PurchaseStatus, Quotation } from '../types';
import { StatusChip } from './StatusChip';
import { QuotationCard } from './QuotationCard';
import { AddQuotationModal } from './AddQuotationModal';
import { PdfViewerModal } from './PdfViewerModal';
import { ConfirmModal } from './ConfirmModal';
import { avatarClasses } from '../lib/accent';
import { initialOf, roleLabel, timeAgo } from '../lib/format';

export const PurchaseThreadModal: React.FC = () => {
  const {
    selectedPurchase,
    setSelectedPurchase,
    currentUser,
    updateStatus,
    addComment,
    approvePi,
    selectQuotation,
    deletePurchase,
  } = useApp();

  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isAddQuoteOpen, setIsAddQuoteOpen] = useState(false);
  const [previewQuote, setPreviewQuote] = useState<Quotation | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!selectedPurchase) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isAddQuoteOpen && !previewQuote && !showDeleteConfirm) {
        setSelectedPurchase(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedPurchase, setSelectedPurchase, isAddQuoteOpen, previewQuote, showDeleteConfirm]);

  if (!selectedPurchase || !currentUser) return null;

  const p = selectedPurchase;

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isPostingComment) return;
    setIsPostingComment(true);
    try {
      await addComment(p.id, commentText.trim());
      setCommentText('');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleStatusChange = (s: PurchaseStatus) => {
    void updateStatus(p.id, s);
  };

  const timeline: { id: PurchaseStatus; label: string }[] = [
    { id: 'waiting', label: 'Requested' },
    { id: 'quotes', label: 'Quotes' },
    { id: 'ordered', label: 'Ordered' },
    { id: 'transit', label: 'Transit' },
    { id: 'delivered', label: 'Delivered' },
  ];

  const stepIndex = (s: PurchaseStatus) => {
    const map: Record<PurchaseStatus, number> = {
      waiting: 0,
      quotes: 1,
      ordered: 2,
      transit: 3,
      delivered: 4,
      closed: 4,
    };
    return map[s] ?? 0;
  };

  const curIdx = stepIndex(p.status);
  const canManage =
    currentUser.role === 'procurement_incharge' ||
    currentUser.role === 'pi' ||
    currentUser.id === p.requestedBy?.id;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs flex justify-center" role="dialog" aria-modal="true" aria-label="Purchase thread">
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="w-full max-w-md h-full bg-background flex flex-col overflow-hidden sm:rounded-xl sm:my-4 sm:h-[94vh] shadow-2xl border border-[#2A2A2A]"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#2A2A2A] flex items-center justify-between bg-[#1E1E1E] sticky top-0 z-20">
            <button
              onClick={() => setSelectedPurchase(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-[#2A2A2A] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Thread
            </span>
            {canManage ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-6" />
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">
            {/* Title card */}
            <div className="bg-[#1E1E1E] p-5 rounded-xl border border-[#2A2A2A] space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-extrabold text-white tracking-tight">
                    {p.title}
                  </h1>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Quantity: <span className="text-gray-300 font-semibold">{p.quantity}</span>
                  </p>
                </div>
                <StatusChip status={p.status} size="lg" />
              </div>

              <p className="text-xs text-gray-400 leading-relaxed bg-background p-3 rounded-lg border border-[#2A2A2A]">
                {p.description}
              </p>

              <div className="flex items-center justify-between pt-1 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${avatarClasses(p.requestedBy?.accent)}`}
                  >
                    {initialOf(p.requestedBy?.name ?? '?')}
                  </div>
                  <span>
                    By{' '}
                    <strong className="text-gray-300">
                      {p.requestedBy?.name ?? 'Unknown'}
                    </strong>
                  </span>
                </div>
                <span className="text-gray-600 text-[11px]">{timeAgo(p.createdAt)}</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-[#1E1E1E] p-4 rounded-xl border border-[#2A2A2A] space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Order Timeline
              </p>
              <div className="flex items-center justify-between relative px-2 pt-2">
                <div className="absolute top-5 left-6 right-6 h-0.5 bg-[#2A2A2A]" />
                <div
                  className="absolute top-5 left-6 h-0.5 bg-primary transition-all duration-300"
                  style={{ width: `${(curIdx / (timeline.length - 1)) * 85}%` }}
                />
                {timeline.map((s, idx) => {
                  const passed = idx <= curIdx;
                  const current = idx === curIdx;
                  return (
                    <button
                      key={s.id}
                      onClick={() => canManage && handleStatusChange(s.id)}
                      className="relative z-10 flex flex-col items-center group cursor-pointer"
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                          current
                            ? 'bg-primary text-white ring-4 ring-primary/20 scale-110'
                            : passed
                            ? 'bg-primary text-white'
                            : 'bg-[#2A2A2A] text-gray-500 border border-[#333]'
                        }`}
                      >
                        {passed ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <span
                        className={`text-[10px] font-medium mt-1.5 ${
                          current
                            ? 'text-primary font-bold'
                            : passed
                            ? 'text-gray-300'
                            : 'text-gray-600'
                        }`}
                      >
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PI Approval */}
            {p.requiresPiApproval && (
              <div
                className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                  p.piApproved
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      p.piApproved
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs">
                      {p.piApproved
                        ? 'PI Expenditure Approved'
                        : 'PI Approval Required (> 25k)'}
                    </h4>
                    <p className="text-[11px] opacity-80">
                      {p.piApproved
                        ? 'The PI approved this purchase.'
                        : 'Requires PI signoff before dispatch.'}
                    </p>
                  </div>
                </div>
                {!p.piApproved && currentUser.role === 'pi' && (
                  <button
                    onClick={() => void approvePi(p.id)}
                    className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-lg transition-colors"
                  >
                    Approve
                  </button>
                )}
              </div>
            )}

            {/* Quotations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-gray-600" />
                  Quotations ({p.quotations.length})
                </h3>
                <button
                  onClick={() => setIsAddQuoteOpen(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-2.5 py-1 rounded-full transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Quote
                </button>
              </div>

              {p.quotations.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] text-center space-y-2">
                  <p className="text-xs text-gray-500">No quotations yet.</p>
                  <button
                    onClick={() => setIsAddQuoteOpen(true)}
                    className="text-xs font-semibold text-purple-400 hover:underline"
                  >
                    Upload first vendor quote
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {p.quotations.map((q) => (
                    <QuotationCard
                      key={q.id}
                      quotation={q}
                      onPreviewFile={setPreviewQuote}
                      canApprove={canManage}
                      onSelectApproved={(quotation) => {
                        void selectQuotation(p.id, quotation);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Thread ({p.comments.length})
              </h3>
              <div className="space-y-3">
                {p.comments.map((c) => (
                  <div
                    key={c.id}
                    className="bg-[#1E1E1E] p-3.5 rounded-xl border border-[#2A2A2A] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${avatarClasses(c.author?.accent)}`}
                        >
                          {initialOf(c.author?.name ?? '?')}
                        </div>
                        <span className="font-bold text-white text-xs">
                          {c.author?.name ?? 'Someone'}
                        </span>
                        <span className="text-[10px] text-gray-600 capitalize">
                          ({roleLabel(c.author?.role)})
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-600">
                        {timeAgo(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed pl-8">{c.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Comment input */}
          <div className="p-3 bg-[#1E1E1E] border-t border-[#2A2A2A] sticky bottom-0 z-20">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handlePostComment(e);
              }}
              className="flex items-center gap-2"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${avatarClasses(currentUser.accent)}`}
              >
                {initialOf(currentUser.name)}
              </div>
              <input
                type="text"
                placeholder="Reply in thread..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-full bg-background border border-[#2A2A2A] text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-gray-600"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || isPostingComment}
                className="p-2 rounded-full bg-primary text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isPostingComment ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>

      <AddQuotationModal
        purchaseId={p.id}
        isOpen={isAddQuoteOpen}
        onClose={() => setIsAddQuoteOpen(false)}
      />

      <PdfViewerModal
        quotation={previewQuote}
        purchase={p}
        onClose={() => setPreviewQuote(null)}
      />

      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete request?"
        message={`"${p.title}" and all its quotations, comments, and history will be permanently removed.`}
        onConfirm={async () => {
          await deletePurchase(p.id);
          setShowDeleteConfirm(false);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </AnimatePresence>
  );
};
