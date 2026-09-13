import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { avatarClasses } from '../lib/accent';
import { initialOf, roleLabel } from '../lib/format';
import { User } from '../types';

export const LoginScreen: React.FC = () => {
  const { allUsers, usersLoading, usersError, reloadUsers, login, verifyAdminPin } = useAuth();
  const { showToast } = useUI();
  const [selectedAdmin, setSelectedAdmin] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  /**
   * Visitors were having to scroll past every lab member to find "Guest", so the
   * screen now asks which one you are first and only then shows the name list.
   */
  const [mode, setMode] = useState<'choose' | 'members'>('choose');

  // The PI is deliberately absent: she reaches her own screen by her own link,
  // and listing her here would put her behind the PIN the whole lab knows.
  const admins = allUsers.filter((u) => u.role === 'procurement_incharge');
  const labMembers = allUsers.filter((u) => u.role === 'lab_member');
  const guests = allUsers.filter((u) => u.role === 'guest');

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin || isChecking) return;

    setIsChecking(true);
    try {
      const ok = await verifyAdminPin(pin);
      if (ok) {
        login(selectedAdmin.id);
      } else {
        showToast('Incorrect PIN.', 'error');
        setPin('');
      }
    } catch {
      showToast('Could not verify the PIN. Check your connection.', 'error');
    } finally {
      setIsChecking(false);
    }
  };

  if (selectedAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#1E1E1E] rounded-xl p-8 shadow-sm border border-[#2A2A2A] flex flex-col items-center">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-[20px] mb-4 ${avatarClasses(selectedAdmin.accent)}`}
          >
            {initialOf(selectedAdmin.name, selectedAdmin.handle)}
          </div>
          <h1 className="font-bold text-xl text-white mb-1 tracking-tight">Enter admin PIN</h1>
          <p className="text-gray-400 text-sm mb-6 text-center">
            Signing in as {selectedAdmin.name}
          </p>

          <form onSubmit={handlePinSubmit} className="w-full space-y-4">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              aria-label="Admin PIN"
              className="w-full px-4 py-3 bg-background border border-[#2A2A2A] rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-white text-center text-xl font-mono tracking-[0.6em]"
              autoFocus
            />

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedAdmin(null);
                  setPin('');
                }}
                className="flex-1 px-4 py-2.5 bg-[#2A2A2A] text-white rounded-md font-medium text-sm hover:bg-[#333] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pin.length < 4 || isChecking}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-md font-medium text-sm hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChecking ? 'Checking…' : 'Unlock'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const guest = guests[0] ?? null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 py-12">
      <div className="w-full max-w-md bg-[#1E1E1E] rounded-xl p-8 shadow-sm border border-[#2A2A2A] flex flex-col items-center">
        <div className="w-12 h-12 rounded bg-primary flex items-center justify-center mb-5">
          <span className="material-symbols-outlined text-white text-[28px]">biotech</span>
        </div>
        <h1 className="font-bold text-2xl text-white mb-2 tracking-tight">MB Lab Procurement</h1>
        <p className="text-gray-400 text-sm mb-8 text-center max-w-xs">
          {mode === 'choose'
            ? 'Structural Virology Lab, IIT Delhi.'
            : 'Choose your name to sign in.'}
        </p>

        {usersLoading ? (
          <div className="w-full flex flex-col items-center gap-3 py-6">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-xs text-gray-500">Loading the lab directory…</p>
          </div>
        ) : usersError ? (
          <div className="w-full space-y-3">
            <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
              Could not reach the lab directory. Check your connection and try again.
              <span className="block mt-1 text-amber-400/70 break-words">{usersError}</span>
            </div>
            <button
              onClick={() => void reloadUsers()}
              className="w-full py-2.5 rounded-lg bg-[#2A2A2A] hover:bg-[#333] text-gray-200 text-sm font-semibold transition-colors"
            >
              Try again
            </button>
          </div>
        ) : allUsers.length === 0 ? (
          <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
            No lab members found. Run the database migration to seed the profiles table.
          </p>
        ) : mode === 'choose' ? (
          <div className="w-full space-y-3">
            <button
              onClick={() => setMode('members')}
              disabled={admins.length === 0 && labMembers.length === 0}
              className="w-full text-left p-4 rounded-xl border border-[#2A2A2A] hover:border-primary/50 hover:bg-[#2A2A2A] transition-colors flex items-center gap-4 group disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="w-11 h-11 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-[22px]">science</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-sm">I work in this lab</div>
                <div className="text-xs text-gray-400 mt-0.5">Sign in with your name and PIN</div>
              </div>
              <span className="material-symbols-outlined text-gray-600 group-hover:text-gray-300 transition-colors">
                chevron_right
              </span>
            </button>

            {guest && (
              <button
                onClick={() => login(guest.id)}
                className="w-full text-left p-4 rounded-xl border border-[#2A2A2A] hover:border-primary/50 hover:bg-[#2A2A2A] transition-colors flex items-center gap-4 group"
              >
                <div className="w-11 h-11 rounded-lg bg-[#2A2A2A] border border-[#333] flex items-center justify-center shrink-0 text-[20px]">
                  👋
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm">I&rsquo;m visiting</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Use an instrument or borrow something
                  </div>
                </div>
                <span className="material-symbols-outlined text-gray-600 group-hover:text-gray-300 transition-colors">
                  chevron_right
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="w-full">
            <button
              onClick={() => setMode('choose')}
              className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-white mb-4 -mt-2 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              Back
            </button>

            <div className="space-y-2">
              {[...admins, ...labMembers].map((u) => {
                const needsPin = u.role === 'pi' || u.role === 'procurement_incharge';
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      if (needsPin) {
                        setSelectedAdmin(u);
                        setPin('');
                      } else {
                        login(u.id);
                      }
                    }}
                    className="w-full text-left p-3 rounded-lg border border-[#2A2A2A] hover:border-primary/50 hover:bg-[#2A2A2A] transition-colors flex items-center gap-3"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] ${avatarClasses(u.accent)}`}
                    >
                      {initialOf(u.name, u.handle)}
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">{u.name}</div>
                      <div className="text-xs text-gray-400">
                        {roleLabel(u.role, u.handle)}
                        {needsPin && ' · PIN required'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
