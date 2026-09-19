import { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Check, Trash2, Undo2, Repeat, Pencil, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { PIReminder, ReminderRecurrence, User } from '../../types';
import { avatarClasses } from '../../lib/accent';
import { initialOf, roleLabel, timeAgo, todayISO } from '../../lib/format';
import { PIReminders } from '../../lib/usePIReminders';

const RECURRENCES: { id: ReminderRecurrence; label: string }[] = [
  { id: 'once', label: 'One-off' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
];

const RECURRENCE_LABEL: Record<ReminderRecurrence, string> = {
  once: 'One-off',
  weekly: 'Every week',
  monthly: 'Every month',
  quarterly: 'Every 3 months',
  yearly: 'Every year',
};

const DATE_LABEL = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

/**
 * How a due date reads on the card.
 *
 * Relative wording for the days either side of today, because "in 2 days" is
 * what she actually needs to know; a calendar date once it is further out,
 * because "in 34 days" is not.
 */
function dueLabel(dueDate: string | null): { text: string; tone: string } {
  if (!dueDate) return { text: 'No date', tone: 'text-gray-500' };

  const today = todayISO();
  if (dueDate < today) {
    const days = Math.round(
      (new Date(today + 'T00:00:00').getTime() - new Date(dueDate + 'T00:00:00').getTime()) / 86_400_000
    );
    return {
      text: days === 1 ? 'Overdue by a day' : `Overdue by ${days} days`,
      tone: 'text-red-300',
    };
  }
  if (dueDate === today) return { text: 'Due today', tone: 'text-amber-300' };

  const days = Math.round(
    (new Date(dueDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000
  );
  if (days === 1) return { text: 'Due tomorrow', tone: 'text-gray-300' };
  if (days <= 14) return { text: `Due in ${days} days`, tone: 'text-gray-400' };
  return { text: `Due ${DATE_LABEL.format(new Date(dueDate + 'T00:00:00'))}`, tone: 'text-gray-500' };
}

interface FormState {
  memberId: string;
  title: string;
  note: string;
  dueDate: string;
  recurrence: ReminderRecurrence;
}

const EMPTY_FORM: FormState = {
  memberId: '',
  title: '',
  note: '',
  dueDate: '',
  recurrence: 'once',
};

/**
 * The PI's follow-ups on her students and postdocs.
 *
 * Hers alone — nothing written here reaches the person it is about, which is
 * what lets it hold the blunt version of a note ("still no progress report")
 * rather than a diplomatic one. The list is deliberately one list: a one-off
 * follow-up and a standing check differ only by whether ticking them off
 * closes them or rolls them forward.
 */
export const RemindersView: React.FC<{ onBack: () => void; reminders: PIReminders }> = ({
  onBack,
  reminders,
}) => {
  const { allUsers } = useAuth();
  const { showToast } = useUI();
  const { open, done, loading, error, create, update, complete, reopen, remove } = reminders;

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [personFilter, setPersonFilter] = useState('');
  const [showDone, setShowDone] = useState(false);

  /** Everyone she might follow up with — the lab, minus herself and the guest login. */
  const members = useMemo<User[]>(
    () => allUsers.filter((u) => u.role !== 'pi' && u.role !== 'guest'),
    [allUsers]
  );

  const visible = useMemo(
    () => (personFilter ? open.filter((r) => r.memberId === personFilter) : open),
    [open, personFilter]
  );

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormOpen(false);
  };

  const startEdit = (r: PIReminder) => {
    setForm({
      memberId: r.memberId,
      title: r.title,
      note: r.note,
      dueDate: r.dueDate ?? '',
      recurrence: r.recurrence,
    });
    setEditingId(r.id);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.memberId || !form.title.trim() || saving) return;
    setSaving(true);
    try {
      const payload = {
        memberId: form.memberId,
        title: form.title.trim(),
        note: form.note.trim(),
        dueDate: form.dueDate || null,
        recurrence: form.recurrence,
      };
      if (editingId) await update(editingId, payload);
      else await create(payload);
      resetForm();
    } catch (err) {
      // The form keeps its contents on failure — retyping a reminder she has
      // already typed once is the worst possible answer to a dropped request.
      showToast(err instanceof Error ? err.message : 'Could not save that.', 'error');
    } finally {
      setSaving(false);
    }
  };

  /** Every row action is one tap and one refetch, so they share this wrapper. */
  const act = async (id: string, fn: () => Promise<void>, failure: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await fn();
    } catch (err) {
      showToast(err instanceof Error ? err.message : failure, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-16 pt-4 max-w-md mx-auto w-full px-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-white tracking-tight">Reminders</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Private to you — nobody else sees these
          </p>
        </div>
        {!formOpen && (
          <button
            onClick={() => {
              setForm(EMPTY_FORM);
              setEditingId(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-orange-600 text-white text-xs font-bold transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        )}
      </div>

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-300">
              {editingId ? 'Edit reminder' : 'New reminder'}
            </p>
            <button
              type="button"
              onClick={resetForm}
              aria-label="Cancel"
              className="p-1 rounded-full text-gray-500 hover:text-white hover:bg-[#2A2A2A]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1">About</label>
            <select
              required
              value={form.memberId}
              onChange={(e) => setForm({ ...form, memberId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            >
              <option value="">Choose a person…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {roleLabel(m.role, m.handle)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1">Reminder</label>
            <input
              type="text"
              required
              placeholder="e.g. Progress report due"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-gray-600"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1">
              Note <span className="text-gray-600 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Anything you want to remember"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-primary outline-none placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1">
              {form.recurrence === 'once' ? 'Due' : 'Next due'}{' '}
              <span className="text-gray-600 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-primary outline-none [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1.5">Repeats</label>
            <div className="flex flex-wrap gap-1.5">
              {RECURRENCES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setForm({ ...form, recurrence: r.id })}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                    form.recurrence === r.id
                      ? 'bg-primary/20 text-primary border-primary/30'
                      : 'bg-[#2A2A2A] text-gray-400 border-[#333] hover:border-gray-400'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {form.recurrence !== 'once' && (
              <p className="text-[11px] text-gray-500 mt-2">
                Ticking this off moves it to the next date instead of closing it.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || !form.memberId || !form.title.trim()}
            className="w-full py-2.5 bg-primary hover:bg-orange-600 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add reminder'}
          </button>
        </form>
      )}

      {/* Filter by person — only worth showing once there is something to filter */}
      {open.length > 1 && (
        <select
          value={personFilter}
          onChange={(e) => setPersonFilter(e.target.value)}
          aria-label="Filter by person"
          className="mt-4 w-full px-3 py-2 rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] text-gray-300 text-xs focus:ring-1 focus:ring-primary outline-none"
        >
          <option value="">Everyone ({open.length})</option>
          {members
            .filter((m) => open.some((r) => r.memberId === m.id))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({open.filter((r) => r.memberId === m.id).length})
              </option>
            ))}
        </select>
      )}

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 px-1">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-xs text-gray-500">Loading your reminders…</p>
          </div>
        ) : error ? (
          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            Could not load reminders.
            <span className="block mt-1 text-amber-400/70 break-words">{error}</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#1E1E1E] border border-dashed border-[#2A2A2A] text-center space-y-1">
            <p className="text-sm text-gray-400 font-medium">
              {open.length === 0 ? 'Nothing to follow up on' : 'Nothing for this person'}
            </p>
            <p className="text-xs text-gray-600">
              Add a one-off follow-up, or a check that comes back on its own.
            </p>
          </div>
        ) : (
          visible.map((r) => {
            const due = dueLabel(r.dueDate);
            const busy = busyId === r.id;
            return (
              <div
                key={r.id}
                className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3.5 flex items-start gap-3"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0 ${avatarClasses(
                    r.member?.accent
                  )}`}
                >
                  {initialOf(r.member?.name ?? '?', r.member?.handle)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white leading-snug">{r.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                    {r.member?.name ?? 'Someone'} ·{' '}
                    {roleLabel(r.member?.role, r.member?.handle)}
                  </p>
                  {r.note && <p className="text-[11px] text-gray-400 mt-1.5">{r.note}</p>}

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-[11px] font-semibold ${due.tone}`}>{due.text}</span>
                    {r.recurrence !== 'once' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 text-indigo-300 flex items-center gap-1">
                        <Repeat className="w-2.5 h-2.5" />
                        {RECURRENCE_LABEL[r.recurrence]}
                      </span>
                    )}
                    {r.completedAt && r.recurrence !== 'once' && (
                      <span className="text-[10px] text-gray-600">
                        last done {timeAgo(r.completedAt)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() =>
                      void act(r.id, () => complete(r), 'Could not tick that off.')
                    }
                    disabled={busy}
                    aria-label={r.recurrence === 'once' ? 'Mark done' : 'Done for now'}
                    title={r.recurrence === 'once' ? 'Mark done' : 'Done — move to next date'}
                    className="p-1.5 rounded-lg text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => startEdit(r)}
                    aria-label="Edit"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#2A2A2A] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => void act(r.id, () => remove(r.id), 'Could not delete that.')}
                    disabled={busy}
                    aria-label="Delete"
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Done one-offs, folded away. Recurring ones never land here — they roll
          forward instead, so this only ever holds things that are finished. */}
      {done.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
          >
            Done ({done.length})
          </button>

          {showDone && (
            <div className="mt-2 space-y-2">
              {done.map((r) => (
                <div
                  key={r.id}
                  className="bg-[#1E1E1E]/60 border border-[#2A2A2A] rounded-xl p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-400 line-through truncate">
                      {r.title}
                    </p>
                    <p className="text-[11px] text-gray-600 truncate">
                      {r.member?.name ?? 'Someone'}
                      {r.completedAt && ` · done ${timeAgo(r.completedAt)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => void act(r.id, () => reopen(r.id), 'Could not reopen that.')}
                    disabled={busyId === r.id}
                    aria-label="Reopen"
                    title="Reopen"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#2A2A2A] transition-colors disabled:opacity-40 shrink-0"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => void act(r.id, () => remove(r.id), 'Could not delete that.')}
                    disabled={busyId === r.id}
                    aria-label="Delete"
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-40 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
