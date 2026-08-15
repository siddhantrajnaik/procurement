import { useState } from 'react';
import { Purchase } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { StatusChip } from './StatusChip';
import { ConfirmModal } from './ConfirmModal';
import { RecordDeliveryModal } from './RecordDeliveryModal';
import { avatarClasses } from '../lib/accent';
import { imageForItem } from '../lib/images';
import { formatRupees, initialOf, timeAgo } from '../lib/format';

interface PurchaseCardProps {
  purchase: Purchase;
  onClick: () => void;
  onOpenQuickMenu: (p: Purchase, e: React.MouseEvent) => void;
  onEdit: (p: Purchase) => void;
}

export const PurchaseCard: React.FC<PurchaseCardProps> = ({
  purchase,
  onClick,
  onOpenQuickMenu,
  onEdit,
}) => {
  const { deletePurchase } = useApp();
  const { currentUser } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const image = imageForItem(purchase.title, purchase.category);
  const requester = purchase.requestedBy;
  const isAdmin = currentUser?.role === 'procurement_incharge' || currentUser?.role === 'pi';
  const approvedQuote = purchase.quotations.find((q) => q.isApproved);
  const isUrgent = purchase.priority === 'urgent' || purchase.priority === 'critical';

  return (
    <article className="thread-line flex gap-4">
      <div
        className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-[13px] z-10 border-4 border-background ${avatarClasses(requester?.accent)}`}
        title={requester?.name}
      >
        {initialOf(requester?.name ?? '?', requester?.handle)}
      </div>

      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className="flex-1 min-w-0 bg-[#1E1E1E] p-4 rounded-xl border border-[#2A2A2A] hover:border-primary/50 focus:border-primary focus:outline-none transition-colors cursor-pointer relative z-10 overflow-hidden"
      >
        <div className="flex justify-between items-start gap-2 mb-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-bold text-white text-[15px] truncate">
              {requester?.name ?? 'Unknown member'}
            </span>
            <span className="text-gray-500 text-[12px] font-medium shrink-0">
              {timeAgo(purchase.createdAt)}
            </span>
          </div>
          <StatusChip status={purchase.status} size="sm" />
        </div>

        <div className="flex gap-3">
          {image && (
            <img
              src={image.src}
              alt={image.alt}
              loading="lazy"
              width={72}
              height={72}
              className="w-[72px] h-[72px] rounded-lg object-cover border border-[#2A2A2A] shrink-0 bg-[#121212]"
            />
          )}

          <div className="min-w-0 flex-1">
            <span className="inline-block bg-[#2A2A2A] border border-[#333] text-gray-300 px-2 py-0.5 rounded text-[11px] font-semibold mb-1.5">
              {purchase.category}
            </span>
            <p className="text-white font-semibold text-[14px] leading-snug">
              {purchase.title}{' '}
              <span className="text-gray-400 font-normal">({purchase.quantity})</span>
            </p>
            <p className="text-gray-400 text-[12px] leading-relaxed line-clamp-2 mt-0.5">
              {purchase.description}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3 overflow-hidden">
          {isUrgent && purchase.status !== 'delivered' && purchase.status !== 'closed' && (
            <span className="inline-flex items-center gap-1 text-red-300 text-[11px] font-semibold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
              <span className="material-symbols-outlined text-[14px]">priority_high</span>
              {purchase.priority === 'critical' ? 'Critical' : 'Urgent'}
            </span>
          )}
          {purchase.status === 'partial' && purchase.deliveries.length > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-300 text-[11px] font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              <span className="material-symbols-outlined text-[14px]">local_shipping</span>
              {purchase.deliveries.length} delivery{purchase.deliveries.length > 1 ? ' batches' : ''}
            </span>
          )}
          {purchase.quotations.length > 0 && (
            <span className="inline-flex items-center gap-1 text-gray-300 text-[11px] font-medium bg-[#2A2A2A] px-2 py-0.5 rounded border border-[#333]">
              <span className="material-symbols-outlined text-[14px]">description</span>
              {purchase.quotations.length} quote{purchase.quotations.length > 1 ? 's' : ''}
            </span>
          )}
          {approvedQuote && (
            <span className="inline-flex items-center gap-1 text-blue-300 text-[11px] font-semibold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              {formatRupees(approvedQuote.price)} · {approvedQuote.vendor}
            </span>
          )}
          {purchase.comments.length > 0 && (
            <span className="inline-flex items-center gap-1 text-gray-400 text-[11px] font-medium">
              <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
              {purchase.comments.length}
            </span>
          )}
        </div>

        {(isAdmin || currentUser?.id === purchase.requestedBy?.id) && (
          <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-[#2A2A2A]">
            {(purchase.status === 'ordered' || purchase.status === 'transit' || purchase.status === 'partial') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeliveryModal(true);
                }}
                className="text-[13px] font-semibold px-3 py-1.5 rounded-md bg-primary text-white hover:bg-orange-600 transition-colors"
              >
                {purchase.status === 'partial' ? 'Record delivery' : 'Mark received'}
              </button>
            )}
            {isAdmin && purchase.status !== 'ordered' && purchase.status !== 'transit' && purchase.status !== 'partial' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenQuickMenu(purchase, e);
                }}
                className="text-[13px] font-semibold px-3 py-1.5 rounded-md bg-[#2A2A2A] border border-[#333] text-white hover:bg-[#333] transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                Quick actions
              </button>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(purchase);
                }}
                className="p-1.5 rounded-md text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                title="Edit"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </div>
        )}

        <ConfirmModal
          open={showDeleteConfirm}
          title="Delete request?"
          message={`"${purchase.title}" and all its quotations, comments, and history will be permanently removed.`}
          onConfirm={() => deletePurchase(purchase.id)}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </div>

      <RecordDeliveryModal
        purchase={purchase}
        isOpen={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
      />
    </article>
  );
};
