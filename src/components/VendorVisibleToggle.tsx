import { Store } from 'lucide-react';

export const VendorVisibleToggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
      checked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-background border-[#2A2A2A] hover:border-[#3A3A3A]'
    }`}
  >
    <Store className={`w-4 h-4 mt-0.5 shrink-0 ${checked ? 'text-emerald-400' : 'text-gray-500'}`} />
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-semibold text-white">Show to vendors</span>
      <span className="block text-[11px] text-gray-400 mt-0.5">
        Name, cat. no., quantity and brand appear on the public vendor page until it's ordered.
      </span>
    </span>
    <span
      aria-hidden
      className={`shrink-0 mt-0.5 w-9 h-5 rounded-full p-0.5 transition-colors ${checked ? 'bg-emerald-500' : 'bg-[#3A3A3A]'}`}
    >
      <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </span>
  </button>
);
