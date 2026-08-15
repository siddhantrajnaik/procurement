import { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ActivityType } from '../types';
import { avatarClasses } from '../lib/accent';
import { initialOf, timeAgo } from '../lib/format';
import {
  FileText,
  ShoppingCart,
  MessageSquare,
  PlusCircle,
  ShieldCheck,
  Clock,
  UserPlus,
  Package,
} from 'lucide-react';

const ICONS: Record<ActivityType, React.ReactNode> = {
  created: <PlusCircle className="w-4 h-4 text-blue-400" />,
  quote_added: <FileText className="w-4 h-4 text-purple-400" />,
  status_changed: <ShoppingCart className="w-4 h-4 text-indigo-400" />,
  comment_added: <MessageSquare className="w-4 h-4 text-emerald-400" />,
  pi_approved: <ShieldCheck className="w-4 h-4 text-amber-400" />,
  assigned: <UserPlus className="w-4 h-4 text-gray-400" />,
  delivery_recorded: <Package className="w-4 h-4 text-amber-400" />,
};

export const ActivityView: React.FC = () => {
  const { activities, purchases, setSelectedPurchase, markActivitiesRead } = useApp();

  useEffect(() => {
    markActivitiesRead();
  }, [markActivitiesRead]);

  return (
    <div className="flex-1 flex flex-col pb-28 pt-4 max-w-3xl mx-auto w-full px-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-extrabold text-white text-lg tracking-tight">Lab activity</h1>
          <p className="text-xs text-gray-400">Audit trail of every procurement action</p>
        </div>
        {activities.length > 0 && (
          <span className="text-xs font-semibold text-gray-500 bg-[#1E1E1E] border border-[#2A2A2A] px-2.5 py-1 rounded-full">
            {activities.length} events
          </span>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E] py-16 text-center">
          <Clock className="w-6 h-6 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {activities.map((act) => {
            const target = purchases.find((p) => p.id === act.purchaseId);
            return (
              <button
                key={act.id}
                onClick={() => target && setSelectedPurchase(target)}
                disabled={!target}
                className="w-full text-left bg-[#1E1E1E] border border-[#2A2A2A] p-3.5 rounded-xl flex items-start gap-3 transition-colors hover:border-primary/40 disabled:cursor-default disabled:hover:border-[#2A2A2A]"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${avatarClasses(act.actor?.accent)}`}
                >
                  {initialOf(act.actor?.name ?? '?', act.actor?.handle)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs text-gray-200 leading-snug">
                      <strong className="font-bold text-white">
                        {act.actor?.name ?? 'Someone'}
                      </strong>{' '}
                      <span className="text-gray-400">{act.details}</span>
                    </p>
                    <span className="text-[10px] text-gray-500 shrink-0 font-medium">
                      {timeAgo(act.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold text-gray-200 bg-background p-1.5 rounded-lg border border-[#2A2A2A]">
                    {ICONS[act.type]}
                    <span className="truncate">{act.purchaseTitle}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
