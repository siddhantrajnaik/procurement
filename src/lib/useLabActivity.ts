import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api';
import { supabase } from './supabase';
import { ConsumableLoan, EquipmentUsage } from '../types';

export type LabActivityEntry =
  | { kind: 'usage'; at: string; row: EquipmentUsage }
  | { kind: 'loan'; at: string; row: ConsumableLoan };

export interface LabActivity {
  usage: EquipmentUsage[];
  loans: ConsumableLoan[];
  /** Both logs merged, newest first. */
  entries: LabActivityEntry[];
  loading: boolean;
  /** Refetch both logs. Realtime covers the usual case; this is for acting locally. */
  reload: () => Promise<void>;
}

/**
 * What happened in the lab — instrument sessions and anything taken away.
 *
 * Fetched here rather than through AppContext because both screens that need it
 * are rarely opened, and there is no reason for every session in the lab to
 * carry two more tables. Extracted from GuestLogView so the visitor log and the
 * PI's dashboard read the same rows through the same subscription instead of
 * drifting apart.
 */
export function useLabActivity(): LabActivity {
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
      // Silently fail — the tables do not exist until migration 0023 is run,
      // and an empty screen beats an error on a read-only reference view.
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
      .channel('lab-activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_usage_log' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consumable_loans' }, () => void reload())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload]);

  const entries = useMemo<LabActivityEntry[]>(() => {
    const merged: LabActivityEntry[] = [
      ...usage.map((row) => ({ kind: 'usage' as const, at: row.createdAt, row })),
      ...loans.map((row) => ({ kind: 'loan' as const, at: row.createdAt, row })),
    ];
    return merged.sort((a, b) => b.at.localeCompare(a.at));
  }, [usage, loans]);

  return { usage, loans, entries, loading, reload };
}
