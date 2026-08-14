import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { avatarClasses } from '../lib/accent';
import { initialOf, roleLabel } from '../lib/format';
import { User } from '../types';

export const LoginScreen: React.FC = () => {
  const { allUsers, login, verifyAdminPin } = useAuth();
  const { showToast } = useUI();
  const [selectedAdmin, setSelectedAdmin] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const admins = allUsers.filter((u) => u.role === 'pi' || u.role === 'procurement_incharge');
  const labMembers = allUsers.filter((u) => u.role === 'lab_member');

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
            {initialOf(selectedAdmin.name)}
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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 py-12">
      <div className="w-full max-w-md bg-[#1E1E1E] rounded-xl p-8 shadow-sm border border-[#2A2A2A] flex flex-col items-center">
        <div className="w-12 h-12 rounded bg-primary flex items-center justify-center mb-5">
          <span className="material-symbols-outlined text-white text-[28px]">biotech</span>
        </div>
        <h1 className="font-bold text-2xl text-white mb-2 tracking-tight">MB Lab Procurement</h1>
        <p className="text-gray-400 text-sm mb-8 text-center max-w-xs">
          Sign in to manage and track laboratory purchases.
        </p>

        {allUsers.length === 0 && (
          <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-6 text-center">
            No lab members found. Run the database migration to seed the profiles table.
          </p>
        )}

        <div className="w-full space-y-8">
          {admins.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1 border-b border-[#2A2A2A] pb-2">
                Admin access
              </h2>
              <div className="space-y-2">
                {admins.map((admin) => (
                  <button
                    key={admin.id}
                    onClick={() => {
                      setSelectedAdmin(admin);
                      setPin('');
                    }}
                    className="w-full text-left p-3 rounded-lg border border-[#2A2A2A] hover:border-primary/50 hover:bg-[#2A2A2A] transition-colors flex items-center gap-3"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] ${avatarClasses(admin.accent)}`}
                    >
                      {initialOf(admin.name)}
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">{admin.name}</div>
                      <div className="text-xs text-gray-400">{roleLabel(admin.role, admin.handle)} · PIN required</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {labMembers.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1 border-b border-[#2A2A2A] pb-2">
                Lab members
              </h2>
              <div className="space-y-2">
                {labMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => login(member.id)}
                    className="w-full text-left p-3 rounded-lg border border-[#2A2A2A] hover:border-primary/50 hover:bg-[#2A2A2A] transition-colors flex items-center gap-3"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] ${avatarClasses(member.accent)}`}
                    >
                      {initialOf(member.name)}
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">{member.name}</div>
                      <div className="text-xs text-gray-400">{roleLabel(member.role, member.handle)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
