import { useCallback, useEffect, useRef, useState } from 'react';

// Chrome and Safari ship this under a prefix and TypeScript's DOM lib does not
// declare it, so the shape we use is written out here.
interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function getRecognitionCtor(): (new () => Recognition) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => Recognition) | null;
}

export const speechSupported = typeof window !== 'undefined' && getRecognitionCtor() !== null;

/**
 * Browser speech-to-text. Audio goes to Google (Chrome) or Apple (Safari) for
 * transcription — that is the trade-off the lab accepted for voice.
 *
 * Each finished phrase is handed to `onPhrase` separately, so a pause between
 * bottles becomes a new line and a whole shelf can be read out in one go.
 * Saying "done" or "stop" ends listening.
 */
export function useSpeech(onPhrase: (text: string) => void, onEnd?: () => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const phraseRef = useRef(onPhrase);
  const endRef = useRef(onEnd);
  phraseRef.current = onPhrase;
  endRef.current = onEnd;

  const stop = useCallback(() => { recRef.current?.stop(); }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recRef.current) return;
    const rec = new Ctor();
    rec.lang = 'en-IN';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let pending = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        const text = r[0].transcript.trim();
        if (!r.isFinal) { pending += ` ${text}`; continue; }
        if (!text) continue;
        if (/^(done|stop|that's all|that is all)$/i.test(text)) { rec.stop(); continue; }
        phraseRef.current(text.replace(/\s+(done|stop)$/i, ''));
        if (/\s(done|stop)$/i.test(text)) rec.stop();
      }
      setInterim(pending.trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      setError(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Microphone permission is blocked for this site.'
          : e.error === 'network'
            ? 'Voice needs an internet connection.'
            : `Voice stopped (${e.error}).`
      );
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setInterim('');
      endRef.current?.();
    };

    setError(null);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setListening(false);
    }
  }, []);

  useEffect(() => () => { recRef.current?.abort(); }, []);

  return { supported: speechSupported, listening, interim, error, start, stop };
}
