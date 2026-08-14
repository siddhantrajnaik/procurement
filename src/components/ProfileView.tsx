import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { avatarClasses } from '../lib/accent';
import { formatRupees, initialOf, roleLabel } from '../lib/format';
import { User } from '../types';
import { UserCheck, Building, Store, Search, List, Sparkles, Wrench, CalendarClock, Cake } from 'lucide-react';
import * as api from '../lib/api';
import { VendorsView } from './VendorsView';
import { LostFoundView } from './LostFoundView';
import { ListsView } from './ListsView';
import { MuhuratView } from './MuhuratView';
import { EquipmentView } from './EquipmentView';
import { BookingView } from './BookingView';

export const ProfileView: React.FC = () => {
  const { purchases, inventoryItems, vendors, lostFoundItems, labLists, equipment, bookableItems, bookings } = useApp();
  const { currentUser, allUsers, login, verifyAdminPin, patchUser } = useAuth();
  const { showToast } = useUI();
  const [pendingAdmin, setPendingAdmin] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [showVendors, setShowVendors] = useState(false);
  const [showLostFound, setShowLostFound] = useState(false);
  const [showLists, setShowLists] = useState(false);
  const [showMuhurat, setShowMuhurat] = useState(false);
  const [showEquipment, setShowEquipment] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [editingBirthday, setEditingBirthday] = useState(false);
  const [birthdayInput, setBirthdayInput] = useState('');
  const [savingBirthday, setSavingBirthday] = useState(false);

  const activeCount = purchases.filter(
    (p) => p.status !== 'delivered' && p.status !== 'closed'
  ).length;
  const quotesCount = purchases.filter(
    (p) => p.status === 'waiting' || p.status === 'quotes'
  ).length;
  const orderedCount = purchases.filter(
    (p) => p.status === 'ordered' || p.status === 'transit'
  ).length;
  const totalSpend = purchases.reduce((acc, p) => {
    const aq = p.quotations.find((q) => q.isApproved);
    return acc + (aq ? aq.price : 0);
  }, 0);
  const lowStockCount = inventoryItems.filter(
    (i) => i.lowStockThreshold != null && i.quantity <= i.lowStockThreshold
  ).length;

  const upcomingBirthdays = allUsers
    .filter((u) => u.birthday)
    .map((u) => {
      const today = new Date();
      const [, mm, dd] = u.birthday!.split('-').map(Number);
      const next = new Date(today.getFullYear(), mm - 1, dd);
      if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        next.setFullYear(today.getFullYear() + 1);
      }
      const daysAway = Math.round((next.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
      return { user: u, daysAway, date: next };
    })
    .filter((b) => b.daysAway <= 30)
    .sort((a, b) => a.daysAway - b.daysAway);

  const handleSaveBirthday = async () => {
    if (!birthdayInput || savingBirthday) return;
    setSavingBirthday(true);
    try {
      await api.updateBirthday(currentUser!.id, birthdayInput);
      patchUser(currentUser!.id, { birthday: birthdayInput });
      showToast('Birthday saved!', 'success');
      setEditingBirthday(false);
    } catch {
      showToast('Could not save birthday.', 'error');
    } finally {
      setSavingBirthday(false);
    }
  };

  if (!currentUser) return null;

  if (showVendors) {
    return <VendorsView onBack={() => setShowVendors(false)} />;
  }

  if (showLostFound) {
    return <LostFoundView onBack={() => setShowLostFound(false)} />;
  }

  if (showLists) {
    return <ListsView onBack={() => setShowLists(false)} />;
  }

  if (showMuhurat) {
    return <MuhuratView onBack={() => setShowMuhurat(false)} />;
  }

  if (showEquipment) {
    return <EquipmentView onBack={() => setShowEquipment(false)} />;
  }

  if (showBookings) {
    return <BookingView onBack={() => setShowBookings(false)} />;
  }

  return (
    <div className="flex-1 flex flex-col pb-28 pt-4 max-w-md mx-auto w-full px-4 space-y-4">
      {/* Current user card */}
      <div className="bg-[#1E1E1E] p-5 rounded-xl border border-[#2A2A2A] space-y-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl ${avatarClasses(currentUser.accent)}`}
          >
            {initialOf(currentUser.name)}
          </div>
          <div>
            <h2 className="font-extrabold text-white text-lg tracking-tight">
              {currentUser.name}
            </h2>
            <p className="text-xs text-gray-400">
              {currentUser.handle}
              {currentUser.email ? ` · ${currentUser.email}` : ''}
            </p>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 capitalize">
              {roleLabel(currentUser.role)}
            </span>
          </div>
        </div>

        {currentUser.department && (
          <div className="p-3 rounded-lg bg-background border border-[#2A2A2A] text-xs text-gray-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <Building className="w-3.5 h-3.5 text-gray-500" />
              {currentUser.department}
            </span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
              Active
            </span>
          </div>
        )}

        {/* Birthday */}
        {editingBirthday ? (
          <div className="p-3 rounded-lg bg-background border border-[#2A2A2A] space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Your Birthday</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={birthdayInput}
                onChange={(e) => setBirthdayInput(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
              <button
                onClick={handleSaveBirthday}
                disabled={!birthdayInput || savingBirthday}
                className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg disabled:opacity-40"
              >
                {savingBirthday ? '...' : 'Save'}
              </button>
              <button
                onClick={() => setEditingBirthday(false)}
                className="px-3 py-2 bg-[#2A2A2A] text-gray-300 text-xs font-bold rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setBirthdayInput(currentUser.birthday ?? '');
              setEditingBirthday(true);
            }}
            className="w-full p-3 rounded-lg bg-background border border-[#2A2A2A] text-xs text-gray-300 flex items-center justify-between hover:border-pink-500/30 transition-colors"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Cake className="w-3.5 h-3.5 text-pink-400" />
              {currentUser.birthday
                ? new Date(currentUser.birthday + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })
                : 'Add your birthday'}
            </span>
            <span className="text-[10px] text-gray-500">{currentUser.birthday ? 'Edit' : 'Set'}</span>
          </button>
        )}
      </div>


      {/* Upcoming Birthdays */}
      {upcomingBirthdays.length > 0 && (
        <div className="bg-[#1E1E1E] p-4 rounded-xl border border-pink-500/20 space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
            <Cake className="w-3.5 h-3.5" />
            Upcoming Birthdays
          </h3>
          <div className="space-y-2">
            {upcomingBirthdays.map((b) => (
              <div key={b.user.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-background border border-[#2A2A2A]">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${avatarClasses(b.user.accent)}`}>
                  {initialOf(b.user.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{b.user.name}</p>
                  <p className="text-[10px] text-gray-500">
                    {b.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  b.daysAway === 0
                    ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                    : b.daysAway <= 7
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    : 'bg-[#2A2A2A] text-gray-400 border border-[#333]'
                }`}>
                  {b.daysAway === 0 ? 'Today!' : b.daysAway === 1 ? 'Tomorrow' : `${b.daysAway}d`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-[#1E1E1E] p-3.5 rounded-xl border border-[#2A2A2A] space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Active Requests
          </p>
          <p className="text-xl font-extrabold text-white">{activeCount}</p>
        </div>
        <div className="bg-[#1E1E1E] p-3.5 rounded-xl border border-[#2A2A2A] space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
            Waiting Quotes
          </p>
          <p className="text-xl font-extrabold text-purple-300">{quotesCount}</p>
        </div>
        <div className="bg-[#1E1E1E] p-3.5 rounded-xl border border-[#2A2A2A] space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
            In Pipeline
          </p>
          <p className="text-xl font-extrabold text-blue-300">{orderedCount}</p>
        </div>
        <div className="bg-[#1E1E1E] p-3.5 rounded-xl border border-[#2A2A2A] space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            Approved POs
          </p>
          <p className="text-base font-extrabold text-emerald-300">
            {formatRupees(totalSpend)}
          </p>
        </div>
        <div className="bg-[#1E1E1E] p-3.5 rounded-xl border border-[#2A2A2A] space-y-1 col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Inventory
          </p>
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-extrabold text-white">{inventoryItems.length} items</span>
            {lowStockCount > 0 && (
              <span className="text-xs font-bold text-amber-300">
                {lowStockCount} low stock
              </span>
            )}
          </div>
        </div>
      </div>

      {/* User switcher */}
      <div className="bg-[#1E1E1E] p-4 rounded-xl border border-[#2A2A2A] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-300 text-xs uppercase tracking-wider">
            Switch Persona
          </h3>
          <span className="text-[10px] text-gray-500">Click to switch</span>
        </div>

        <div className="space-y-1.5">
          {allUsers.map((u) => {
            const isAdmin = u.role === 'pi' || u.role === 'procurement_incharge';
            const handleClick = () => {
              if (u.id === currentUser.id) return;
              if (isAdmin) {
                setPendingAdmin(u);
                setPin('');
              } else {
                login(u.id);
              }
            };
            return (
            <button
              key={u.id}
              onClick={handleClick}
              className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between text-xs transition-colors ${
                u.id === currentUser.id
                  ? 'bg-primary text-white font-semibold'
                  : 'bg-background hover:bg-[#2A2A2A] text-gray-300 border border-[#2A2A2A]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    u.id === currentUser.id
                      ? 'bg-white/20 text-white'
                      : avatarClasses(u.accent)
                  }`}
                >
                  {initialOf(u.name)}
                </div>
                <div>
                  <p className="font-bold">{u.name}</p>
                  <p
                    className={`text-[10px] capitalize ${
                      u.id === currentUser.id ? 'text-orange-100' : 'text-gray-500'
                    }`}
                  >
                    {roleLabel(u.role)}
                  </p>
                </div>
              </div>
              {u.id === currentUser.id && <UserCheck className="w-4 h-4 text-white" />}
              {u.id !== currentUser.id && isAdmin && (
                <span className="material-symbols-outlined text-[14px] text-gray-500">lock</span>
              )}
            </button>
            );
          })}
        </div>
      </div>

      {/* Vendor directory */}
      <button
        onClick={() => setShowVendors(true)}
        className="w-full bg-[#1E1E1E] p-4 rounded-xl border border-[#2A2A2A] hover:border-primary/40 transition-colors flex items-center gap-3 group"
      >
        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <Store className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-bold text-white text-sm">Vendor Directory</h3>
          <p className="text-[11px] text-gray-400">
            {vendors.length} vendor{vendors.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <span className="material-symbols-outlined text-gray-500 text-[20px] group-hover:text-gray-300 transition-colors">
          chevron_right
        </span>
      </button>

      {/* Equipment */}
      <button
        onClick={() => setShowEquipment(true)}
        className="w-full bg-[#1E1E1E] p-4 rounded-xl border border-[#2A2A2A] hover:border-primary/40 transition-colors flex items-center gap-3 group"
      >
        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
          <Wrench className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-bold text-white text-sm">Lab Equipment</h3>
          <p className="text-[11px] text-gray-400">
            {equipment.length} instrument{equipment.length !== 1 ? 's' : ''} · {equipment.filter((e) => e.status === 'down').length} down
          </p>
        </div>
        <span className="material-symbols-outlined text-gray-500 text-[20px] group-hover:text-gray-300 transition-colors">
          chevron_right
        </span>
      </button>

      {/* Bookings */}
      <button
        onClick={() => setShowBookings(true)}
        className="w-full bg-[#1E1E1E] p-4 rounded-xl border border-[#2A2A2A] hover:border-primary/40 transition-colors flex items-center gap-3 group"
      >
        <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
          <CalendarClock className="w-5 h-5 text-violet-400" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-bold text-white text-sm">Bookings</h3>
          <p className="text-[11px] text-gray-400">
            {bookableItems.length} item{bookableItems.length !== 1 ? 's' : ''} · {bookings.filter((b) => b.date >= new Date().toISOString().slice(0, 10) && b.status === 'confirmed').length} upcoming
          </p>
        </div>
        <span className="material-symbols-outlined text-gray-500 text-[20px] group-hover:text-gray-300 transition-colors">
          chevron_right
        </span>
      </button>

      {/* Lost & Found */}
      <button
        onClick={() => setShowLostFound(true)}
        className="w-full bg-[#1E1E1E] p-4 rounded-xl border border-[#2A2A2A] hover:border-primary/40 transition-colors flex items-center gap-3 group"
      >
        <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
          <Search className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-bold text-white text-sm">Lost & Found</h3>
          <p className="text-[11px] text-gray-400">
            {lostFoundItems.filter((i) => i.status === 'open').length} item{lostFoundItems.filter((i) => i.status === 'open').length !== 1 ? 's' : ''} reported lost
          </p>
        </div>
        <span className="material-symbols-outlined text-gray-500 text-[20px] group-hover:text-gray-300 transition-colors">
          chevron_right
        </span>
      </button>

      {/* Lists */}
      <button
        onClick={() => setShowLists(true)}
        className="w-full bg-[#1E1E1E] p-4 rounded-xl border border-[#2A2A2A] hover:border-primary/40 transition-colors flex items-center gap-3 group"
      >
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
          <List className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-bold text-white text-sm">Lists</h3>
          <p className="text-[11px] text-gray-400">
            {labLists.length} list{labLists.length !== 1 ? 's' : ''}
          </p>
        </div>
        <span className="material-symbols-outlined text-gray-500 text-[20px] group-hover:text-gray-300 transition-colors">
          chevron_right
        </span>
      </button>

      {/* Shubh Muhurat */}
      <button
        onClick={() => setShowMuhurat(true)}
        className="w-full bg-[#1E1E1E] p-4 rounded-xl border border-[#2A2A2A] hover:border-primary/40 transition-colors flex items-center gap-3 group"
      >
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
          <Sparkles className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-bold text-white text-sm">Shubh Muhurat</h3>
          <p className="text-[11px] text-gray-400">Check auspicious timing</p>
        </div>
        <span className="material-symbols-outlined text-gray-500 text-[20px] group-hover:text-gray-300 transition-colors">
          chevron_right
        </span>
      </button>

      {/* SidLab Tools */}
      <a
        href="https://siddhantrajnaik.github.io/SidLab-Tools/"
        target="_blank"
        rel="noopener noreferrer"
        className="w-full bg-[#1E1E1E] p-4 rounded-xl border border-[#2A2A2A] hover:border-primary/40 transition-colors flex items-center gap-3 group"
      >
        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
          <span className="material-symbols-outlined text-cyan-400 text-[20px]">science</span>
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-bold text-white text-sm">SidLab Tools</h3>
          <p className="text-[11px] text-gray-400">Scientific tools & calculators</p>
        </div>
        <span className="material-symbols-outlined text-gray-500 text-[20px] group-hover:text-gray-300 transition-colors">
          open_in_new
        </span>
      </a>

      {pendingAdmin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPendingAdmin(null)} />
          <div className="relative w-full max-w-xs bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-6 flex flex-col items-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-3 ${avatarClasses(pendingAdmin.accent)}`}>
              {initialOf(pendingAdmin.name)}
            </div>
            <h3 className="font-bold text-white text-base mb-1">Enter admin PIN</h3>
            <p className="text-xs text-gray-400 mb-4">Switching to {pendingAdmin.name}</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (pin.length < 4 || isChecking) return;
                setIsChecking(true);
                try {
                  const ok = await verifyAdminPin(pin);
                  if (ok) {
                    login(pendingAdmin.id);
                    setPendingAdmin(null);
                  } else {
                    showToast('Incorrect PIN.', 'error');
                    setPin('');
                  }
                } catch {
                  showToast('Could not verify the PIN.', 'error');
                } finally {
                  setIsChecking(false);
                }
              }}
              className="w-full space-y-3"
            >
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full px-4 py-2.5 bg-background border border-[#2A2A2A] rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-white text-center text-lg font-mono tracking-[0.6em]"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPendingAdmin(null)}
                  className="flex-1 py-2 text-sm font-medium text-gray-300 bg-[#2A2A2A] rounded-md hover:bg-[#333] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pin.length < 4 || isChecking}
                  className="flex-1 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isChecking ? 'Checking...' : 'Unlock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
