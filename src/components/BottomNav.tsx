import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { TabType } from '../types';

const NAV_ITEMS: { id: TabType; label: string; icon: string }[] = [
  { id: 'home', label: 'Feed', icon: 'forum' },
  { id: 'inventory', label: 'Inventory', icon: 'inventory_2' },
  { id: 'activity', label: 'Activity', icon: 'history' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'profile', label: 'Profile', icon: 'account_circle' },
];

export const BottomNav: React.FC = () => {
  const { inventoryItems } = useApp();
  const { activeTab, setActiveTab } = useUI();

  const lowStockCount = useMemo(
    () => inventoryItems.filter((i) => i.lowStockThreshold != null && i.quantity <= i.lowStockThreshold).length,
    [inventoryItems]
  );

  const { unreadActivityCount } = useApp();

  return (
    <nav className="safe-bottom-fixed fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-[72px] glass-nav md:hidden">
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        const badge =
          item.id === 'inventory' && lowStockCount > 0
            ? lowStockCount
            : item.id === 'activity' && unreadActivityCount > 0
              ? unreadActivityCount
              : 0;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center w-1/5 h-full gap-1 pt-2 transition-colors ${
              isActive ? 'text-primary' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <div className={`relative p-1.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10' : ''}`}>
              <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
              {badge > 0 && (
                <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-bold ${
                  item.id === 'activity' ? 'bg-primary text-white' : 'bg-amber-500 text-black'
                }`}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] tracking-wider uppercase ${isActive ? 'font-bold' : 'font-semibold'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
