import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, type PanInfo } from 'motion/react';
import confetti from 'canvas-confetti';
import { Scissors, ArrowRight, ArrowLeft } from 'lucide-react';
import { playSound } from '../../lib/sound';
import { FEATURES } from './features';

/**
 * The opening ceremony: a ribbon, a cut, and a walk through the app.
 *
 * Single use. It is reached only by its own link and is meant to be deleted
 * after the event -- which is why nothing outside this folder knows it exists
 * beyond two lines in App.tsx, and why it touches no schema, no storage and no
 * shared component.
 *
 * It reads nothing from Supabase, deliberately. It runs once, live, in a room
 * with a projector and campus wifi, and a launch that depends on the network is
 * a launch that can show a spinner to an audience. Everything here is static.
 */

/** Set when the hash names the ceremony. Read once per render in App. */
export const LAUNCH_HASH = '#/launch';

export function launchLinkPresent(): boolean {
  try {
    return window.location.hash.trim().toLowerCase() === LAUNCH_HASH;
  } catch {
    return false;
  }
}

/**
 * Live answer to "is the ceremony link open", not a one-off read.
 *
 * Changing only the hash does not reload a single-page app and does not by
 * itself re-render anything, so a plain check at render time means pasting the
 * link into a tab already on the site silently does nothing — which is a bad way
 * to discover a problem thirty seconds before an audience. Subscribing to
 * `hashchange` makes the link work from wherever the laptop happens to be.
 */
