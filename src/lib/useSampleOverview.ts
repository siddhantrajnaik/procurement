import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import * as api from './api';
import { Sample, SampleBox } from '../types';

/**
 * Read-only view of the sample tables for screens that display samples but do
 * not own them. Sample Inventory remains the single place they are edited.
 */
export function useSampleOverview() {
  const [boxes, setBoxes] = useState<SampleBox[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([api.fetchSampleBoxes(), api.fetchSamples()]);
      if (mountedRef.current) {
        setBoxes(b);
        setSamples(s);
      }
    } catch {
      // Tables may not exist on an older deployment; an empty list is correct.
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void reload();
    return () => { mountedRef.current = false; };
  }, [reload]);

  useEffect(() => {
    const channel = supabase
      .channel('sample-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sample_boxes' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'samples' }, () => void reload())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reload]);

  return { boxes, samples, loading };
}
