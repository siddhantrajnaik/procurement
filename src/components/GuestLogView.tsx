import { useMemo, useState } from 'react';
import { ArrowLeft, FlaskConical, Beaker, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import * as api from '../lib/api';
import { timeAgo } from '../lib/format';
import { LabActivityEntry, useLabActivity } from '../lib/useLabActivity';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  onBack: () => void;
}

/** Describes an entry in the confirm prompt, so nobody deletes the wrong line. */
function describe(entry: LabActivityEntry, instrument: string): string {
  return entry.kind === 'usage'
    ? `${entry.row.visitorName} used ${instrument}`
    : `${entry.row.visitorName} took ${entry.row.itemName}`;
}

/**
 * What visitors did — instrument use and anything they took — in one feed.
 *
 * The fetch, the subscription and the merge live in useLabActivity, shared with
 * the PI's dashboard so both screens read the same rows.
 *
 * This is the only screen that can delete an entry. Visitors write here and the
 * PI reads it, so a test row or a mistyped name has to be removable by someone,
 * and the lab is the only party with the standing to decide it was wrong.
 */
export const GuestLogView: React.FC<Props> = ({ onBack }) => {
  const { equipment } = useApp();
  const { showToast } = useUI();
  const { usage, loans, entries, loading, reload } = useLabActivity();
  const [pendingDelete, setPendingDelete] = useState<LabActivityEntry | null>(null);

  const equipmentNames = useMemo(
    () => new Map(equipment.map((e) => [e.id, e.name])),
    [equipment]
  );

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const { kind, row } = pendingDelete;
    try {
      if (kind === 'usage') await api.deleteEquipmentUsage(row.id);
      else await api.deleteConsumableLoan(row.id);
      // Realtime would get here eventually, but the row should leave the screen
      // the moment it leaves the table — a deleted line still sitting there
      // reads as a failure.
      await reload();
      showToast('Entry removed.', 'success');
      setPendingDelete(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not remove that.', 'error');
      // ConfirmModal does not close itself, so leaving it open on failure keeps
      // the prompt and the toast on screen together.
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-28 pt-4 max-w-3xl mx-auto w-full px-4 space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Visitor Log</h1>
          <p className="text-[11px] text-gray-500">
            {loading ? 'Loading…' : `${usage.length} instrument use${usage.length === 1 ? '' : 's'} · ${loans.length} item${loans.length === 1 ? '' : 's'} taken`}
          </p>
        </div>
      </div>

      {!loading && entries.length === 0 ? (
        <div className="p-8 rounded-xl bg-[#1E1E1E] border border-dashed border-[#2A2A2A] text-center space-y-1">
          <p className="text-sm text-gray-400 font-medium">Nothing logged yet</p>
          <p className="text-xs text-gray-600">
            Instrument use and borrowed items recorded by visitors will collect here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isUsage = entry.kind === 'usage';
            const Icon = isUsage ? FlaskConical : Beaker;
            return (
              <div
                key={`${entry.kind}-${entry.row.id}`}
                className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3.5 flex items-start gap-3"
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    isUsage
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm text-gray-200 min-w-0">
                      <strong className="font-bold text-white">{entry.row.visitorName}</strong>
                      {isUsage ? ' used ' : ' took '}
                      <span className="font-semibold text-gray-300">
                        {isUsage
                          ? equipmentNames.get(entry.row.equipmentId) ?? 'an instrument'
                          : entry.row.itemName}
                      </span>
                      {!isUsage && entry.row.quantity && (
                        <span className="text-gray-500"> ({entry.row.quantity})</span>
                      )}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] text-gray-600">{timeAgo(entry.at)}</span>
                      <button
                        onClick={() => setPendingDelete(entry)}
                        aria-label={`Remove: ${describe(entry, isUsage ? equipmentNames.get(entry.row.equipmentId) ?? 'an instrument' : '')}`}
                        title="Remove this entry"
                        className="p-1 rounded-full text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {entry.row.affiliation && (
                    <p className="text-[11px] text-gray-500 mt-0.5">{entry.row.affiliation}</p>
                  )}
                  {isUsage
                    ? entry.row.purpose && (
                        <p className="text-[11px] text-gray-400 mt-1">{entry.row.purpose}</p>
                      )
                    : entry.row.notes && (
                        <p className="text-[11px] text-gray-400 mt-1">{entry.row.notes}</p>
                      )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={pendingDelete !== null}
        title="Remove this entry?"
        message={
          pendingDelete
            ? `"${describe(
                pendingDelete,
                pendingDelete.kind === 'usage'
                  ? equipmentNames.get(pendingDelete.row.equipmentId) ?? 'an instrument'
                  : ''
              )}" will be deleted for good. It also disappears from the PI's overview.`
            : ''
        }
        confirmLabel="Remove"
        busyLabel="Removing…"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