export function useLaunchLink(): boolean {
  const [open, setOpen] = useState(launchLinkPresent);
  useEffect(() => {
    const sync = () => setOpen(launchLinkPresent());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return open;
}

/** Every slide after the cut: a title, each feature, then the closing card. */
type Slide =
  | { kind: 'title' }
  | { kind: 'feature'; index: number }
  | { kind: 'finale' };

const SLIDES: Slide[] = [
  { kind: 'title' },
  ...FEATURES.map((_, index) => ({ kind: 'feature' as const, index })),
  { kind: 'finale' },
];

/** How far the scissors must travel before the cut commits. */
const CUT_DISTANCE = 90;

export const LaunchScreen: React.FC = () => {
  const [cut, setCut] = useState(false);
  const [step, setStep] = useState(-1); // -1 while the ribbon is still whole
  const cutRef = useRef(false);

  const celebrate = useCallback(() => {
    // Both are decoration and neither may throw into the ceremony: playSound
    // already swallows a blocked AudioContext, and confetti is wrapped here.
    try {
      confetti({ particleCount: 160, spread: 100, origin: { y: 0.6 }, startVelocity: 45 });
      window.setTimeout(
        () => confetti({ particleCount: 90, spread: 120, origin: { y: 0.5 }, scalar: 0.9 }),
        260
      );
    } catch {
      /* no confetti is survivable; a crash on stage is not */
    }
    playSound('success');
  }, []);

  /**
   * Every way of cutting lands here.
   *
   * There are three of them -- drag, click, keyboard -- because a trackpad drag
   * in front of a room is exactly the thing that goes wrong, and the ribbon must
   * never be cuttable one way but not another. The ref guards against a drag
   * that also registers as a click.
   */
  const doCut = useCallback(() => {
    if (cutRef.current) return;
    cutRef.current = true;
    setCut(true);
    celebrate();
    // Long enough to watch the ribbon fall, short enough that it is not a wait.
    window.setTimeout(() => setStep(0), 1100);
  }, [celebrate]);

  const next = useCallback(() => setStep((s) => Math.min(s + 1, SLIDES.length - 1)), []);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  /** Clears the hash and reloads, so the app opens clean rather than mid-ceremony. */
  const openApp = useCallback(() => {
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      /* ignore */
    }
    window.location.reload();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!cutRef.current) {
        // Before the cut, Enter and Space are the recovery path for a pointer
        // that will not cooperate.
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          doCut();
        }
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      } else if (e.key === 'Escape') {
        openApp();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doCut, next, back, openApp]);

  const onDrag = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) >= CUT_DISTANCE) doCut();
  };

  // ------------------------------------------------------------ the ribbon
  if (step < 0) {
    return (
      <div className="min-h-dvh bg-background text-white flex flex-col items-center justify-center overflow-hidden select-none px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: cut ? 0 : 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm sm:text-base uppercase tracking-[0.35em] text-gray-500 font-bold">
            Structural Virology Lab · IIT Delhi
          </p>
          <h1 className="mt-4 text-5xl sm:text-7xl font-extrabold tracking-tight">
            MB Lab
          </h1>
        </motion.div>

        {/* The ribbon. Clicking anywhere on this band cuts it. */}
        <div
          className="relative w-full max-w-5xl h-28 flex items-center cursor-pointer"
          onClick={doCut}
          role="button"
          tabIndex={0}
          aria-label="Cut the ribbon"
        >
          {(['left', 'right'] as const).map((side) => (
            <motion.div
              key={side}
              className={`absolute top-1/2 -translate-y-1/2 h-14 w-1/2 ${
                side === 'left' ? 'left-0 rounded-l-md' : 'right-0 rounded-r-md'
              }`}
              style={{
                background:
                  'linear-gradient(180deg,#FF8A6A 0%,#FF6B4A 45%,#E04A28 100%)',
                boxShadow: '0 10px 40px rgba(255,107,74,0.35)',
              }}
              animate={
                cut
                  ? {
                      x: side === 'left' ? -160 : 160,
                      y: 420,
                      rotate: side === 'left' ? -38 : 38,
                      opacity: 0,
                    }
                  : { x: 0, y: 0, rotate: 0, opacity: 1 }
              }
              transition={{ duration: 1.1, ease: [0.3, 0.1, 0.4, 1] }}
            />
          ))}

          {!cut && (
            <motion.div
              drag="x"
              dragConstraints={{ left: -260, right: 260 }}
              dragElastic={0.2}
              onDrag={onDrag}
              onDragEnd={doCut}
              whileDrag={{ scale: 1.12, rotate: -12 }}
              className="absolute left-1/2 -translate-x-1/2 z-10 cursor-grab active:cursor-grabbing"
            >
              <div className="w-20 h-20 rounded-full bg-[#1E1E1E] border-2 border-[#3A3A3A] shadow-2xl flex items-center justify-center">
                <Scissors className="w-9 h-9 text-white" />
              </div>
            </motion.div>
          )}
        </div>

        <motion.p
          animate={{ opacity: cut ? 0 : 1 }}
          className="mt-14 text-base sm:text-lg text-gray-400 text-center"
        >
          Drag the scissors to cut the ribbon
          <span className="block text-sm text-gray-600 mt-2">
            or click the ribbon · or press Enter
          </span>
        </motion.p>
      </div>
    );
  }

  // ----------------------------------------------------------- the showcase
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <div
      className="min-h-dvh bg-background text-white flex flex-col select-none cursor-pointer"
      onClick={isLast ? undefined : next}
    >
      <div className="flex-1 flex items-center justify-center px-8 sm:px-16">
        {slide.kind === 'title' && (
          <motion.div
            key="title"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight">
              Welcome to MB Lab
            </h1>
            <p className="mt-6 text-2xl sm:text-4xl text-primary font-bold">
              All in one app
            </p>
            <p className="mt-10 text-sm uppercase tracking-[0.3em] text-gray-600 font-bold">
              {FEATURES.length} things it does
            </p>
          </motion.div>
        )}

        {slide.kind === 'feature' && (() => {
          const f = FEATURES[slide.index];
          const Icon = f.icon;
          return (
            <motion.div
              key={`f-${slide.index}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-4xl flex items-start gap-8 sm:gap-12"
            >
              <div className="shrink-0 w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Icon className="w-12 h-12 sm:w-16 sm:h-16 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm uppercase tracking-[0.3em] text-gray-600 font-bold">
                  {f.group}
                </p>
                <h2 className="mt-3 text-4xl sm:text-6xl font-extrabold tracking-tight">
                  {f.name}
                </h2>
                <p className="mt-6 text-xl sm:text-2xl text-gray-400 leading-relaxed">
                  {f.blurb}
                </p>
              </div>
            </motion.div>
          );
        })()}

        {slide.kind === 'finale' && (
          <motion.div
            key="finale"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h2 className="text-5xl sm:text-7xl font-extrabold tracking-tight">Open for use</h2>
            <p className="mt-6 text-xl sm:text-2xl text-gray-400">
              Structural Virology Lab · IIT Delhi
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openApp();
              }}
              className="mt-12 px-10 py-4 rounded-xl bg-primary hover:bg-orange-600 text-white text-lg font-bold transition-colors"
            >
              Open the app
            </button>
          </motion.div>
        )}
      </div>

      {/* Controls stay on screen: nobody should hunt for "next" on a projector. */}
      <div className="px-8 sm:px-16 pb-10 flex items-center justify-between">
        <button
          onClick={(e) => {
            e.stopPropagation();
            back();
          }}
          disabled={step === 0}
          aria-label="Previous"
          className="p-3 rounded-xl text-gray-500 hover:text-white hover:bg-[#1E1E1E] transition-colors disabled:opacity-25"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <p className="font-mono text-sm text-gray-600 tabular-nums">
          {step + 1} / {SLIDES.length}
        </p>

        <button
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          disabled={isLast}
          aria-label="Next"
          className="p-3 rounded-xl text-gray-400 hover:text-white hover:bg-[#1E1E1E] transition-colors disabled:opacity-25"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
