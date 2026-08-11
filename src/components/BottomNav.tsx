import { useApp } from '../context/AppContext';
import { TabType } from '../types';

const NAV_ITEMS: { id: TabType; label: string; icon: string }[] = [
  { id: 'home', label: 'Feed', icon: 'forum' },
  { id: 'inventory', label: 'Inventory', icon: 'inventory_2' },
  { id: 'activity', label: 'Activity', icon: 'history' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'profile', label: 'Profile', icon: 'account_circle' },
];

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-[72px] glass-nav pb-2 md:hidden">
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center w-1/5 h-full gap-1 pt-2 transition-colors ${
              isActive ? 'text-primary' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10' : ''}`}>
              <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
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
