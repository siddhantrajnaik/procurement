import { useMemo, useState } from 'react';
import { FlaskConical, Beaker, LogOut, IndianRupee, Microscope, History } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { EquipmentStatus, Purchase } from '../../types';
import { formatRupees, timeAgo } from '../../lib/format';
import { useLabActivity } from '../../lib/useLabActivity';

type Period = 'month' | 'quarter' | 'all';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: '3 months' },
  { id: 'all', label: 'All' },
];

const STATUS_LABEL: Record<EquipmentStatus, string> = {
  working: 'Working',
  needs_attention: 'Needs attention',
  down: 'Down',
  under_service: 'Under service',
};

const STATUS_TONE: Record<EquipmentStatus, string> = {
  working: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  needs_attention: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  down: 'text-red-300 bg-red-500/10 border-red-500/20',
  under_service: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
};

/** Start of the window, or null for "all". Built from local time so months line up with IST. */
function periodStart(period: Period): Date | null {
  if (period === 'all') return null;
  const now = new Date();
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getFullYear(), now.getMonth() - 2, 1);
}

/**
 * When a purchase counts as spent.
 *
 * There is no `approved_at` column, so this is the day the winning quotation was
 * recorded — in practice within days of the decision. Adding that column later
 * would make month boundaries exact; nothing else here would change.
 */
function spendOf(p: Purchase): { amount: number; at: string } | null {
  const approved = p.quotations.find((q) => q.isApproved);
  if (!approved) return null;
  return { amount: approved.price, at: approved.createdAt };
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });

/**
 * The PI's whole view of the lab: what it spent, and how it is being used.
 *
 * A separate shell rather than the normal app with things hidden, for the same
 * reason GuestApp is: the procurement surface itemises money in a dozen places —
 * prices on purchase cards, vendor names, quote comparisons, amounts baked into
 * activity strings — and she is to see totals only. Here she can only see what
 * is explicitly mounted below, and a component added later cannot leak in.
 *
 * Read-only throughout. There is no action on this screen by design.
 */
