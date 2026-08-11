import { PurchaseStatus } from '../types';

interface StatusChipProps {
  status: PurchaseStatus;
  size?: 'sm' | 'md' | 'lg';
}

const CONFIG: Record<PurchaseStatus, { label: string; chip: string; dot: string }> = {
  waiting: {
    label: 'Waiting for quotes',
    chip: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    dot: 'bg-amber-400',
  },
  quotes: {
    label: 'Quotes received',
    chip: 'bg-purple-500/10 text-purple-300 border-purple-500/25',
    dot: 'bg-purple-400',
  },
  ordered: {
    label: 'Ordered',
    chip: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
    dot: 'bg-blue-400',
  },
  transit: {
    label: 'In transit',
    chip: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25',
    dot: 'bg-indigo-400',
  },
  delivered: {
    label: 'Delivered',
    chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    dot: 'bg-emerald-400',
  },
  closed: {
    label: 'Closed',
    chip: 'bg-gray-500/10 text-gray-400 border-gray-500/25',
    dot: 'bg-gray-500',
  },
};

export const StatusChip: React.FC<StatusChipProps> = ({ status, size = 'md' }) => {
  const config = CONFIG[status];
  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px] font-medium'
      : size === 'lg'
        ? 'px-3.5 py-1.5 text-xs font-semibold'
        : 'px-2.5 py-1 text-[11.5px] font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap ${config.chip} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};
