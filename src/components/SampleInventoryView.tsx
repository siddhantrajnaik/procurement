import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { supabase } from '../lib/supabase';
import * as api from '../lib/api';
import { Sample, SampleBox, SampleLogEntry } from '../types';
import { timeAgo } from '../lib/format';
import { avatarClasses } from '../lib/accent';
import { initialOf } from '../lib/format';
import { AddBoxModal } from './AddBoxModal';
import { AddSampleModal } from './AddSampleModal';
import { ConfirmModal } from './ConfirmModal';

const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
  added:   { icon: 'add_circle',    color: 'text-emerald-400' },
  moved:   { icon: 'swap_horiz',    color: 'text-blue-400' },
  updated: { icon: 'edit',          color: 'text-amber-400' },
  removed: { icon: 'delete',        color: 'text-red-400' },
};

const CONDITION_COLORS: Record<string, string> = {
  '-80°C': 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  '-20°C': 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  '4°C':   'bg-sky-500/15 text-sky-300 border-sky-500/25',
  'RT':    'bg-amber-500/15 text-amber-300 border-amber-500/25',
  'LN₂':  'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
};

const stagger = (i: number): React.CSSProperties => ({
  opacity: 0,
  animation: 'fade-in 0.2s ease-out both',
  animationDelay: `${Math.min(i * 45, 400)}ms`,
});

