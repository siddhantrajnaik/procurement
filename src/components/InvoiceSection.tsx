import { useRef, useState } from 'react';
import { Receipt, FileUp, Trash2, ExternalLink, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Purchase } from '../types';
import { getInvoiceFileUrl } from '../lib/api';
import { formatFileSize, timeAgo } from '../lib/format';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  purchase: Purchase;
  canManage: boolean;
}

export const InvoiceSection: React.FC<Props> = ({ purchase, canManage }) => {
  const { uploadInvoice, removeInvoice } = useApp();
  const { showToast } = useUI();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  const [opening, setOpening] = useState(false);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked after a failure
    if (!file) return;

    if (file.size > 10 * 1024 * 1024 && !file.type.startsWith('image/')) {
      showToast('PDFs must be under 10 MB.', 'error');
      return;
    }

    setUploading(true);
    try {
      await uploadInvoice(purchase.id, file);
    } finally {
      setUploading(false);
    }
  };

  const handleOpen = async () => {
    if (!purchase.invoicePath || opening) return;
    setOpening(true);
    try {
      const url = await getInvoiceFileUrl(purchase.invoicePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      showToast('Could not open the invoice.', 'error');
    } finally {
      setOpening(false);
    }
  };

  const isPdf = purchase.invoiceName?.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5 text-gray-600" />
          Invoice
        </h3>
        <span className="text-[10px] text-gray-600 font-medium">Optional</span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        onChange={(e) => void handlePick(e)}
        className="hidden"
      />

      {purchase.invoicePath ? (
        <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {purchase.invoiceName ?? 'Invoice'}
                </p>
                <p className="text-[10px] text-gray-500">
                  {purchase.invoiceSize ? formatFileSize(purchase.invoiceSize) : '—'}
                  {purchase.invoiceUploadedBy && ` · ${purchase.invoiceUploadedBy.name}`}
                  {purchase.invoiceUploadedAt && ` · ${timeAgo(purchase.invoiceUploadedAt)}`}
                </p>
              </div>
            </div>
            {canManage && (
              <button
                onClick={() => setShowRemove(true)}
                className="p-1.5 rounded-full text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                title="Remove invoice"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void handleOpen()}
              disabled={opening}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#2A2A2A] hover:bg-[#333] text-gray-200 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {opening ? 'Opening…' : isPdf ? 'Open PDF' : 'View Invoice'}
            </button>
            {canManage && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[#2A2A2A] bg-background hover:border-emerald-500/40 text-gray-400 hover:text-emerald-300 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <FileUp className="w-3.5 h-3.5" />
                {uploading ? 'Uploading…' : 'Replace'}
              </button>
            )}
          </div>
        </div>
      ) : canManage ? (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full flex flex-col items-center justify-center gap-1.5 py-6 rounded-xl border border-dashed border-[#2A2A2A] bg-[#1E1E1E] hover:border-emerald-500/40 text-gray-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
              <span className="text-xs font-medium">Compressing & uploading…</span>
            </>
          ) : (
            <>
              <FileUp className="w-5 h-5" />
              <span className="text-xs font-semibold">Attach invoice</span>
              <span className="text-[10px] text-gray-600">
                Photo or PDF — images are compressed automatically
              </span>
            </>
          )}
        </button>
      ) : (
        <div className="p-4 rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] text-center">
          <p className="text-xs text-gray-500">No invoice attached.</p>
        </div>
      )}

      <ConfirmModal
        open={showRemove}
        title="Remove invoice?"
        message={`"${purchase.invoiceName ?? 'The invoice'}" will be permanently deleted.`}
        onConfirm={async () => {
          if (await removeInvoice(purchase.id)) setShowRemove(false);
        }}
        onCancel={() => setShowRemove(false)}
      />
    </div>
  );
};
