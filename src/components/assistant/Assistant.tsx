import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useReadOnly } from '../../lib/useReadOnly';
import { useSampleData } from '../../lib/useSampleData';
import { useSpeech } from '../../lib/useSpeech';
import { ScrollLock } from '../../lib/useScrollLock';
import { isAssistantVoiceOn, setAssistantVoiceOn } from '../../lib/assistantVoice';
import { parse, parseItem } from '../../lib/assistant/parse';
import { callAssistant, Content, LabSnapshot, MAX_STEPS, Part, Proposal, runTools } from '../../lib/assistant/agent';
import { rankBoxes } from './resolve';
import { WEAK } from '../../lib/assistant/match';
import type { Intent } from '../../lib/assistant/types';
import { AddPanel, BoxPanel, FindPanel, LowPanel, MovePanel, NewBoxPanel, NewStockPanel, PanelData, RequestPanel, RestockPanel, ReturnPanel, SwapPanel, TakePanel } from './panels';
import { PROPOSAL_TITLES, ProposalCard, proposalToIntent } from './proposals';

const EXAMPLES = [
  'where is triton',
  "what's running low?",
  'when is the AKTA free tomorrow?',
  'took out FCV and moved trypan blue to PN01',
  'we need 2 boxes of 15 mL falcons, urgent',
  'the Sorvall centrifuge is making a grinding noise',
];
const LOOKUP_EXAMPLE = /^(where|what|when|who)/i;

const LOOKUPS: Intent['kind'][] = ['find', 'box', 'low', 'empty'];

// Phone keyboards have no Shift+Enter, so there Enter makes a new line and the
// arrow button sends.
const coarsePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

type Card = { id: number; proposal?: Proposal; intent?: Intent };
type Turn =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; text: string; cards: Card[]; notice?: string };
let seq = 0;

function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
function speak(text: string) {
  if (!canSpeak() || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-IN';
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang === 'en-IN') ?? voices.find((v) => v.lang.startsWith('en'));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}
function hush() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

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
        title="Assistant"
        className={`fixed right-4 ${bottom} z-40 w-12 h-12 rounded-full bg-primary text-white shadow-lg shadow-black/40 flex items-center justify-center hover:bg-orange-600 transition-colors`}
      >
        <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
      </button>
      {open && <AssistantSheet onClose={() => { hush(); setOpen(false); requestAnimationFrame(() => fabRef.current?.focus()); }} />}
    </>
  );
};

function AssistantSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const { inventoryItems, consumeItem, restockItem, moveItem, createPurchase, addInventoryItem } = app;
  const { currentUser, allUsers } = useAuth();
  const { showToast, setActiveTab, setPendingProfileView } = useUI();
  const readOnly = useReadOnly();
  const { boxes, samples, outBySample, loading, error: loadError, reload } = useSampleData();

  const [text, setText] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);
  const [speakOn, setSpeakOn] = useState(isAssistantVoiceOn);
  const history = useRef<Content[]>([]);
  const busy = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const autoRun = useRef(false);
  const textRef = useRef('');
  textRef.current = text;
  const speakRef = useRef(speakOn);
  speakRef.current = speakOn;

  // The model's tools read whatever the app has loaded at the moment they run.
  const snapRef = useRef<LabSnapshot | null>(null);
  snapRef.current = {
    me: currentUser, users: allUsers, boxes, samples, outBySample, stock: inventoryItems,
    inventoryLog: app.inventoryLog, purchases: app.purchases, activities: app.activities, equipment: app.equipment,
    bookableItems: app.bookableItems, bookings: app.bookings, vendors: app.vendors, lostFound: app.lostFoundItems, lists: app.labLists,
  };

  const send = useCallback(async (value: string) => {
    const t = value.trim();
    if (!t || busy.current) return;
    busy.current = true;
    hush();
    setText('');
    setTurns((ts) => [...ts, { id: ++seq, role: 'user', text: t }]);
    setThinking(true);

    const now = new Date();
    const context = {
      today: `${now.toLocaleDateString('en-IN', { weekday: 'long' })} ${now.toLocaleDateString('en-CA')}`,
      now: now.toTimeString().slice(0, 5),
      user: snapRef.current?.me?.name ?? 'a lab member',
    };
    const convo: Content[] = [...history.current, { role: 'user', parts: [{ text: t }] }];
    const proposals: Proposal[] = [];
    let reply = '';
    let failed: 'offline' | 'limit' | 'unavailable' | null = null;

    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await callAssistant(convo, context);
      if (typeof res === 'string') { failed = res; break; }
      convo.push({ role: 'model', parts: res });
      const calls = res.filter((p: Part) => p.functionCall);
      reply = res.filter((p: Part) => p.text && !p.thought).map((p) => p.text).join(' ').trim() || reply;
      if (calls.length === 0) break;
      const { responses, proposals: made } = runTools(calls, snapRef.current!);
      proposals.push(...made);
      convo.push({ role: 'user', parts: responses });
      if (step === MAX_STEPS - 1) reply ||= 'I prepared what I could. Check the cards below.';
    }

    if (failed) {
      // Gemini is out of reach: answer with the built-in parser so the assistant keeps working.
      const parsed = parse(t);
      const notice =
        failed === 'limit' ? "Smart assistant has used today's free limit. Using basic mode."
        : failed === 'offline' ? "You're offline. Using basic mode."
        : 'Smart assistant is unavailable right now. Using basic mode.';
      setTurns((ts) => [...ts, {
        id: ++seq, role: 'assistant', notice,
        text: parsed.kind === 'empty' ? "I didn't understand that." : '',
        cards: parsed.kind === 'empty' ? [] : [{ id: ++seq, intent: parsed }],
      }]);
    } else {
      // Keep the whole exchange, tool calls included, so follow-ups have context.
      history.current = trimHistory(convo);
      const cards = proposals.map((p) => ({ id: ++seq, proposal: p }));
      const said = reply || (cards.length ? 'Check the card below and tap Save.' : 'Done.');
      setTurns((ts) => [...ts, { id: ++seq, role: 'assistant', text: said, cards }]);
      if (speakRef.current) speak(said);
    }
    setThinking(false);
    busy.current = false;
  }, []);

  const speech = useSpeech(
    (phrase) => {
      autoRun.current = true;
      setText((v) => (v.trim() ? `${v.replace(/\s+$/, '')}\n${phrase}` : phrase));
    },
    () => {
      if (!autoRun.current) return;
      autoRun.current = false;
      void send(textRef.current);
    }
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // On a phone, focusing would throw the keyboard over the examples.
  useEffect(() => { if (!coarsePointer) inputRef.current?.focus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [turns, thinking]);
  useEffect(() => () => hush(), []);

  const newChat = () => {
    hush();
    history.current = [];
    setTurns([]);
    setText('');
    inputRef.current?.focus();
  };

  const toggleSpeak = () => {
    const next = !speakOn;
    setSpeakOn(next);
    if (!next) hush();
    setAssistantVoiceOn(next);
  };

  // A saved card leaves the conversation; the words stay.
  const finish = useCallback((cardId: number, msg: string) => {
    if (msg) showToast(msg, 'success');
    setTurns((ts) => ts.map((t) => (t.role === 'assistant' ? { ...t, cards: t.cards.filter((c) => c.id !== cardId) } : t)));
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
    addInventoryItem,
    reload: () => void reload(),
    onDone: (msg) => { if (msg) showToast(msg, 'success'); },
    onError: (msg) => showToast(msg, 'error'),
    openSample: readOnly ? undefined : () => { setPendingProfileView('samples'); setActiveTab('profile'); onClose(); },
  }), [boxes, samples, outBySample, inventoryItems, currentUser, readOnly, consumeItem, restockItem, moveItem, createPurchase, addInventoryItem, reload, showToast, setPendingProfileView, setActiveTab, onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Assistant">
      <ScrollLock />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay" onClick={onClose} />
      <div className="relative w-full max-w-md h-[90dvh] bg-[#1E1E1E] border border-[#2A2A2A] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-sheet">
        <div className="px-4 pt-4 pb-3 border-b border-[#2A2A2A] shrink-0 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">auto_awesome</span>
            Assistant
          </h2>
          <div className="flex items-center gap-1">
            {turns.length > 0 && (
              <button type="button" onClick={newChat} className="px-2.5 py-1.5 rounded-md text-xs text-gray-400 hover:text-white hover:bg-[#2A2A2A]">
                New chat
              </button>
            )}
            {canSpeak() && (
              <button type="button" onClick={toggleSpeak} aria-pressed={speakOn} title={speakOn ? 'Tap to stop reading replies aloud' : 'Tap to read replies aloud'}
                className={`h-9 px-2.5 rounded-md flex items-center gap-1 text-xs font-semibold border transition-colors ${
                  speakOn ? 'text-primary border-primary/30 bg-primary/10' : 'text-gray-400 border-[#2A2A2A] hover:text-white'
                }`}>
                <span className="material-symbols-outlined text-[18px]">{speakOn ? 'volume_up' : 'volume_off'}</span>
                Voice {speakOn ? 'on' : 'off'}
              </button>
            )}
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#2A2A2A]">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-3 overflow-y-auto flex-1 space-y-4" aria-live="polite">
          {loadError && (
            <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {loadError} Answers may be out of date.
            </p>
          )}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-[#2A2A2A] border-t-primary animate-spin" />
            </div>
          ) : turns.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-300">
                {readOnly
                  ? 'Ask anything about the lab: samples, stock, instruments, bookings, orders.'
                  : "Ask anything about the lab, or tell me what to do: samples, stock, orders, instruments, bookings. I'll show you a card before anything is saved."}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.filter((ex) => !readOnly || LOOKUP_EXAMPLE.test(ex)).map((ex) => (
                  <button key={ex} type="button" onClick={() => void send(ex)}
                    className="px-3 py-2 rounded-full text-xs bg-[#161616] border border-[#2A2A2A] text-gray-300 hover:border-primary/40 text-left">
                    {ex}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-500">
                English, Hindi or Hinglish. Tap the mic and talk; say "done" to send. Prices and spending are never sent to the assistant.
              </p>
            </div>
          ) : (
            turns.map((t) =>
              t.role === 'user' ? (
                <div key={t.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-line bg-primary/15 border border-primary/25 text-sm text-white rounded-2xl rounded-br-md px-3 py-2">{t.text}</p>
                </div>
              ) : (
                <div key={t.id} className="space-y-2.5">
                  {t.notice && <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">{t.notice}</p>}
                  {t.text && <p className="max-w-[92%] whitespace-pre-line bg-[#161616] border border-[#2A2A2A] text-sm text-gray-100 rounded-2xl rounded-bl-md px-3 py-2">{t.text}</p>}
                  {t.cards.map((c) => (
                    <CardView key={c.id} card={c} data={data} readOnly={readOnly} onFinish={finish} />
                  ))}
                </div>
              )
            )
          )}
          {thinking && (
            <div className="flex items-center gap-2 text-sm text-gray-400" role="status">
              <span className="material-symbols-outlined text-primary text-[18px] animate-pulse">auto_awesome</span>
              Thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[#2A2A2A] shrink-0">
          <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={Math.min(5, Math.max(1, text.split('\n').length))}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !coarsePointer && !e.nativeEvent.isComposing) { e.preventDefault(); void send(text); }
              }}
              placeholder={readOnly ? 'Ask about the lab…' : 'Ask or tell me what to do…'}
              className="flex-1 min-w-0 px-3 py-2 bg-[#121212] border border-[#2A2A2A] rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary resize-none"
            />
            {speech.supported && (
              <button
                type="button"
                onClick={speech.listening ? speech.stop : () => { hush(); speech.start(); }}
                aria-label={speech.listening ? 'Stop listening' : 'Speak'}
                aria-pressed={speech.listening}
                className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${
                  speech.listening ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'bg-[#121212] border-[#2A2A2A] text-gray-300 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{speech.listening ? 'stop' : 'mic'}</span>
              </button>
            )}
            <button type="submit" disabled={!text.trim() || thinking} aria-label="Send"
              className="shrink-0 w-10 h-10 rounded-lg bg-primary text-white flex items-center justify-center disabled:opacity-40">
              <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
            </button>
          </form>
          {speech.listening && (
            <p className="text-[11px] text-red-300 mt-2" role="status">
              Listening… say "done" to send.{speech.interim && <span className="text-gray-400"> {speech.interim}</span>}
            </p>
          )}
          {speech.error && <p className="text-[11px] text-red-400 mt-2" role="alert">{speech.error}</p>}
          {!speech.listening && (
            <p className="text-[10px] text-gray-500 mt-1.5">
              Understood by Google Gemini.{speech.supported ? ' Voice is turned into text by Google (Chrome) or Apple (Safari).' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Bounds what is sent back each turn. Cuts only at a person's own message, never
 * between a tool call and its answer, which Gemini would reject.
 */
function trimHistory(convo: Content[], max = 40): Content[] {
  if (convo.length <= max) return convo;
  for (let i = convo.length - max; i < convo.length; i++) {
    const c = convo[i];
    if (c.role === 'user' && c.parts.some((p) => typeof p.text === 'string')) return convo.slice(i);
  }
  return [];
}

function CardView({ card, data, readOnly, onFinish }: { card: Card; data: PanelData; readOnly: boolean; onFinish: (id: number, msg: string) => void }) {
  const d = useMemo<PanelData>(() => ({ ...data, onDone: (msg) => onFinish(card.id, msg) }), [data, onFinish, card.id]);
  const intent = card.intent ?? (card.proposal ? proposalToIntent(card.proposal) : null);
  if (readOnly && !(intent && LOOKUPS.includes(intent.kind))) {
    return <p className="text-sm text-gray-400">Adding, moving, ordering and booking is done by lab members.</p>;
  }
  if (intent) return <Result intent={intent} d={d} showToVendors={card.proposal?.args.show_to_vendors === true} />;
  if (card.proposal) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{PROPOSAL_TITLES[card.proposal.tool] ?? 'Action'}</p>
        <ProposalCard proposal={card.proposal} d={d} />
      </div>
    );
  }
  return null;
}

function Result({ intent: raw, d, showToVendors = false }: { intent: Intent; d: PanelData; showToVendors?: boolean }) {
  // A list whose first line is "tween 80" reads to the parser like a box code;
  // if no real box answers to it, it was the first bottle, not the shelf.
  const intent: Intent =
    raw.kind === 'add' && raw.box && (rankBoxes(raw.box, d.boxes)[0]?.score ?? 0) < WEAK
      ? { ...raw, box: null, items: [parseItem(raw.box), ...raw.items] }
      : raw;
  const title: Record<Intent['kind'], string> = {
    find: 'Found', box: 'Box', add: 'Add to a box', move: 'Move', swap: 'Swap',
    take: 'Taking', return: 'Putting back', restock: 'Restock', low: 'Running low', request: 'New purchase request', newbox: 'New box', newstock: 'New stock item', empty: '',
  };
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title[intent.kind]}</p>
      {intent.kind === 'find' && <FindPanel query={intent.query} d={d} />}
      {intent.kind === 'box' && <BoxPanel box={intent.box} d={d} />}
      {intent.kind === 'add' && <AddPanel box={intent.box} items={intent.items} d={d} />}
      {intent.kind === 'move' && <MovePanel items={intent.items} from={intent.from} to={intent.to} d={d} />}
      {intent.kind === 'swap' && <SwapPanel a={intent.a} b={intent.b} d={d} />}
      {intent.kind === 'take' && <TakePanel items={intent.items} d={d} />}
      {intent.kind === 'return' && <ReturnPanel items={intent.items} d={d} />}
      {intent.kind === 'restock' && <RestockPanel items={intent.items} d={d} />}
      {intent.kind === 'low' && <LowPanel d={d} />}
      {intent.kind === 'request' && (
        <RequestPanel title={intent.title} quantity={intent.quantity} priority={intent.priority} note={intent.note}
          catalogNumber={intent.catalogNumber} brand={intent.brand} vendorVisible={showToVendors} d={d} />
      )}
      {intent.kind === 'newbox' && <NewBoxPanel name={intent.name} condition={intent.condition} location={intent.location} d={d} />}
      {intent.kind === 'newstock' && <NewStockPanel name={intent.name} quantity={intent.quantity} unit={intent.unit} location={intent.location} category={intent.category} d={d} />}
    </div>
  );
}
