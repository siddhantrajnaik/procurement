import { useApp } from '../context/AppContext';
import { avatarClasses } from '../lib/accent';
import { formatRupees, initialOf, roleLabel } from '../lib/format';
import { UserCheck, Building } from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { currentUser, allUsers, login, purchases } = useApp();

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

  if (!currentUser) return null;

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
      </div>

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
          {allUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => login(u.id)}
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
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
