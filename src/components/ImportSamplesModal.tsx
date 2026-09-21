import { useEffect, useRef, useState } from 'react';
import { ScrollLock } from '../lib/useScrollLock';
import { SampleBox } from '../types';

interface ParsedRow {
  name: string;
  container: string;
  volume: string;
  notes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (rows: ParsedRow[], boxId: string | null) => Promise<void>;
  boxes: SampleBox[];
  preselectedBoxId: string | null;
}

/** Split one CSV line, treating commas inside double quotes as literal. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      out.push(field.trim());
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field.trim());
  return out;
}

export type ImportMode = 'names' | 'columns';

/**
 * Chemical names are full of commas — "5,6-Carboxyfluorescein",
 * "N,N-dimethyl...". Splitting those on every comma silently turns the tail of
 * a name into a container, so column-splitting is only safe once a header row
 * has said the file really has columns.
 */
export function detectMode(text: string): ImportMode {
  const first = text.split(/\r?\n/).find((l) => l.trim());
  if (!first) return 'names';
  const cols = splitLine(first).map((c) => c.toLowerCase());
  const looksLikeHeader =
    cols.length > 1 &&
    (cols[0] === 'name' || cols[0] === 'sample' || cols[0] === 'sample name');
  return looksLikeHeader ? 'columns' : 'names';
}

function parseCSV(text: string, mode: ImportMode): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const headerPresent = detectMode(text) === 'columns';
  const dataLines = headerPresent ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      if (mode === 'names') {
        // The whole line is the name, commas and all.
        const bare = line.trim().replace(/^"(.*)"$/, '$1');
        return { name: bare, container: '', volume: '', notes: '' };
      }
      const cols = splitLine(line);
      return {
        name: cols[0] || '',
        container: cols[1] || '',
        volume: cols[2] || '',
        notes: cols[3] || '',
      };
    })
    .filter((r) => r.name.length > 0);
}

export const ImportSamplesModal: React.FC<Props> = ({
  open, onClose, onImport, boxes, preselectedBoxId,
}) => {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [boxId, setBoxId] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [mode, setMode] = useState<ImportMode>('names');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setRows([]);
      setBoxId(preselectedBoxId ?? '');
      setFileName('');
      setRawText('');
      setMode('names');
    }
  }, [open, preselectedBoxId]);

  const load = (text: string, name: string) => {
    const detected = detectMode(text);
    setRawText(text);
    setMode(detected);
    setRows(parseCSV(text, detected));
    setFileName(name);
  };

  const switchMode = (next: ImportMode) => {
    setMode(next);
    setRows(parseCSV(rawText, next));
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => load(reader.result as string, file.name);
    reader.readAsText(file);
  };

  const handlePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.trim()) {
      load(text, 'pasted');
    } else {
      setRows([]);
      setFileName('');
      setRawText('');
    }
  };

  const removeRow = (i: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleImport = async () => {
    if (rows.length === 0 || importing) return;
    setImporting(true);
    try {
      await onImport(rows, boxId || null);
      onClose();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <ScrollLock />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] bg-[#1E1E1E] border border-[#2A2A2A] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-sheet">
        <div className="sticky top-0 bg-[#1E1E1E] border-b border-[#2A2A2A] px-5 py-4 flex items-center justify-between z-10 shrink-0">
          <h2 className="text-lg font-bold text-white">Import samples from CSV</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {rows.length === 0 ? (
            <>
              <div>
                <p className="text-xs text-gray-400 mb-3">
                  One sample per line. A plain list of names works as-is — commas
                  inside a name are kept.
                  <br />
                  For columns, start the file with a header row:{' '}
                  <span className="text-gray-300 font-mono">name,container,volume,notes</span>
                </p>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-8 border-2 border-dashed border-[#2A2A2A] rounded-xl hover:border-primary/40 transition-colors flex flex-col items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-3xl text-gray-500">upload_file</span>
                  <span className="text-sm text-gray-400">Click to pick a .csv file</span>
                </button>
                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#2A2A2A]" />
                <span className="text-[11px] font-semibold text-gray-500 uppercase">or paste</span>
                <div className="flex-1 h-px bg-[#2A2A2A]" />
              </div>

              <textarea
                rows={5}
                className="w-full px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                placeholder={"Silver nitrate\n5,6-Carboxyfluorescein\nTrypan blue"}
                onChange={handlePaste}
              />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-300">
                  <span className="font-bold text-white">{rows.length}</span> sample{rows.length !== 1 ? 's' : ''} parsed
                  {fileName && <span className="text-gray-500 ml-1.5">from {fileName}</span>}
                </p>
                <button
                  onClick={() => {
                    setRows([]); setFileName(''); setRawText('');
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Read each line as
                </label>
                <div className="flex gap-1 bg-[#161616] border border-[#2A2A2A] rounded-md p-0.5">
                  <button
                    type="button"
                    onClick={() => switchMode('names')}
                    className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                      mode === 'names' ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Just a name
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('columns')}
                    className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                      mode === 'columns' ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Comma columns
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  {mode === 'names'
                    ? 'The whole line is the sample name — commas in names like "5,6-Carboxyfluorescein" are kept.'
                    : 'Split on commas into name, container, volume, notes. Put quotes around a name that contains a comma.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Import into box</label>
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

              <div className="border border-[#2A2A2A] rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-[#161616] px-3 py-2 border-b border-[#2A2A2A]">
                  <span>Name</span>
                  <span className="w-20 text-center">Container</span>
                  <span className="w-16 text-center">Volume</span>
                  <span className="w-16 text-center">Notes</span>
                  <span className="w-8" />
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-[#2A2A2A]">
                  {rows.map((r, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 items-center px-3 py-1.5 text-xs hover:bg-[#242424]">
                      <span className="text-white font-medium truncate pr-2">{r.name}</span>
                      <span className="w-20 text-center text-gray-400 truncate">{r.container || '—'}</span>
                      <span className="w-16 text-center text-gray-400 truncate">{r.volume || '—'}</span>
                      <span className="w-16 text-center text-gray-400 truncate">{r.notes || '—'}</span>
                      <button onClick={() => removeRow(i)} className="w-8 flex justify-center text-gray-600 hover:text-red-400 transition-colors">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-[#1E1E1E] border-t border-[#2A2A2A] px-5 py-4 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-300 bg-[#2A2A2A] rounded-md hover:bg-[#333] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => void handleImport()}
            disabled={rows.length === 0 || importing}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">upload</span>
            {importing ? 'Importing...' : `Import ${rows.length} sample${rows.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};
