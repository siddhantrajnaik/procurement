/**
 * Tiny synthesised UI sounds — no audio assets, no network, works offline.
 *
 * Every entry point is wrapped so a missing/blocked Web Audio API can never
 * throw into a caller: sound is decoration, and must never break a real action.
 */

const SOUND_PREF_KEY = 'procure.sound.enabled';

type Tone = { freq: number; start: number; duration: number };

/** Short, soft sine blips. Peak gain stays low so these sit under the UI. */
const VOICES = {
  success: [
    { freq: 660, start: 0, duration: 0.09 },
    { freq: 880, start: 0.07, duration: 0.12 },
  ],
  error: [{ freq: 233, start: 0, duration: 0.18 }],
  warning: [{ freq: 415, start: 0, duration: 0.14 }],
  info: [{ freq: 740, start: 0, duration: 0.07 }],
} satisfies Record<string, Tone[]>;

export type SoundName = keyof typeof VOICES;

const PEAK_GAIN = 0.05;

let ctx: AudioContext | null = null;
let unlockBound = false;

function getCtx(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Browsers start an AudioContext suspended until a user gesture, and iOS keeps
 * it that way until one resumes it. Bind a one-shot listener so the first tap
 * anywhere unlocks audio for the rest of the session.
 */
export function initSound(): void {
  if (unlockBound || typeof window === 'undefined') return;
  unlockBound = true;
  const unlock = () => {
    const c = getCtx();
    if (c && c.state === 'suspended') void c.resume().catch(() => {});
  };
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
}

export function isSoundEnabled(): boolean {
  try {
    // Default on: the toggle stores '0' only once explicitly muted.
    return localStorage.getItem(SOUND_PREF_KEY) !== '0';
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    if (on) localStorage.removeItem(SOUND_PREF_KEY);
    else localStorage.setItem(SOUND_PREF_KEY, '0');
  } catch {}
}

export function playSound(name: SoundName): void {
  try {
    if (!isSoundEnabled()) return;
    // Someone who asked the OS for less motion generally wants less noise too.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') void c.resume().catch(() => {});
    if (c.state !== 'running') return;

    const now = c.currentTime;
    for (const tone of VOICES[name]) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = tone.freq;

      // Ramp both edges — a instantaneous start or stop clicks audibly.
      const t0 = now + tone.start;
      const t1 = t0 + tone.duration;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);

      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    }
  } catch {}
}
