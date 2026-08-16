import { useEffect, useState } from 'react';
import { ScrollLock } from '../lib/useScrollLock';
import { Sample, SampleBox } from '../types';

const CONTAINERS = ['Microcentrifuge tube', '15 mL Falcon', '50 mL Falcon', 'Cryovial', 'PCR tube'];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; boxId: string | null; container: string; volume: string; notes: string }) => Promise<void>;
  onMove?: (toBoxId: string | null) => Promise<void>;
  onDelete?: () => Promise<void>;
  editSample: Sample | null;
  boxes: SampleBox[];
  preselectedBoxId: string | null;
}

export const AddSampleModal: React.FC<Props> = ({
  open, onClose, onSubmit, onMove, onDelete, editSample, boxes, preselectedBoxId,
}) => {
  const [name, setName] = useState('');
  const [boxId, setBoxId] = useState<string>('');
  const [container, setContainer] = useState('');
  const [volume, setVolume] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showMoveSelect, setShowMoveSelect] = useState(false);
  const [moveTarget, setMoveTarget] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      if (editSample) {
        setName(editSample.name);
        setBoxId(editSample.boxId ?? '');
        setContainer(editSample.container);
        setVolume(editSample.volume);
        setNotes(editSample.notes);
      } else {
        setName('');
        setBoxId(preselectedBoxId ?? '');
        setContainer('');
        setVolume('');
        setNotes('');
      }
      setShowMoveSelect(false);
      setMoveTarget('');
      setConfirmDelete(false);
    }
  }, [open, editSample, preselectedBoxId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isValid = name.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        boxId: boxId || null,
        container,
        volume: volume.trim(),
        notes: notes.trim(),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleMove = async () => {
    if (!onMove || submitting) return;
    setSubmitting(true);
    try {
      await onMove(moveTarget || null);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || submitting) return;
    setSubmitting(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <ScrollLock />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] bg-[#1E1E1E] border border-[#2A2A2A] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-y-auto animate-sheet">
        <div className="sticky top-0 bg-[#1E1E1E] border-b border-[#2A2A2A] px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-white">{editSample ? 'Edit sample' : 'Add sample'}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Sample name</label>
            <input
              className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="e.g. pET28a-GFP, HeLa P12"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {!editSample && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Box
                <span className="text-gray-500 font-normal normal-case ml-1">(optional)</span>
              </label>
              <select
                className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                value={boxId}
                onChange={(e) => setBoxId(e.target.value)}
              >
                <option value="">No box (loose)</option>
                {boxes.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}{b.condition ? ` (${b.condition})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Container
              <span className="text-gray-500 font-normal normal-case ml-1">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {CONTAINERS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setContainer(container === c ? '' : c)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                    container === c
                      ? 'bg-primary/15 text-primary border-primary/30'
                      : 'bg-[#161616] text-gray-400 border-[#2A2A2A] hover:text-gray-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Or type custom..."
              value={container}
              onChange={(e) => setContainer(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Volume / amount
              <span className="text-gray-500 font-normal normal-case ml-1">(optional)</span>
            </label>
            <input
              className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="e.g. 500 µL, 2 mg"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Notes
              <span className="text-gray-500 font-normal normal-case ml-1">(optional)</span>
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
              placeholder="Strain, construct, passage, buffer..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {editSample && onMove && (
            <div className="border-t border-[#2A2A2A] pt-4">
              {!showMoveSelect ? (
                <button
                  onClick={() => { setShowMoveSelect(true); setMoveTarget(''); }}
                  className="w-full py-2 text-sm font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-md hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                  Move to another box
                </button>
              ) : (
                <div className="space-y-2">
                  <select
                    className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white focus:outline-none focus:border-primary"
                    value={moveTarget}
                    onChange={(e) => setMoveTarget(e.target.value)}
                  >
                    <option value="">No box (loose)</option>
                    {boxes.filter((b) => b.id !== editSample.boxId).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}{b.condition ? ` (${b.condition})` : ''}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowMoveSelect(false)}
                      className="flex-1 py-2 text-sm font-medium text-gray-300 bg-[#2A2A2A] rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleMove()}
                      disabled={submitting}
                      className="flex-1 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-40"
                    >
                      {submitting ? 'Moving...' : 'Move'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {editSample && onDelete && (
            <div className="border-t border-[#2A2A2A] pt-4">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-2 text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Delete sample
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2 text-sm font-medium text-gray-300 bg-[#2A2A2A] rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleDelete()}
                    disabled={submitting}
                    className="flex-1 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 disabled:opacity-40"
                  >
                    {submitting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-[#1E1E1E] border-t border-[#2A2A2A] px-5 py-4 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-300 bg-[#2A2A2A] rounded-md hover:bg-[#333] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!isValid || submitting}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : editSample ? 'Save' : 'Add sample'}
          </button>
        </div>
      </div>
    </div>
  );
};
