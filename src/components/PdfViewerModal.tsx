import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Download, ExternalLink } from 'lucide-react';
import { Quotation, Purchase } from '../types';
import { getQuotationFileUrl } from '../lib/api';
import { formatRupees, formatFileSize, timeAgo } from '../lib/format';
import { ScrollLock } from '../lib/useScrollLock';

interface PdfViewerModalProps {
  quotation: Quotation | null;
  purchase: Purchase | null;
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  quotation,
  purchase,
  onClose,
}) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!quotation?.filePath) {
      setSignedUrl(null);
      return;
    }
    setLoading(true);
    getQuotationFileUrl(quotation.filePath)
      .then(setSignedUrl)
      .catch(() => setSignedUrl(null))
      .finally(() => setLoading(false));
  }, [quotation?.filePath]);

  useEffect(() => {
    if (!quotation) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [quotation, onClose]);

  return (
    <AnimatePresence>
      {quotation && (
        <motion.div
          key="pdf-viewer"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <ScrollLock />
          {/* Dim on its own layer, entry in CSS — see PurchaseThreadModal. */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs animate-overlay"
            exit={{ opacity: 0 }}
          />
          <motion.div
            exit={{ scale: 0.95, opacity: 0 }}
            className="animate-pop relative w-full max-w-md bg-[#1E1E1E] rounded-xl shadow-2xl overflow-hidden border border-[#2A2A2A] flex flex-col max-h-[85vh]"
          >
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-[#161616] border-b border-[#2A2A2A]">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-5 h-5 text-red-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {quotation.fileName ?? 'Quotation file'}
                </p>
                <p className="text-[10px] text-gray-500">
                  {quotation.fileSize ? formatFileSize(quotation.fileSize) : '—'} ·{' '}
                  {quotation.vendor}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {signedUrl && (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : signedUrl ? (
              <>
                {quotation.fileName?.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={signedUrl}
                    title={quotation.fileName}
                    className="w-full h-96 rounded-lg border border-[#2A2A2A] bg-white"
                  />
                ) : (
                  <img
                    src={signedUrl}
                    alt={quotation.fileName ?? 'Quotation'}
                    className="w-full rounded-lg border border-[#2A2A2A]"
                  />
                )}
              </>
            ) : (
              <div className="bg-background rounded-lg border border-[#2A2A2A] p-6 space-y-4">
                <div className="flex justify-between items-start border-b border-[#2A2A2A] pb-4">
                  <div>
                    <h3 className="font-bold text-lg text-white">{quotation.vendor}</h3>
                    <p className="text-xs text-gray-500">Quotation</p>
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">
                    {timeAgo(quotation.createdAt)}
                  </span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Line Items
                  </p>
                  <div className="bg-[#1E1E1E] p-3 rounded-lg space-y-1.5 text-xs border border-[#2A2A2A]">
                    <div className="flex justify-between font-semibold text-white">
                      <span>{purchase?.title ?? 'Item'}</span>
                      <span>{formatRupees(quotation.price)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 text-[11px]">
                      <span>Qty: {purchase?.quantity ?? '—'}</span>
                    </div>
                  </div>
                </div>

                {quotation.notes && (
                  <div className="text-xs text-gray-300 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                    <span className="font-bold text-amber-300 block mb-0.5">
                      Vendor Notes:
                    </span>
                    {quotation.notes}
                  </div>
                )}

                <div className="pt-2 border-t border-[#2A2A2A] flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-400">Total</span>
                  <span className="text-lg font-extrabold text-white">
                    {formatRupees(quotation.price)}
                  </span>
                </div>

                <p className="text-[11px] text-gray-600 text-center">
                  No file attached — this is a summary view.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-[#161616] border-t border-[#2A2A2A] flex justify-between items-center">
            <span className="text-xs text-gray-500">
              {quotation.uploadedBy?.name ?? 'Unknown uploader'}
            </span>
            {signedUrl ? (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-5 bg-primary text-white font-semibold text-xs rounded-lg hover:bg-orange-600 transition-colors inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Full
              </a>
            ) : (
              <button
                onClick={onClose}
                className="py-2 px-5 bg-[#2A2A2A] text-white font-semibold text-xs rounded-lg hover:bg-[#333] transition-colors"
              >
                Done
              </button>
            )}
          </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
