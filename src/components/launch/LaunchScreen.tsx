import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, type PanInfo } from 'motion/react';
import confetti from 'canvas-confetti';
import { Scissors } from 'lucide-react';
import { playSound } from '../../lib/sound';

/**
 * The opening ceremony: cut a ribbon, play the film, open the app.
 *
 * Single use. It is reached only by its own link and is meant to be deleted
 * after the event -- which is why nothing outside this folder knows it exists
 * beyond three lines in App.tsx, and why it touches no schema, no storage and
 * no shared component.
 *
 * It reads nothing from Supabase, deliberately. It runs once, live, in a room
 * with a projector and campus wifi, and a launch that depends on the network is
 * a launch that can show a spinner to an audience.
 */

/** Set when the hash names the ceremony. */
export const LAUNCH_HASH = '#/launch';

/** Swap this file to change the film. Nothing else needs to change. */
const VIDEO_SRC = `${import.meta.env.BASE_URL}launch.mp4`;

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
 * to discover a problem thirty seconds before an audience.
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

/** How far the scissors must travel before the cut commits. */
const CUT_DISTANCE = 90;

type Stage = 'ribbon' | 'video';

export const LaunchScreen: React.FC = () => {
  const [stage, setStage] = useState<Stage>('ribbon');
  const [cut, setCut] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const cutRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  /** Clears the hash and reloads, so the app opens clean rather than mid-ceremony. */
  const openApp = useCallback(() => {
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      /* a blocked history API is not worth failing the hand-off over */
    }
    window.location.reload();
  }, []);

  const celebrate = useCallback(() => {
    // Decoration, and neither may throw into the ceremony: playSound already
    // swallows a blocked AudioContext, and confetti is wrapped here.
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
    window.setTimeout(() => setStage('video'), 1100);
  }, [celebrate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        openApp();
        return;
      }
      // Enter and Space are the recovery path for a pointer that will not
      // cooperate. Only before the cut — during the film they would skip it.
      if (!cutRef.current && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        doCut();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doCut, openApp]);

  /**
   * Start the film once it is on screen.
   *
   * The cut is a real user gesture, so autoplay with sound is allowed here in a
   * way it would never be on page load. If the browser refuses anyway, say so
   * rather than leaving a black rectangle: `videoFailed` puts a button on screen
   * so nobody is stranded in front of a room.
   */
  useEffect(() => {
    if (stage !== 'video') return;
    const el = videoRef.current;
    if (!el) return;
    el.play().catch(() => setVideoFailed(true));
  }, [stage]);

  const onDrag = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) >= CUT_DISTANCE) doCut();
  };

  // ------------------------------------------------------------------ film
  if (stage === 'video') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          className="w-full h-full object-contain"
          playsInline
          // Ends by opening the app, so the film runs straight into the product
          // with nobody having to do anything.
          onEnded={openApp}
          onError={() => setVideoFailed(true)}
        />

        {videoFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black">
            <p className="text-gray-400 text-lg">The film could not play.</p>
            <button
              onClick={openApp}
              className="px-10 py-4 rounded-xl bg-primary hover:bg-orange-600 text-white text-lg font-bold transition-colors"
            >
              Open the app
            </button>
          </div>
        )}

        {/* Always reachable, never prominent: a way out if the film runs long or
            the room has moved on. Escape does the same. */}
        <button
          onClick={openApp}
          className="absolute bottom-6 right-6 px-4 py-2 rounded-lg text-sm font-semibold text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          Skip
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------- ribbon
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
        <h1 className="mt-4 text-5xl sm:text-7xl font-extrabold tracking-tight">MB Lab</h1>
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
              background: 'linear-gradient(180deg,#FF8A6A 0%,#FF6B4A 45%,#E04A28 100%)',
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
};