export const SampleInventoryView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { currentUser } = useAuth();
  const { showToast } = useUI();

  const [boxes, setBoxes] = useState<SampleBox[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [sampleLog, setSampleLog] = useState<SampleLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'boxes' | 'log'>('boxes');
  const [search, setSearch] = useState('');
  const [expandedBoxId, setExpandedBoxId] = useState<string | null>(null);

  const [showBoxModal, setShowBoxModal] = useState(false);
  const [editBox, setEditBox] = useState<SampleBox | null>(null);
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [editSample, setEditSample] = useState<Sample | null>(null);
  const [addSampleBoxId, setAddSampleBoxId] = useState<string | null>(null);
  const [deleteBoxTarget, setDeleteBoxTarget] = useState<SampleBox | null>(null);

  const mountedRef = useRef(true);
  const hasAnimated = useRef(false);

  const reload = useCallback(async () => {
    try {
      const [b, s, l] = await Promise.all([
        api.fetchSampleBoxes(),
        api.fetchSamples(),
        api.fetchSampleLog(),
      ]);
      if (mountedRef.current) {
        setBoxes(b);
        setSamples(s);
        setSampleLog(l);
      }
    } catch {
      // silently fail — tables may not exist yet
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
    if (!loading && !hasAnimated.current) {
      const raf = requestAnimationFrame(() => { hasAnimated.current = true; });
      return () => cancelAnimationFrame(raf);
    }
  }, [loading]);

  useEffect(() => {
    const channel = supabase
      .channel('sample-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sample_boxes' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'samples' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sample_log' }, () => void reload())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reload]);

  const existingLocations = useMemo(() => {
    const locs = new Set(boxes.map((b) => b.location).filter(Boolean));
    return Array.from(locs).sort();
  }, [boxes]);

  const samplesInBox = useCallback(
    (boxId: string) => samples.filter((s) => s.boxId === boxId),
    [samples]
  );

  const looseSamples = useMemo(
    () => samples.filter((s) => s.boxId === null),
    [samples]
  );

  const filteredBoxes = useMemo(() => {
    if (!search) return boxes;
    const q = search.toLowerCase();
    return boxes.filter((b) => {
      if (b.name.toLowerCase().includes(q) || b.condition.toLowerCase().includes(q) || b.location.toLowerCase().includes(q)) return true;
      return samplesInBox(b.id).some((s) => s.name.toLowerCase().includes(q));
    });
  }, [boxes, search, samplesInBox]);

  const filteredLoose = useMemo(() => {
    if (!search) return looseSamples;
    const q = search.toLowerCase();
    return looseSamples.filter((s) => s.name.toLowerCase().includes(q));
  }, [looseSamples, search]);

  const handleCreateBox = async (input: { name: string; condition: string; location: string }) => {
    if (!currentUser) return;
    try {
      await api.createSampleBox(input, currentUser);
      showToast(`Box "${input.name}" created.`, 'success');
    } catch {
      showToast('Could not create box.', 'error');
      throw new Error();
    }
  };

  const handleEditBox = async (input: { name: string; condition: string; location: string }) => {
    if (!editBox) return;
    try {
      await api.updateSampleBox(editBox.id, input);
      showToast(`Box "${input.name}" updated.`, 'success');
    } catch {
      showToast('Could not update box.', 'error');
      throw new Error();
    }
  };

  const handleDeleteBox = async (box: SampleBox) => {
    try {
      await api.deleteSampleBox(box.id);
      showToast(`Box "${box.name}" deleted.`, 'warning');
      setDeleteBoxTarget(null);
    } catch {
      showToast('Could not delete box.', 'error');
    }
  };

  const handleCreateSample = async (input: { name: string; boxId: string | null; container: string; volume: string; notes: string }) => {
    if (!currentUser) return;
    try {
      await api.createSample(input, currentUser);
      showToast(`Sample "${input.name}" added.`, 'success');
    } catch {
      showToast('Could not add sample.', 'error');
      throw new Error();
    }
  };

  const handleUpdateSample = async (input: { name: string; boxId: string | null; container: string; volume: string; notes: string }) => {
    if (!editSample || !currentUser) return;
    try {
      await api.updateSample(editSample.id, input, currentUser);
      showToast(`Sample "${input.name}" updated.`, 'success');
    } catch {
      showToast('Could not update sample.', 'error');
      throw new Error();
    }
  };

  const handleMoveSample = async (toBoxId: string | null) => {
    if (!editSample || !currentUser) return;
    try {
      const fromBox = boxes.find((b) => b.id === editSample.boxId);
      const toBox = boxes.find((b) => b.id === toBoxId);
      await api.moveSample(editSample.id, toBoxId, fromBox?.name ?? '', toBox?.name ?? 'loose', currentUser);
      showToast(`Moved "${editSample.name}".`, 'info');
    } catch {
      showToast('Could not move sample.', 'error');
      throw new Error();
    }
  };

  const handleDeleteSample = async () => {
    if (!editSample || !currentUser) return;
    try {
      await api.deleteSample(editSample.id, currentUser);
      showToast(`Sample "${editSample.name}" removed.`, 'warning');
    } catch {
      showToast('Could not delete sample.', 'error');
      throw new Error();
    }
  };

  const s = (i: number) => hasAnimated.current ? undefined : stagger(i);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-[#2A2A2A] border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full mx-auto pb-24 md:pb-8 flex flex-col max-w-3xl px-4 md:px-0">
      <div className="py-4 mt-2 md:mt-6" style={s(0)}>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-3"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back
        </button>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-white">Sample Inventory</h1>
          <span className="text-xs font-semibold text-gray-500 bg-[#1E1E1E] border border-[#2A2A2A] px-2.5 py-1 rounded-full">
            {samples.length} sample{samples.length !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-sm text-gray-400">Track boxes, tubes & storage</p>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4" style={s(1)}>
        <div className="flex gap-1 bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg p-0.5">
          <button
            onClick={() => setSubTab('boxes')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              subTab === 'boxes' ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Boxes
          </button>
          <button
            onClick={() => setSubTab('log')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              subTab === 'log' ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Log
          </button>
        </div>
        {subTab === 'boxes' && (
          <button
            onClick={() => { setEditBox(null); setShowBoxModal(true); }}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-orange-600 transition-colors font-medium text-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New box
          </button>
        )}
      </div>

      {subTab === 'boxes' && (
        <>
          <div className="relative mb-3" style={s(2)}>
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]">search</span>
            <input
              className="w-full pl-9 pr-4 py-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-white placeholder:text-gray-500"
              placeholder="Search boxes or samples..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filteredBoxes.length === 0 && filteredLoose.length === 0 && !search && (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E]" style={s(3)}>
              <span className="material-symbols-outlined text-gray-600 text-4xl mb-3">science</span>
              <h3 className="text-white font-medium text-sm mb-1">No boxes yet</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                Create a storage box to start tracking your samples.
              </p>
            </div>
          )}

          {filteredBoxes.length === 0 && filteredLoose.length === 0 && search && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-gray-400 text-sm">No matches for "{search}"</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {filteredBoxes.map((box, idx) => {
              const boxSamples = samplesInBox(box.id);
              const isExpanded = expandedBoxId === box.id;
              const conditionClass = CONDITION_COLORS[box.condition] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/25';

              return (
                <div key={box.id} className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl overflow-hidden" style={s(idx + 3)}>
                  <button
                    onClick={() => setExpandedBoxId(isExpanded ? null : box.id)}
                    className="w-full text-left p-4 flex items-center gap-3 hover:bg-[#242424] transition-colors"
                  >
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={{ transition: 'transform 0.2s ease-out', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    >
                      chevron_right
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white">{box.name}</span>
                        {box.condition && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${conditionClass}`}>
                            {box.condition}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-500">{boxSamples.length} sample{boxSamples.length !== 1 ? 's' : ''}</span>
                      </div>
                      {box.location && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          {box.location}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <span
                        onClick={(e) => { e.stopPropagation(); setEditBox(box); setShowBoxModal(true); }}
                        className="p-1.5 rounded-md text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </span>
                      <span
                        onClick={(e) => { e.stopPropagation(); setDeleteBoxTarget(box); }}
                        className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </span>
                    </div>
                  </button>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: isExpanded ? '1fr' : '0fr',
                      transition: 'grid-template-rows 0.25s ease-out',
                    }}
                  >
                    <div style={{ overflow: 'hidden', minHeight: 0 }}>
                      <div className="border-t border-[#2A2A2A] px-4 pb-3">
                        {boxSamples.length === 0 ? (
                          <p className="text-xs text-gray-500 py-3 text-center">No samples in this box</p>
                        ) : (
                          <div className="divide-y divide-[#2A2A2A]">
                            {boxSamples.map((sa) => (
                              <button
                                key={sa.id}
                                onClick={() => { setEditSample(sa); setAddSampleBoxId(null); setShowSampleModal(true); }}
                                className="w-full text-left py-2.5 flex items-center gap-3 hover:bg-[#242424] transition-colors rounded"
                              >
                                <span className="material-symbols-outlined text-[16px] text-gray-500">science</span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium text-white truncate block">{sa.name}</span>
                                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                    {sa.container && <span>{sa.container}</span>}
                                    {sa.volume && <span>{sa.volume}</span>}
                                    <span>{timeAgo(sa.createdAt)}</span>
                                  </div>
                                </div>
                                {sa.addedBy && (
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${avatarClasses(sa.addedBy.accent)}`}>
                                    {initialOf(sa.addedBy.name, sa.addedBy.handle)}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => { setEditSample(null); setAddSampleBoxId(box.id); setShowSampleModal(true); }}
                          className="mt-2 w-full py-2 text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded-md hover:bg-primary/20 transition-colors flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>
                          Add sample
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredLoose.length > 0 && (
              <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-4" style={s(filteredBoxes.length + 3)}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Loose samples</h3>
                <div className="divide-y divide-[#2A2A2A]">
                  {filteredLoose.map((sa) => (
                    <button
                      key={sa.id}
                      onClick={() => { setEditSample(sa); setAddSampleBoxId(null); setShowSampleModal(true); }}
                      className="w-full text-left py-2.5 flex items-center gap-3 hover:bg-[#242424] transition-colors rounded"
                    >
                      <span className="material-symbols-outlined text-[16px] text-gray-500">science</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-white truncate block">{sa.name}</span>
                        <div className="flex items-center gap-2 text-[11px] text-gray-500">
                          {sa.container && <span>{sa.container}</span>}
                          {sa.volume && <span>{sa.volume}</span>}
                          <span>{timeAgo(sa.createdAt)}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(filteredBoxes.length > 0 || filteredLoose.length > 0) && (
            <button
              onClick={() => { setEditSample(null); setAddSampleBoxId(null); setShowSampleModal(true); }}
              className="mt-4 w-full py-2.5 text-sm font-medium text-gray-300 bg-[#1E1E1E] border border-[#2A2A2A] border-dashed rounded-xl hover:border-primary/40 hover:text-white transition-colors flex items-center justify-center gap-1.5"
              style={s(filteredBoxes.length + (filteredLoose.length > 0 ? 1 : 0) + 3)}
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add sample
            </button>
          )}
        </>
      )}

      {subTab === 'log' && (
        <div className="flex flex-col gap-2">
          {sampleLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E] animate-fade-in">
              <span className="material-symbols-outlined text-gray-600 text-4xl mb-3">history</span>
              <h3 className="text-white font-medium text-sm mb-1">No activity yet</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                Sample movements and changes will appear here.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-1 animate-fade-in">{sampleLog.length} entr{sampleLog.length !== 1 ? 'ies' : 'y'}</p>
              {sampleLog.map((entry, idx) => {
                const meta = ACTION_ICONS[entry.action] ?? ACTION_ICONS.updated;
                const sample = entry.sampleId ? samples.find((sa) => sa.id === entry.sampleId) : null;
                const sampleName = sample?.name ?? (entry.action === 'removed' && entry.details ? entry.details : 'sample');
                return (
                  <div
                    key={entry.id}
                    className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3 flex gap-3"
                    style={stagger(idx)}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <span className={`material-symbols-outlined text-[20px] ${meta.color}`}>{meta.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200">
                        {entry.actor && <span className="font-semibold text-white">{entry.actor.name}</span>}{' '}
                        {entry.action}{' '}
                        <span className="font-medium text-white">{sampleName}</span>
                      </p>
                      {entry.details && entry.action !== 'removed' && (
                        <p className="text-xs text-gray-500 mt-0.5">{entry.details}</p>
                      )}
                      <p className="text-[11px] text-gray-500 mt-1">{timeAgo(entry.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      <AddBoxModal
        open={showBoxModal}
        onClose={() => { setShowBoxModal(false); setEditBox(null); }}
        onSubmit={editBox ? handleEditBox : handleCreateBox}
        editBox={editBox}
        existingLocations={existingLocations}
      />

      <AddSampleModal
        open={showSampleModal}
        onClose={() => { setShowSampleModal(false); setEditSample(null); setAddSampleBoxId(null); }}
        onSubmit={editSample ? handleUpdateSample : handleCreateSample}
        onMove={editSample ? handleMoveSample : undefined}
        onDelete={editSample ? handleDeleteSample : undefined}
        editSample={editSample}
        boxes={boxes}
        preselectedBoxId={addSampleBoxId}
      />

      <ConfirmModal
        open={deleteBoxTarget !== null}
        title="Delete box?"
        message={`"${deleteBoxTarget?.name}" will be deleted. Samples inside will become loose (not deleted).`}
        confirmLabel="Delete"
        busyLabel="Deleting..."
        onConfirm={() => { if (deleteBoxTarget) return handleDeleteBox(deleteBoxTarget); }}
        onCancel={() => setDeleteBoxTarget(null)}
      />
    </div>
  );
};
