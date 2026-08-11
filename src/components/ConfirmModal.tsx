import { useEffect, useState } from 'react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: 'red' | 'primary';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<Props> = ({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  confirmColor = 'red',
  onConfirm,
  onCancel,
}) => {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  const btnClass =
    confirmColor === 'red'
      ? 'bg-red-500 hover:bg-red-600'
      : 'bg-primary hover:bg-orange-600';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-xs bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 shadow-2xl text-center space-y-4">
        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-red-400 text-[20px]">warning</span>
        </div>
        <div>
          <h3 className="font-bold text-white text-base mb-1">{title}</h3>
          <p className="text-xs text-gray-400 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-gray-300 bg-[#2A2A2A] rounded-md hover:bg-[#333] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={busy}
            className={`flex-1 py-2.5 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-40 ${btnClass}`}
          >
            {busy ? `${confirmLabel.replace(/e$/, '')}ing...` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
