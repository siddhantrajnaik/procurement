import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlaskConical, Beaker, Sparkles, Pencil, LogOut, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import * as api from '../../lib/api';
import { NewLoanInput } from '../../types';
import { EquipmentCard } from '../EquipmentCard';
import { MuhuratView } from '../MuhuratView';
import { GuestIdentityGate } from './GuestIdentityGate';
import { GuestInstrumentSheet } from './GuestInstrumentSheet';
import { BorrowModal } from './BorrowModal';
import { GuestIdentity, loadGuestIdentity, saveGuestIdentity } from './guestIdentity';

type GuestTab = 'instruments' | 'borrow' | 'muhurat';

const TABS: { id: GuestTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'instruments', label: 'Instruments', icon: FlaskConical },
  { id: 'borrow', label: 'Take', icon: Beaker },
  { id: 'muhurat', label: 'Muhurat', icon: Sparkles },
];

/**
 * The entire experience for a visiting researcher.
 *
 * This is a separate shell rather than the normal app with things hidden. The
 * procurement surface leaks money in too many places to gate reliably — prices
 * on purchase cards, a rupee total on the profile page, and amounts baked into
 * activity-feed strings — and a component added later would silently reappear
 * for guests. Here, a guest can only see what is explicitly mounted below.
 */
export const GuestApp: React.FC = () => {
  const { equipment, inventoryItems } = useApp();
  const { logout } = useAuth();
  const { showToast } = useUI();

  const [identity, setIdentity] = useState<GuestIdentity | null>(() => loadGuestIdentity());
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [tab, setTab] = useState<GuestTab>('instruments');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [borrowOpen, setBorrowOpen] = useState(false);

  const openEquipment = useMemo(
    () => equipment.find((e) => e.id === openId) ?? null,
    [equipment, openId]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return equipment;
    return equipment.filter((e) =>
      [e.name, e.manufacturer, e.model, e.location].some((f) => f?.toLowerCase().includes(q))
    );
  }, [equipment, search]);

  const saveIdentity = useCallback((next: GuestIdentity) => {
    saveGuestIdentity(next);
    setIdentity(next);
    setEditingIdentity(false);
  }, []);

  const logUse = useCallback(async (): Promise<boolean> => {
    if (!identity || !openEquipment) return false;
    try {
      await api.logEquipmentUsage({
        equipmentId: openEquipment.id,
        visitorName: identity.name,
        affiliation: identity.affiliation,
      });
      showToast(`Logged use of ${openEquipment.name}.`, 'success');
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save that.', 'error');
      return false;
    }
  }, [identity, openEquipment, showToast]);

  const logLoan = useCallback(
    async (input: Omit<NewLoanInput, 'visitorName'>): Promise<boolean> => {
      if (!identity) return false;
      try {
        await api.logConsumableLoan({
          ...input,
          visitorName: identity.name,
          affiliation: identity.affiliation,
        });
        showToast(`Logged ${input.itemName}.`, 'success');
        return true;
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not save that.', 'error');
        return false;
      }
    },
    [identity, showToast]
  );

  // Opening the borrow sheet is the whole of that tab, so bounce back to the
  // instrument list once it closes rather than leaving an empty screen.
  useEffect(() => {
    if (tab === 'borrow') setBorrowOpen(true);
  }, [tab]);

  if (!identity || editingIdentity) {
    return (
      <GuestIdentityGate
        initial={editingIdentity ? identity : null}
        onSave={saveIdentity}
        onCancel={editingIdentity ? () => setEditingIdentity(false) : undefined}
      />
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="safe-top-modal px-4 pb-3 border-b border-[#2A2A2A] bg-[#1E1E1E] sticky top-0 z-30 flex items-center justify-between gap-3">
        <button
          onClick={() => setEditingIdentity(true)}
          className="flex items-center gap-2 min-w-0 text-left group"
        >
          <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-sm shrink-0">
            👋
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate leading-tight flex items-center gap-1.5">
              {identity.name}
              <Pencil className="w-3 h-3 text-gray-600 group-hover:text-gray-400 shrink-0" />
            </p>
            <p className="text-[11px] text-gray-500 truncate">
              {identity.affiliation || 'Visitor'}
            </p>
          </div>
        </button>

        <button
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
          className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-[#2A2A2A] transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="flex-1 w-full mx-auto max-w-3xl px-4 pb-28 pt-4">
        {tab === 'muhurat' ? (
          <MuhuratView onBack={() => setTab('instruments')} />
        ) : (
          <>
            <h1 className="text-xl font-extrabold text-white tracking-tight mb-1">Instruments</h1>
            <p className="text-xs text-gray-500 mb-4">
              Tap an instrument after you use it, so the lab has a record.
            </p>

            <div className="relative mb-4">
              <Search className="w-4 h-4 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search instruments…"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-gray-600"
              />
            </div>

            {visible.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#1E1E1E] border border-dashed border-[#2A2A2A] text-center">
                <p className="text-sm text-gray-500">
                  {search.trim() ? `No instruments match "${search.trim()}".` : 'No instruments listed yet.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {visible.map((eq) => (
                  <EquipmentCard key={eq.id} equipment={eq} onClick={() => setOpenId(eq.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 h-[72px] glass-nav border-t border-[#2A2A2A] flex items-stretch z-40 safe-bottom-fixed">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 transition-colors ${
                active ? 'text-primary' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Each sheet owns its own AnimatePresence, matching every other modal in
          this app. Wrapping a custom component in AnimatePresence from out here
          left them mounted forever — they never unmounted, even on an explicit
          close. */}
      <GuestInstrumentSheet
        equipment={openEquipment}
        onClose={() => setOpenId(null)}
        onLogUse={logUse}
      />

      <BorrowModal
        open={borrowOpen}
        items={inventoryItems}
        onClose={() => {
          setBorrowOpen(false);
          setTab('instruments');
        }}
        onSubmit={logLoan}
      />
    </div>
  );
};
