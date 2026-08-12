import { Equipment, EquipmentStatus } from '../types';
import { equipmentIconSvg, EquipmentCategory } from '../lib/equipmentIcons';

const STATUS_CONFIG: Record<EquipmentStatus, { label: string; color: string; bg: string; border: string }> = {
  working:         { label: 'Working',         color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  needs_attention: { label: 'Needs Attention', color: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  down:            { label: 'Down',            color: 'text-red-300',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
  under_service:   { label: 'Under Service',   color: 'text-blue-300',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
};

interface EquipmentCardProps {
  equipment: Equipment;
  onClick: () => void;
}

export const EquipmentCard: React.FC<EquipmentCardProps> = ({ equipment: eq, onClick }) => {
  const st = STATUS_CONFIG[eq.status] ?? STATUS_CONFIG.working;
  const openIssues = eq.issues.filter((i) => i.status !== 'fixed').length;
  const nextMaintenance = eq.maintenanceLogs
    .map((m) => m.nextDueDate)
    .filter(Boolean)
    .sort()
    .at(0);
  const overdue = nextMaintenance && new Date(nextMaintenance) < new Date();

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[#1E1E1E] rounded-xl border border-[#2A2A2A] hover:border-primary/50 transition-colors p-4 space-y-3"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-lg bg-[#2A2A2A] border border-[#333] flex items-center justify-center text-gray-400 shrink-0"
          dangerouslySetInnerHTML={{ __html: equipmentIconSvg(eq.category as EquipmentCategory) }}
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-bold text-sm truncate">{eq.name}</h3>
          {eq.model && (
            <p className="text-gray-500 text-[11px] font-medium truncate">
              {eq.manufacturer ? `${eq.manufacturer} · ` : ''}{eq.model}
            </p>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.color} ${st.bg} ${st.border} shrink-0`}>
          {st.label}
        </span>
      </div>

      {eq.location && (
        <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
          <span className="material-symbols-outlined text-[14px]">location_on</span>
          {eq.location}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {openIssues > 0 && (
          <span className="inline-flex items-center gap-1 text-red-300 text-[11px] font-semibold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
            <span className="material-symbols-outlined text-[14px]">warning</span>
            {openIssues} open issue{openIssues > 1 ? 's' : ''}
          </span>
        )}
        {overdue && (
          <span className="inline-flex items-center gap-1 text-amber-300 text-[11px] font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            Maintenance overdue
          </span>
        )}
        {eq.servicePhone && (
          <span className="inline-flex items-center gap-1 text-gray-400 text-[11px]">
            <span className="material-symbols-outlined text-[14px]">call</span>
            {eq.serviceContactPerson || eq.serviceVendor}
          </span>
        )}
      </div>
    </button>
  );
};