export const PIApp: React.FC = () => {
  const { purchases, equipment } = useApp();
  const { currentUser, logout } = useAuth();
  const { usage, loans, entries, loading } = useLabActivity();
  const [period, setPeriod] = useState<Period>('quarter');

  const since = useMemo(() => periodStart(period), [period]);
  const inPeriod = (iso: string) => !since || new Date(iso) >= since;

  const spend = useMemo(() => {
    const byMonth = new Map<string, { label: string; total: number }>();
    const byCategory = new Map<string, number>();
    let total = 0;

    for (const p of purchases) {
      const s = spendOf(p);
      if (!s || !inPeriod(s.at)) continue;
      total += s.amount;

      const d = new Date(s.at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const month = byMonth.get(key) ?? { label: MONTH_LABEL.format(d), total: 0 };
      month.total += s.amount;
      byMonth.set(key, month);

      const cat = p.category || 'Uncategorised';
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + s.amount);
    }

    return {
      total,
      months: [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([, v]) => v),
      categories: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
      // A purchase can carry an approved quote of ₹0 — a free replacement, a
      // cylinder swap. Counting it keeps the item count honest about activity
      // even though it adds nothing to the total.
      count: purchases.filter((p) => {
        const s = spendOf(p);
        return s && inPeriod(s.at);
      }).length,
    };
  }, [purchases, since]);

  const periodUsage = useMemo(() => usage.filter((u) => inPeriod(u.createdAt)), [usage, since]);
  const periodLoans = useMemo(() => loans.filter((l) => inPeriod(l.createdAt)), [loans, since]);
  const periodEntries = useMemo(() => entries.filter((e) => inPeriod(e.at)), [entries, since]);

  const peopleIn = useMemo(
    () => new Set(periodUsage.map((u) => u.visitorName.trim().toLowerCase())).size,
    [periodUsage]
  );

  /** Instruments, most recently used first. Idle ones sink but never disappear. */
  const instruments = useMemo(() => {
    const rows = equipment.map((eq) => {
      const sessions = periodUsage.filter((u) => u.equipmentId === eq.id);
      const last = eq.usageLog.reduce<string | null>(
        (acc, u) => (!acc || u.createdAt > acc ? u.createdAt : acc),
        null
      );
      const lastBy = last ? eq.usageLog.find((u) => u.createdAt === last) ?? null : null;
      return { eq, sessions: sessions.length, last, lastBy };
    });
    return rows.sort((a, b) => (b.last ?? '').localeCompare(a.last ?? ''));
  }, [equipment, periodUsage]);

  const maxCategory = spend.categories[0]?.[1] ?? 0;
  const maxMonth = spend.months.reduce((m, x) => Math.max(m, x.total), 0);

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="safe-top-modal px-4 pb-3 border-b border-[#2A2A2A] bg-[#1E1E1E] sticky top-0 z-30 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate leading-tight">
            {currentUser?.name ?? 'Principal Investigator'}
          </p>
          <p className="text-[11px] text-gray-500 truncate">Structural Virology Lab, IIT Delhi</p>
        </div>
        <button
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
          className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-[#2A2A2A] transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="flex-1 w-full mx-auto max-w-3xl px-4 pb-16 pt-4 space-y-6">
        {/* Period — drives every figure below it */}
        <div className="flex gap-1.5" role="group" aria-label="Time period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors border ${
                period === p.id
                  ? 'bg-primary/15 border-primary/30 text-primary'
                  : 'bg-[#1E1E1E] border-[#2A2A2A] text-gray-400 hover:text-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Spend — totals only, nothing here opens */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5 text-gray-600" />
            Expenses
          </h2>

          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-5">
            <p className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
              {formatRupees(spend.total)}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              committed across {spend.count} purchase{spend.count === 1 ? '' : 's'}
              {period !== 'all' && ' in this period'}
            </p>
          </div>

          {spend.months.length > 0 && (
            <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-4 space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">By month</p>
              {spend.months.map((m) => (
                <div key={m.label} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-gray-300 font-semibold">{m.label}</span>
                    <span className="text-white font-bold tabular-nums">{formatRupees(m.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#2A2A2A] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: maxMonth > 0 ? `${(m.total / maxMonth) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {spend.categories.length > 0 && (
            <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-4 space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">By category</p>
              {spend.categories.map(([cat, amount]) => (
                <div key={cat} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-gray-300 font-semibold">{cat}</span>
                    <span className="text-white font-bold tabular-nums">{formatRupees(amount)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#2A2A2A] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-400/70"
                      style={{ width: maxCategory > 0 ? `${(amount / maxCategory) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {spend.total === 0 && spend.count === 0 && (
            <p className="text-xs text-gray-600 px-1">Nothing was committed in this period.</p>
          )}
        </section>

        {/* Lab usage at a glance */}
        <section className="grid grid-cols-3 gap-2">
          {[
            { label: 'Sessions', value: periodUsage.length },
            { label: 'People in', value: peopleIn },
            { label: 'Items taken', value: periodLoans.length },
          ].map((s) => (
            <div key={s.label} className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3.5 text-center">
              <p className="text-2xl font-extrabold text-white tabular-nums leading-none">{s.value}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1.5">{s.label}</p>
            </div>
          ))}
        </section>

        {/* Instruments — always listed, even the ones nobody has logged */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Microscope className="w-3.5 h-3.5 text-gray-600" />
            Instruments ({equipment.length})
          </h2>

          {equipment.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#1E1E1E] border border-dashed border-[#2A2A2A] text-center">
              <p className="text-sm text-gray-500">No instruments listed yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {instruments.map(({ eq, sessions, last, lastBy }) => (
                <div key={eq.id} className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{eq.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {last && lastBy
                          ? `Last used ${timeAgo(last)} by ${lastBy.visitorName}`
                          : 'No use logged yet'}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_TONE[eq.status]}`}
                    >
                      {STATUS_LABEL[eq.status]}
                    </span>
                  </div>
                  {sessions > 0 && (
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      {sessions} session{sessions === 1 ? '' : 's'} in this period
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* The feed: who was on what, and what left the room */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-gray-600" />
            Recent sessions
          </h2>

          {loading ? (
            <div className="flex items-center gap-2 px-1">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-xs text-gray-500">Loading the log…</p>
            </div>
          ) : periodEntries.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#1E1E1E] border border-dashed border-[#2A2A2A] text-center space-y-1">
              <p className="text-sm text-gray-400 font-medium">Nothing logged in this period</p>
              <p className="text-xs text-gray-600">
                Instrument use and borrowed items appear here as they are recorded.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {periodEntries.map((entry) => {
                const isUsage = entry.kind === 'usage';
                const Icon = isUsage ? FlaskConical : Beaker;
                const instrument = isUsage
                  ? equipment.find((e) => e.id === entry.row.equipmentId)?.name ?? 'an instrument'
                  : entry.row.itemName;
                // loggedBy is set only when a lab member logged it; visitors
                // type their own name and leave it null.
                const isMember = entry.row.loggedBy !== null;
                const detail = isUsage
                  ? [entry.row.purpose, entry.row.speed, entry.row.duration].filter(Boolean).join(' · ')
                  : entry.row.notes;

                return (
                  <div
                    key={`${entry.kind}-${entry.row.id}`}
                    className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3.5 flex items-start gap-3"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isUsage
                          ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm text-gray-200 min-w-0">
                          <strong className="font-bold text-white">{entry.row.visitorName}</strong>
                          {isUsage ? ' used ' : ' took '}
                          <span className="font-semibold text-gray-300">{instrument}</span>
                          {!isUsage && entry.row.quantity && (
                            <span className="text-gray-500"> ({entry.row.quantity})</span>
                          )}
                        </p>
                        <span className="text-[11px] text-gray-600 shrink-0">{timeAgo(entry.at)}</span>
                      </div>

                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {isMember ? 'Lab' : entry.row.affiliation || 'Visitor'}
                      </p>
                      {detail && <p className="text-[11px] text-gray-400 mt-1">{detail}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
