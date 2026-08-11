import { AccentToken } from '../types';

// Written as complete literal strings so Tailwind's scanner keeps them in the build.
const AVATAR_CLASSES: Record<AccentToken, string> = {
  purple: 'bg-purple-500/15 text-purple-300 border border-purple-500/25',
  blue: 'bg-blue-500/15 text-blue-300 border border-blue-500/25',
  emerald: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
  indigo: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25',
  pink: 'bg-pink-500/15 text-pink-300 border border-pink-500/25',
  orange: 'bg-orange-500/15 text-orange-300 border border-orange-500/25',
  cyan: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25',
  amber: 'bg-amber-500/15 text-amber-300 border border-amber-500/25',
  red: 'bg-red-500/15 text-red-300 border border-red-500/25',
  slate: 'bg-slate-500/15 text-slate-300 border border-slate-500/25',
};

export function avatarClasses(accent: AccentToken | undefined): string {
  return AVATAR_CLASSES[accent ?? 'slate'] ?? AVATAR_CLASSES.slate;
}
