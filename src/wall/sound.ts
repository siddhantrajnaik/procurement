// Sound for the wall screen: a soft two-note chime, then a short spoken line.
// No audio files: the chime is synthesised and the voice is the browser's own.

const SOUND_KEY = 'mb.wall.sound';
const QUIET_FROM = 20; // no sound from 20:00 ...
const QUIET_TO = 8; //    ... until 08:00 (India time)

export const soundOn = () => {
  try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
};
export const setSoundOn = (on: boolean) => {
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
};
export const quietHour = (h: number) => h >= QUIET_FROM || h < QUIET_TO;

/** True when the browser will let the page make sound without a tap (kiosk flag, or someone already clicked). */
export const canPlay = () => {
  const ua = (navigator as unknown as { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (!ua || ua.hasBeenActive) return true;
  // Chrome started with --autoplay-policy=no-user-gesture-required reports an AudioContext that is already running.
  try {
    const ctx = new AudioContext();
    const ok = ctx.state === 'running';
    void ctx.close();
    return ok;
  } catch { return false; }
};

let ctx: AudioContext | null = null;

function chime(urgent: boolean) {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  const notes = urgent ? [659.25, 523.25, 659.25] : [523.25, 783.99]; // E5 C5 E5, or C5 G5
  notes.forEach((f, i) => {
    const t = ctx!.currentTime + i * 0.22;
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.95);
  });
  return notes.length * 220 + 500;
}

function voice(): SpeechSynthesisVoice | undefined {
  const all = speechSynthesis.getVoices();
  return all.find((v) => v.lang === 'en-IN') ?? all.find((v) => v.lang.startsWith('en-GB')) ?? all.find((v) => v.lang.startsWith('en'));
}

/** Chime, then say the line. Lines queue rather than talk over each other. */
export function announce(line: string, urgent = false) {
  const wait = chime(urgent);
  if (!('speechSynthesis' in window)) return;
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(line);
    const v = voice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-IN';
    u.rate = 0.95;
    speechSynthesis.speak(u);
  }, wait);
}

/** "15:00" -> "3 PM", "13:30" -> "1:30 PM": easier to hear than 24-hour time. */
export function spokenTime(t: string) {
  const h = Number(t.slice(0, 2));
  const m = t.slice(3, 5);
  const h12 = h % 12 || 12;
  return `${h12}${m === '00' ? '' : `:${m}`} ${h < 12 ? 'AM' : 'PM'}`;
}
