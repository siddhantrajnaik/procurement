import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import * as api from '../lib/api';
import { useUI } from '../context/UIContext';

const MAX = 140;

/** One line of text for the lab's wall screen, with an optional last day. */
export const WallNoticePanel: React.FC<{ readOnly: boolean }> = ({ readOnly }) => {
  const { showToast } = useUI();
  const [text, setText] = useState('');
  const [until, setUntil] = useState('');
  const [saved, setSaved] = useState<{ text: string; until: string } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .fetchWallNotice()
      .then((n) => {
        if (!live) return;
        setText(n.text ?? '');
        setUntil(n.until ?? '');
        setSaved({ text: n.text ?? '', until: n.until ?? '' });
      })
      .catch(() => { if (live) setUnavailable(true); });
    return () => { live = false; };
  }, []);

  const dirty = saved !== null && (text.trim() !== saved.text || until !== saved.until);

  const save = async (clear = false) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = clear ? { text: '', until: '' } : { text: text.trim(), until };
      await api.setWallNotice(next.text || null, next.until || null);
      setText(next.text);
      setUntil(next.until);
      setSaved(next);
      showToast(clear || !next.text ? 'Wall screen notice cleared.' : 'Wall screen notice saved.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save the notice.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (unavailable) return null; // the database has not been updated yet (migration 0036)

  return (
    <section className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-amber-400 shrink-0" />
        <h2 className="text-sm font-bold text-white flex-1">Wall screen notice</h2>
      </div>
      <p className="text-[11px] text-gray-400">
        One line shown at the top of the lab's wall screen, such as "Group meeting Friday 4 PM". Leave it empty to show nothing.
      </p>
      <div className="space-y-2">
        <input
          type="text"
          value={text}
          maxLength={MAX}
          disabled={readOnly || saved === null}
          onChange={(e) => setText(e.target.value)}
          placeholder="Group meeting Friday 4 PM"
          aria-label="Wall screen notice"
          className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-400/60 disabled:opacity-60"
        />
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-gray-400 shrink-0" htmlFor="wall-notice-until">Show until</label>
          <input
            id="wall-notice-until"
            type="date"
            value={until}
            disabled={readOnly || saved === null}
            onChange={(e) => setUntil(e.target.value)}
            className="bg-[#121212] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400/60 disabled:opacity-60"
          />
          <span className="text-[11px] text-gray-500 flex-1 text-right tabular-nums">{text.length}/{MAX}</span>
        </div>
      </div>
      {!readOnly && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || busy}
            className="px-3 py-2 rounded-lg text-xs font-bold bg-amber-400 text-black disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          {saved && (saved.text || saved.until) && (
            <button
              type="button"
              onClick={() => void save(true)}
              disabled={busy}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-300 bg-[#2A2A2A] hover:text-white disabled:opacity-40"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </section>
  );
};
