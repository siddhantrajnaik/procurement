import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useReadOnly } from '../../lib/useReadOnly';
import { useSampleData } from '../../lib/useSampleData';
import { useSpeech } from '../../lib/useSpeech';
import { ScrollLock } from '../../lib/useScrollLock';
import { parse, parseItem } from '../../lib/assistant/parse';
import { askAi } from '../../lib/assistant/ai';
import { rankBoxes } from './resolve';
import { WEAK } from '../../lib/assistant/match';
import type { Intent } from '../../lib/assistant/types';
import { AddPanel, BoxPanel, FindPanel, LowPanel, MovePanel, PanelData, RequestPanel, RestockPanel, ReturnPanel, SwapPanel, TakePanel } from './panels';

const EXAMPLES = [
  'where is triton',
  "what's in CC-S05",
  "what's running low?",
  'took out FCV and moved trypan blue to PN01',
  'used 50 mL methanol',
  'we need 2 boxes of 15 mL falcons, urgent',
];

const LOOKUPS: Intent['kind'][] = ['find', 'box', 'low', 'empty'];

interface Shown { id: number; intent: Intent }
let shownSeq = 0;

// Phone keyboards have no Shift+Enter, so there Enter makes a new line and the
// arrow button runs the command.
const coarsePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/** Floating button + sheet. `bottom` lifts it clear of a shell's bottom nav and the iPhone home bar. */
export const AssistantButton: React.FC<{ bottom?: string }> = ({
  bottom = 'bottom-[calc(88px+env(safe-area-inset-bottom))] md:bottom-6',
}) => {
  const [open, setOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open assistant"
        title="Assistant — find, add, move, take"
        className={`fixed right-4 ${bottom} z-40 w-12 h-12 rounded-full bg-primary text-white shadow-lg shadow-black/40 flex items-center justify-center hover:bg-orange-600 transition-colors`}
      >
        <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
      </button>
      {open && <AssistantSheet onClose={() => { setOpen(false); requestAnimationFrame(() => fabRef.current?.focus()); }} />}
    </>
  );
};

