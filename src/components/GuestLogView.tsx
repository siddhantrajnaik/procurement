import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FlaskConical, Beaker } from 'lucide-react';
import * as api from '../lib/api';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { ConsumableLoan, EquipmentUsage } from '../types';
import { timeAgo } from '../lib/format';

interface Props {
  onBack: () => void;
}

type Entry =
  | { kind: 'usage'; at: string; row: EquipmentUsage }
  | { kind: 'loan'; at: string; row: ConsumableLoan };

/**
 * What visitors did — instrument use and anything they took — in one feed.
 *
 * Fetched locally rather than through AppContext: this is a rarely-opened
 * reference screen, and there is no reason for every session to carry it.
 */
export const GuestLogView: React.FC<Props> = ({ onBack }) => {
  const { equipment } = useApp();
  const [usage, setUsage] = useState<EquipmentUsage[]>([]);
  const [loans, setLoans] = useState<ConsumableLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    try {
      const [u, l] = await Promise.all([api.fetchEquipmentUsage(), api.fetchConsumableLoans()]);
      if (!mounted.current) return;
      setUsage(u);
      setLoans(l);
    } catch {
      // Silently fail — the tables may not exist until migration 0023 is run.
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  useEffect(() => {
    const channel = supabase
      .channel('guest-log')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_usage_log' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consumable_loans' }, () => void reload())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload]);

  const equipmentNames = useMemo(
    () => new Map(equipment.map((e) => [e.id, e.name])),
    [equipment]
  );

  const entries = useMemo<Entry[]>(() => {
    const merged: Entry[] = [
      ...usage.map((row) => ({ kind: 'usage' as const, at: row.createdAt, row })),
      ...loans.map((row) => ({ kind: 'loan' as const, at: row.createdAt, row })),
    ];
    return merged.sort((a, b) => b.at.localeCompare(a.at));
  }, [usage, loans]);

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
                    <span className="text-[11px] text-gray-600 shrink-0">
                      {timeAgo(entry.at)}
                    </span>
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
    </div>
  );
};
