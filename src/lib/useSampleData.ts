import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import * as api from './api';
import { Sample, SampleBox, SampleCheckout, SampleLogEntry } from '../types';

let channelSeq = 0;

/**
 * Boxes, samples and open check-outs, kept live.
 *
 * Realtime sends one event per row, so a 44-row import is ~88 events. Each one
 * used to trigger a full refetch on every open phone; they are now collected
 * for a quarter second and answered with a single reload, as AppContext does.
 */
export function useSampleData({ withLog = false }: { withLog?: boolean } = {}) {
  const [boxes, setBoxes] = useState<SampleBox[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [checkouts, setCheckouts] = useState<SampleCheckout[]>([]);
  const [log, setLog] = useState<SampleLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestSeq = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++requestSeq.current;
    // Separately, so a missing check-outs table cannot blank the whole lab.
    const [b, s, c, l] = await Promise.allSettled([
      api.fetchSampleBoxes(),
      api.fetchSamples(),
      api.fetchOpenCheckouts(),
      withLog ? api.fetchSampleLog() : Promise.resolve(null),
    ]);
    // A slower, older response must not overwrite a newer one.
    if (!mountedRef.current || seq !== requestSeq.current) return;
    if (b.status === 'fulfilled') setBoxes(b.value);
    if (s.status === 'fulfilled') setSamples(s.value);
    if (c.status === 'fulfilled') setCheckouts(c.value);
    if (l.status === 'fulfilled' && l.value) setLog(l.value);
    // An empty lab and an unreachable lab must not look the same.
    setError(b.status === 'rejected' || s.status === 'rejected' ? 'Could not load samples.' : null);
    setLoading(false);
  }, [withLog]);

  useEffect(() => {
    mountedRef.current = true;
    void reload();
    return () => { mountedRef.current = false; };
  }, [reload]);

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const queue = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => { pending = null; void reload(); }, 250);
    };
    // Unique name: two screens can hold this hook at once.
    let channel = supabase.channel(`sample-data-${++channelSeq}`);
    for (const table of ['sample_boxes', 'samples', 'sample_checkouts', ...(withLog ? ['sample_log'] : [])]) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, queue);
    }
    channel.subscribe();
    return () => {
      if (pending) clearTimeout(pending);
      void supabase.removeChannel(channel);
    };
  }, [reload, withLog]);

  const outBySample = useMemo(() => {
    const m = new Map<string, SampleCheckout[]>();
    for (const c of checkouts) {
      const list = m.get(c.sampleId);
      if (list) list.push(c); else m.set(c.sampleId, [c]);
    }
    return m;
  }, [checkouts]);

  return { boxes, samples, checkouts, outBySample, log, loading, error, reload };
}
