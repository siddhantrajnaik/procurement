import { motion, AnimatePresence } from 'motion/react';
import { useUI } from '../context/UIContext';
import { CheckCircle2, Info, AlertTriangle, XCircle } from 'lucide-react';

const STYLES = {
  success: 'bg-emerald-950/95 text-emerald-100 border-emerald-800',
  warning: 'bg-amber-950/95 text-amber-100 border-amber-800',
  error: 'bg-red-950/95 text-red-100 border-red-800',
  info: 'bg-[#1E1E1E]/95 text-gray-100 border-[#2A2A2A]',
} as const;

const ICONS = {
  success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
  error: <XCircle className="w-4 h-4 text-red-400 shrink-0" />,
  info: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
} as const;

export const NotificationToast: React.FC = () => {
  const { toast } = useUI();

  return (
    <div
      className="fixed top-20 left-0 right-0 z-[60] px-4 pointer-events-none flex justify-center"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ y: -20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.95 }}
            className={`pointer-events-auto max-w-md px-4 py-2.5 rounded-full shadow-lg border text-xs font-semibold flex items-center gap-2 backdrop-blur-md ${STYLES[toast.type]}`}
          >
            {ICONS[toast.type]}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