function AssistantSheet({ onClose }: { onClose: () => void }) {
  const { inventoryItems, consumeItem, restockItem, moveItem, createPurchase } = useApp();
  const { currentUser } = useAuth();
  const { showToast, setActiveTab, setPendingProfileView } = useUI();
  const readOnly = useReadOnly();
  const { boxes, samples, outBySample, loading, error: loadError, reload } = useSampleData();

  const [text, setText] = useState('');
  const [results, setResults] = useState<Shown[]>([]);
  const [reply, setReply] = useState<string | null>(null);
  const [mode, setMode] = useState<'smart' | 'basic' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const runSeq = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoRun = useRef(false);
  const textRef = useRef('');
  textRef.current = text;

  const lookupNames = useMemo(() => ({
    boxes: boxes.map((b) => b.name),
    items: [...new Set([...samples.map((x) => x.name), ...inventoryItems.map((i) => i.name)])],
  }), [boxes, samples, inventoryItems]);
  const namesRef = useRef(lookupNames);
  namesRef.current = lookupNames;

  // Gemini first; the built-in parser whenever it is offline, over the daily
  // cap, or has nothing to say, so the assistant never stops working.
  const run = useCallback(async (value: string) => {
    const t = value.trim();
    const mine = ++runSeq.current;
    setResults([]); setReply(null); setNotice(null); setMode(null);
    if (!t) return;
    setThinking(true);
    const ai = await askAi(t, namesRef.current.boxes, namesRef.current.items);
    if (mine !== runSeq.current) return;
    setThinking(false);
    const show = (intents: Intent[]) => setResults(intents.map((intent) => ({ id: ++shownSeq, intent })));
    if (typeof ai === 'object' && (ai.intents.length > 0 || ai.reply)) {
      show(ai.intents);
      setReply(ai.reply);
      setMode('smart');
      return;
    }
    const parsed = parse(t);
    show(parsed.kind === 'empty' ? [] : [parsed]);
    setMode('basic');
    if (ai === 'limit') setNotice("Smart assistant has used today's free limit. Using basic mode.");
    else if (ai === 'offline') setNotice("You're offline. Using basic mode.");
    else if (ai === 'unavailable') setNotice('Smart assistant is unavailable. Using basic mode.');
  }, []);

  const startListening = () => {
    // A new spoken command replaces the one whose result is showing.
    if (mode) { setText(''); setResults([]); setReply(null); setMode(null); setNotice(null); }
    speech.start();
  };

  const speech = useSpeech(
    (phrase) => {
      autoRun.current = true;
      setText((t) => (t.trim() ? `${t.replace(/\s+$/, '')}\n${phrase}` : phrase));
    },
    () => {
      if (!autoRun.current) return;
      autoRun.current = false;
      void run(textRef.current);
    }
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // On a phone, focusing would throw the keyboard over the examples.
  useEffect(() => { if (!coarsePointer) inputRef.current?.focus(); }, []);

  const reset = useCallback(() => {
    runSeq.current++;
    setText(''); setResults([]); setReply(null); setMode(null); setNotice(null); setThinking(false);
    inputRef.current?.focus();
  }, []);

  // A saved card leaves; when the last one goes, the sheet is ready for the next command.
  const finish = useCallback((id: number, msg: string) => {
    if (msg) showToast(msg, 'success');
    setResults((rs) => {
      const left = rs.filter((r) => r.id !== id);
      if (left.length === 0) { setText(''); setReply(null); setMode(null); setNotice(null); }
      return left;
    });
  }, [showToast]);

  const data: PanelData = useMemo(() => ({
    boxes,
    samples,
    outBySample,
    stock: inventoryItems,
    actor: currentUser,
    readOnly,
    consumeItem,
    restockItem,
    moveItem,
    createPurchase,
    reload: () => void reload(),
    onDone: (msg) => { if (msg) showToast(msg, 'success'); reset(); },
    onError: (msg) => showToast(msg, 'error'),
    openSample: readOnly ? undefined : () => { setPendingProfileView('samples'); setActiveTab('profile'); onClose(); },
  }), [boxes, samples, outBySample, inventoryItems, currentUser, readOnly, consumeItem, restockItem, moveItem, createPurchase, reload, showToast, reset, setPendingProfileView, setActiveTab, onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Assistant">
      <ScrollLock />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90dvh] bg-[#1E1E1E] border border-[#2A2A2A] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-sheet">
        <div className="px-4 pt-4 pb-3 border-b border-[#2A2A2A] shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">auto_awesome</span>
              Assistant
            </h2>
            <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); void run(text); }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              rows={Math.min(6, Math.max(1, text.split('\n').length))}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !coarsePointer && !e.nativeEvent.isComposing) { e.preventDefault(); void run(text); }
              }}
              placeholder={readOnly ? 'Where is…' : 'Find, add, move, took…'}
              className="flex-1 min-w-0 px-3 py-2 bg-[#121212] border border-[#2A2A2A] rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary resize-none"
            />
            {speech.supported && (
              <button
                type="button"
                onClick={speech.listening ? speech.stop : startListening}
                aria-label={speech.listening ? 'Stop listening' : 'Speak'}
                aria-pressed={speech.listening}
                className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${
                  speech.listening
                    ? 'bg-red-500 border-red-500 text-white animate-pulse'
                    : 'bg-[#121212] border-[#2A2A2A] text-gray-300 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{speech.listening ? 'stop' : 'mic'}</span>
              </button>
            )}
            <button
              type="submit"
              disabled={!text.trim() || thinking}
              aria-label="Go"
              className="shrink-0 w-10 h-10 rounded-lg bg-primary text-white flex items-center justify-center disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
            </button>
          </form>
          {speech.listening && (
            <p className="text-[11px] text-red-300 mt-2" role="status">
              Listening… pause between items, say "done" to finish.{speech.interim && <span className="text-gray-400"> {speech.interim}</span>}
            </p>
          )}
          {speech.error && <p className="text-[11px] text-red-400 mt-2" role="alert">{speech.error}</p>}
          {!readOnly && (
            <p className="text-[10px] text-gray-400 mt-2">
              {speech.supported
                ? 'Voice is turned into text by Google (Chrome) or Apple (Safari).'
                : 'Voice works in Chrome or Safari; here you can type.'}
            </p>
          )}
        </div>

        <div className="p-4 pb-0 overflow-y-auto flex-1 space-y-3" aria-live="polite">
          {loadError && (
            <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {loadError} Results may be out of date.
            </p>
          )}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-[#2A2A2A] border-t-primary animate-spin" />
            </div>
          ) : thinking ? (
            <div className="flex items-center gap-2 py-6 justify-center text-sm text-gray-400" role="status">
              <span className="material-symbols-outlined text-primary text-[18px] animate-pulse">auto_awesome</span>
              Understanding…
            </div>
          ) : mode ? (
            <div className="space-y-4 pb-4">
              {notice && <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">{notice}</p>}
              {reply && <p className="text-sm text-gray-200 bg-[#161616] border border-[#2A2A2A] rounded-lg px-3 py-2.5">{reply}</p>}
              {results.map((r) => (
                <ResultItem key={r.id} shown={r} data={data} readOnly={readOnly} onFinish={finish} />
              ))}
              {results.length === 0 && !reply && (
                <p className="text-sm text-gray-400">I didn't understand that. Try one of the examples, or say it another way.</p>
              )}
              {mode === 'smart' && results.length > 0 && (
                <p className="text-[10px] text-gray-500">Understood by Gemini. Nothing is saved until you tap Save.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Try:</p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.filter((ex) => !readOnly || /^(where|what)/.test(ex)).map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => { setText(ex); void run(ex); }}
                    className="px-3 py-2 rounded-full text-xs bg-[#161616] border border-[#2A2A2A] text-gray-300 hover:border-primary/40"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              {!readOnly && (
                <p className="text-[11px] text-gray-400 pt-2 pb-4">
                  Say it however you like, in English or Hindi, several things at once. For a whole shelf: "CC-S05: silver nitrate, trypan blue, …" — or tap the mic and read the bottles out. Nothing is saved until you tap Save.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultItem({ shown, data, readOnly, onFinish }: { shown: Shown; data: PanelData; readOnly: boolean; onFinish: (id: number, msg: string) => void }) {
  const d = useMemo<PanelData>(() => ({ ...data, onDone: (msg) => onFinish(shown.id, msg) }), [data, onFinish, shown.id]);
  if (readOnly && !LOOKUPS.includes(shown.intent.kind)) {
    return <p className="text-sm text-gray-400">You can look things up here. Adding, moving, taking and ordering is done by lab members.</p>;
  }
  return <Result intent={shown.intent} d={d} />;
}

function Result({ intent: raw, d }: { intent: Intent; d: PanelData }) {
  // A list whose first line is "tween 80" reads to the parser like a box code;
  // if no real box answers to it, it was the first bottle, not the shelf.
  const intent: Intent =
    raw.kind === 'add' && raw.box && (rankBoxes(raw.box, d.boxes)[0]?.score ?? 0) < WEAK
      ? { ...raw, box: null, items: [parseItem(raw.box), ...raw.items] }
      : raw;
  const title: Record<Intent['kind'], string> = {
    find: 'Found', box: 'Box', add: 'Add to a box', move: 'Move', swap: 'Swap',
    take: 'Taking', return: 'Putting back', restock: 'Restock', low: 'Running low', request: 'New purchase request', empty: '',
  };
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider" role="status">{title[intent.kind]}</p>
      {intent.kind === 'find' && <FindPanel query={intent.query} d={d} />}
      {intent.kind === 'box' && <BoxPanel box={intent.box} d={d} />}
      {intent.kind === 'add' && <AddPanel box={intent.box} items={intent.items} d={d} />}
      {intent.kind === 'move' && <MovePanel items={intent.items} from={intent.from} to={intent.to} d={d} />}
      {intent.kind === 'swap' && <SwapPanel a={intent.a} b={intent.b} d={d} />}
      {intent.kind === 'take' && <TakePanel items={intent.items} d={d} />}
      {intent.kind === 'return' && <ReturnPanel items={intent.items} d={d} />}
      {intent.kind === 'restock' && <RestockPanel items={intent.items} d={d} />}
      {intent.kind === 'low' && <LowPanel d={d} />}
      {intent.kind === 'request' && <RequestPanel title={intent.title} quantity={intent.quantity} priority={intent.priority} note={intent.note} d={d} />}
    </div>
  );
}
