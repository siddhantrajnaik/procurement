import { Quotation } from '../types';
import { formatRupees, formatFileSize, timeAgo } from '../lib/format';
import { FileText, CheckCircle, ExternalLink, Sparkles, Pencil, Trash2 } from 'lucide-react';

interface QuotationCardProps {
  quotation: Quotation;
  onPreviewFile: (q: Quotation) => void;
  onSelectApproved?: (q: Quotation) => void;
  onEdit?: (q: Quotation) => void;
  onDelete?: (q: Quotation) => void;
  canManage?: boolean;
  canApprove?: boolean;
}

export const QuotationCard: React.FC<QuotationCardProps> = ({
  quotation,
  onPreviewFile,
  onSelectApproved,
  onEdit,
  onDelete,
  canManage = false,
  canApprove = false,
}) => {
  return (
    <div
      className={`relative p-3.5 rounded-xl border transition-colors ${
        quotation.isApproved
          ? 'bg-blue-500/10 border-blue-500/30'
          : quotation.isRecommended
          ? 'bg-purple-500/10 border-purple-500/20'
          : 'bg-[#1E1E1E] border-[#2A2A2A] hover:border-[#333]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-white text-sm">{quotation.vendor}</span>
            {quotation.isApproved && (
              <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle className="w-2.5 h-2.5" /> PO Selected
              </span>
            )}
            {quotation.isRecommended && !quotation.isApproved && (
              <span className="bg-purple-500/20 text-purple-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Best Value
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="font-extrabold text-white text-base tracking-tight">
              {formatRupees(quotation.price)}
            </span>
            <span className="text-[11px] text-gray-500 font-medium">
              {timeAgo(quotation.createdAt)}
            </span>
          </div>

          {quotation.notes && (
            <p className="text-xs text-gray-400 bg-background p-1.5 rounded-lg border border-[#2A2A2A] mb-2">
              {quotation.notes}
            </p>
          )}

          {quotation.filePath && (
            <button
              onClick={() => onPreviewFile(quotation)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2A2A2A] hover:bg-[#333] text-gray-300 text-xs font-medium transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-red-400" />
              <span className="truncate max-w-[140px]">
                {quotation.fileName ?? 'Quotation file'}
              </span>
              {quotation.fileSize && (
                <span className="text-gray-500 text-[10px]">
                  ({formatFileSize(quotation.fileSize)})
                </span>
              )}
              <ExternalLink className="w-3 h-3 text-gray-500 ml-0.5" />
            </button>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {canApprove && !quotation.isApproved && onSelectApproved && (
            <button
              onClick={() => onSelectApproved(quotation)}
              className="py-1.5 px-3 bg-primary hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Select PO
            </button>
          )}
          {canManage && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <button
                  onClick={() => onEdit(quotation)}
                  className="p-1 rounded-full text-gray-500 hover:text-white hover:bg-[#2A2A2A] transition-colors"
                  title="Edit quotation"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(quotation)}
                  className="p-1 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete quotation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
