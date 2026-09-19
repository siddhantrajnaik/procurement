import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api';
import { todayISO } from './format';
import { NewPIReminderInput, PIReminder, ReminderRecurrence } from '../types';

export interface PIReminders {
  /** Everything, newest deadline first. */
  all: PIReminder[];
  /** Still outstanding — a recurring one is always here, between slots. */
  open: PIReminder[];
  /** Finished one-offs. */
  done: PIReminder[];
  /** Open and dated today or earlier. The number worth putting on a button. */
  dueCount: number;
  loading: boolean;
  /** Set when the list could not be read at all — usually 0030 not run yet. */
  error: string | null;
  reload: () => Promise<void>;
  create: (input: NewPIReminderInput) => Promise<void>;
  update: (
    id: string,
    updates: {
      memberId?: string;
      title?: string;
      note?: string;
      dueDate?: string | null;
      recurrence?: ReminderRecurrence;
    }
  ) => Promise<void>;
  complete: (reminder: PIReminder) => Promise<void>;
  reopen: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * The PI's own follow-ups on her people.
 *
 * Kept out of AppContext deliberately: every session in the lab subscribes to
 * that, and there is no reason for twelve students' devices to carry a table
 * only one person can reach. One reader, one screen, so no realtime channel
 * either — she cannot race herself.
 *
 * Mutations refetch rather than patching local state. The list is a dozen rows
 * at most, and a recurring reminder's new due date is computed server-side from
 * the row that was there, so re-reading is both cheaper to reason about and
 * correct by construction.
 */
export function usePIReminders(): PIReminders {
  const [all, setAll] = useState<PIReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    try {
      const rows = await api.fetchPIReminders();
      if (!mounted.current) return;
      setAll(rows);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : 'Could not load reminders.');
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

  const create = useCallback(
    async (input: NewPIReminderInput) => {
      await api.createPIReminder(input);
      await reload();
    },
    [reload]
  );

  const update = useCallback<PIReminders['update']>(
    async (id, updates) => {
      await api.updatePIReminder(id, updates);
      await reload();
    },
    [reload]
  );

  const complete = useCallback(
    async (reminder: PIReminder) => {
      await api.completePIReminder(reminder);
      await reload();
    },
    [reload]
  );

  const reopen = useCallback(
    async (id: string) => {
      await api.reopenPIReminder(id);
      await reload();
    },
    [reload]
  );

  const remove = useCallback(
    async (id: string) => {
      await api.deletePIReminder(id);
      await reload();
    },
    [reload]
  );

  const { open, done, dueCount } = useMemo(() => {
    const today = todayISO();
    const openRows = all.filter((r) => !r.completed);
    return {
      open: openRows,
      done: all.filter((r) => r.completed),
      // Undated reminders are never "due" — they are standing intentions with
      // no deadline, and counting them would make the badge permanent.
      dueCount: openRows.filter((r) => r.dueDate !== null && r.dueDate <= today).length,
    };
  }, [all]);

  return { all, open, done, dueCount, loading, error, reload, create, update, complete, reopen, remove };
}
