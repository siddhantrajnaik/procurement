import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollLock } from '../lib/useScrollLock';
import { Sample, SampleBox } from '../types';

export interface ParsedRow {
  name: string;
  container: string;
  volume: string;
  notes: string;
  copies: number;
}

/** Matches the samples.name check constraint. */
const MAX_NAME = 200;

interface Props {
  open: boolean;
  onClose: () => void;
  /** newRows are inserted; topUps add copies to samples already in the box. */
  onImport: (newRows: ParsedRow[], topUps: { sampleId: string; delta: number }[], boxId: string | null) => Promise<void>;
  boxes: SampleBox[];
  /** Every sample; the ones in the chosen box are checked for duplicates. */
  samples: Sample[];
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

const HEADER_NAMES = new Set(['name', 'sample', 'sample name']);

/** Header columns, lower-cased, without the empty tail a spreadsheet export leaves. */
function headerCols(text: string): string[] | null {
  const first = text.split(/\r?\n/).find((l) => l.trim());
  if (!first) return null;
  const cols = splitLine(first).map((c) => c.toLowerCase());
  while (cols.length > 1 && !cols[cols.length - 1]) cols.pop();
  return HEADER_NAMES.has(cols[0]) ? cols : null;
}

/**
 * Chemical names are full of commas — "5,6-Carboxyfluorescein",
 * "N,N-dimethyl...". Splitting those on every comma silently turns the tail of
 * a name into a container, so column-splitting is only safe once a header row
 * has said the file really has columns.
 */
export function detectMode(text: string): ImportMode {
  const header = headerCols(text);
  return header && header.length > 1 ? 'columns' : 'names';
}

/** Case-, space- and punctuation-blind, so "KCl" and "k-cl " collide. */
export function sampleKey(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function parseCSV(text: string, mode: ImportMode): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const header = headerCols(text);
  const dataLines = header ? lines.slice(1) : lines;
  const copiesCol = header ? header.findIndex((c) => c === 'copies' || c === 'qty' || c === 'quantity') : -1;

  const parsed = dataLines
    .map((line): ParsedRow => {
      if (mode === 'names') {
        // The whole line is the name, commas and all — minus the ",,," a
        // one-column spreadsheet export tacks on.
        const bare = line.trim().replace(/[,\s]+$/, '').replace(/^"(.*)"$/, '$1').trim();
        return { name: bare, container: '', volume: '', notes: '', copies: 1 };
      }
      const cols = splitLine(line);
      const n = copiesCol > 0 ? parseInt(cols[copiesCol] ?? '', 10) : NaN;
      return {
        name: (cols[0] || '').trim(),
        container: copiesCol === 1 ? '' : cols[1] || '',
        volume: copiesCol === 2 ? '' : cols[2] || '',
        notes: copiesCol === 3 ? '' : cols[3] || '',
        copies: Number.isFinite(n) && n > 0 ? n : 1,
      };
    })
    .filter((r) => r.name.length > 0);

  // The same thing listed twice in one file is two containers of it.
  const merged = new Map<string, ParsedRow>();
  for (const r of parsed) {
    const k = `${sampleKey(r.name)}|${r.container.toLowerCase()}|${r.volume.toLowerCase()}`;
    const prev = merged.get(k);
    if (prev) prev.copies += r.copies; else merged.set(k, { ...r });
  }
  return Array.from(merged.values());
}

export const ImportSamplesModal: React.FC<Props> = ({
  open, onClose, onImport, boxes, samples, preselectedBoxId,
}) => {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [boxId, setBoxId] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [mode, setMode] = useState<ImportMode>('names');
  const [dupAs, setDupAs] = useState<'copies' | 'rows'>('copies');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setRows([]);
      setBoxId(preselectedBoxId ?? '');
      setFileName('');
      setRawText('');
      setMode('names');
      setDupAs('copies');
    }
  }, [open, preselectedBoxId]);

  const existingByKey = useMemo(() => {
    const target = boxId || null;
    const m = new Map<string, Sample[]>();
    for (const sa of samples) {
      if (sa.boxId !== target) continue;
      const k = sampleKey(sa.name);
      if (!k) continue;
      const list = m.get(k);
      if (list) list.push(sa); else m.set(k, [sa]);
    }
    return m;
  }, [samples, boxId]);

  const matchOf = (r: ParsedRow) => existingByKey.get(sampleKey(r.name));
  const tooLong = rows.filter((r) => r.name.length > MAX_NAME).length;
  const dupCount = rows.filter((r) => matchOf(r)).length;

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
    if (rows.length === 0 || tooLong > 0 || importing) return;
    const newRows: ParsedRow[] = [];
    const topUps: { sampleId: string; delta: number }[] = [];
    for (const r of rows) {
      const match = dupAs === 'copies' ? matchOf(r) : undefined;
      if (match) topUps.push({ sampleId: match[0].id, delta: r.copies });
      else newRows.push(r);
    }
    setImporting(true);
    try {
      await onImport(newRows, topUps, boxId || null);
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

              {tooLong > 0 && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                  <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                  <span className="flex-1 min-w-0">
                    {tooLong} name{tooLong !== 1 ? 's are' : ' is'} over {MAX_NAME} characters — probably a paragraph pasted by mistake. Remove {tooLong !== 1 ? 'them' : 'it'} to import.
                  </span>
                  <button
                    onClick={() => setRows((prev) => prev.filter((r) => r.name.length <= MAX_NAME))}
                    className="shrink-0 font-semibold text-red-200 hover:text-white whitespace-nowrap"
                  >
                    Remove
                  </button>
                </div>
              )}

              {dupCount > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    {dupCount} already {boxId ? 'in this box' : 'loose'}
                  </label>
                  <div className="flex gap-1 bg-[#161616] border border-[#2A2A2A] rounded-md p-0.5">
                    <button
                      type="button"
                      onClick={() => setDupAs('copies')}
                      className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                        dupAs === 'copies' ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      Add as extra copies
                    </button>
                    <button
                      type="button"
                      onClick={() => setDupAs('rows')}
                      className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                        dupAs === 'rows' ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      Add as new rows
                    </button>
                  </div>
                </div>
              )}

              <div className="border border-[#2A2A2A] rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-[#161616] px-3 py-2 border-b border-[#2A2A2A]">
                  <span>Name</span>
                  <span className="w-20 text-center">Container</span>
                  <span className="w-16 text-center">Volume</span>
                  <span className="w-16 text-center">Notes</span>
                  <span className="w-8" />
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-[#2A2A2A]">
                  {rows.map((r, i) => {
                    const long = r.name.length > MAX_NAME;
                    const match = matchOf(r);
                    const have = match?.reduce((n, sa) => n + sa.copies, 0) ?? 0;
                    return (
                      <div
                        key={i}
                        className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 items-center px-3 py-1.5 text-xs ${
                          long ? 'bg-red-500/10' : 'hover:bg-[#242424]'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`font-medium truncate ${long ? 'text-red-300' : 'text-white'}`}>{r.name}</span>
                            {r.copies > 1 && (
                              <span className="shrink-0 whitespace-nowrap text-[10px] font-bold px-1.5 py-px rounded border bg-[#2A2A2A] text-gray-300 border-[#333]">
                                ×{r.copies}
                              </span>
                            )}
                          </div>
                          {long ? (
                            <p className="text-[10px] text-red-400 truncate">{r.name.length} chars — max {MAX_NAME}</p>
                          ) : match ? (
                            <p className="text-[10px] text-amber-300 truncate">
                              already {boxId ? 'in this box' : 'loose'}{have > 1 ? ` ×${have}` : ''}
                              {dupAs === 'copies' ? ' · adds copies' : ''}
                            </p>
                          ) : null}
                        </div>
                        <span className="w-20 text-center text-gray-400 truncate">{r.container || '—'}</span>
                        <span className="w-16 text-center text-gray-400 truncate">{r.volume || '—'}</span>
                        <span className="w-16 text-center text-gray-400 truncate">{r.notes || '—'}</span>
                        <button onClick={() => removeRow(i)} aria-label="Remove row" className="w-8 flex justify-center text-gray-600 hover:text-red-400 transition-colors">
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    );
                  })}
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
            disabled={rows.length === 0 || tooLong > 0 || importing}
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
