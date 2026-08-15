import { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UIProvider, useUI } from './context/UIContext';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeFeed } from './components/HomeFeed';
import { SearchView } from './components/SearchView';
import { ActivityView } from './components/ActivityView';
import { ProfileView } from './components/ProfileView';
import { InventoryView } from './components/InventoryView';
import { PurchaseThreadModal } from './components/PurchaseThreadModal';
import { CreatePurchaseModal } from './components/CreatePurchaseModal';
import { EditPurchaseModal } from './components/EditPurchaseModal';
import { AddInventoryItemModal } from './components/AddInventoryItemModal';
import { NotificationToast } from './components/NotificationToast';
import { LoginScreen } from './components/LoginScreen';
import { ScrollLock } from './lib/useScrollLock';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-[24px] animate-pulse">biotech</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 rounded-full border-2 border-[#2A2A2A] border-t-primary animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Loading lab data…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-6 text-center space-y-4">
        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-red-400 text-[20px]">cloud_off</span>
        </div>
        <div>
          <h1 className="font-bold text-white mb-1">Can't reach the database</h1>
          <p className="text-xs text-gray-400 break-words">{message}</p>
        </div>
        <button
          onClick={onRetry}
          className="w-full py-2.5 bg-primary text-white rounded-md font-medium text-sm hover:bg-orange-600 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function DeliveryInventoryPrompt() {
  const { pendingDeliveryPurchase, clearPendingDelivery } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!pendingDeliveryPurchase || showAddModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearPendingDelivery();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pendingDeliveryPurchase, showAddModal, clearPendingDelivery]);

  if (!pendingDeliveryPurchase && !showAddModal) return null;

  const p = pendingDeliveryPurchase;

  const prefill = p
    ? {
        name: p.title,
        category: p.category,
        quantity: String(parseInt(p.quantity) || 1),
        notes: p.preferredCompany ? `Vendor: ${p.preferredCompany}` : undefined,
      }
    : null;

  if (showAddModal) {
    return (
      <AddInventoryItemModal
        open
        onClose={() => {
          setShowAddModal(false);
          clearPendingDelivery();
        }}
        editItem={null}
        prefill={prefill}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <ScrollLock />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay" onClick={clearPendingDelivery} />
      <div className="relative w-full max-w-xs bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 shadow-2xl text-center space-y-4 animate-sheet">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-emerald-400 text-[20px]">inventory_2</span>
        </div>
        <div>
          <h3 className="font-bold text-white text-base mb-1">Item delivered!</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            <strong className="text-gray-200">{p!.title}</strong> has arrived. Add it to your inventory so you can track stock and location?
          </p>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={clearPendingDelivery}
            className="flex-1 py-2.5 text-sm font-medium text-gray-300 bg-[#2A2A2A] rounded-md hover:bg-[#333] transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-orange-600 transition-colors"
          >
            Add to inventory
          </button>
        </div>
      </div>
    </div>
  );
}

const TAB_TITLES: Record<string, string> = {
  home: 'Feed',
  inventory: 'Inventory',
  search: 'Search',
  activity: 'Activity',
  profile: 'Profile',
};

function AppContent() {
  const { isAuthenticated } = useAuth();
  const { activeTab, tabResetNonce, setIsCreateModalOpen } = useUI();
  const { isLoading, loadError, reload } = useApp();

  useEffect(() => {
    document.title = `${TAB_TITLES[activeTab] ?? 'MB Lab'} - MB Lab Procurement`;
    window.scrollTo(0, 0);
  }, [activeTab]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && activeTab !== 'inventory') {
        e.preventDefault();
        setIsCreateModalOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isAuthenticated, activeTab, setIsCreateModalOpen]);

  if (isLoading) return <LoadingScreen />;
  if (loadError) return <ErrorScreen message={loadError} onRetry={() => void reload()} />;
  if (!isAuthenticated) return <LoginScreen />;

  return (
    <div className="min-h-screen bg-background text-gray-100 flex flex-col font-sans selection:bg-primary selection:text-white pb-12 md:pb-0">
      <Header />

      {/* The nonce remounts the tab when its own nav button is tapped, so a
          deep sub-view (Profile → Notebook → a page) returns to the tab root. */}
      <main className="flex-1 flex flex-col animate-fade-in" key={`${activeTab}-${tabResetNonce}`}>
        {activeTab === 'home' && <HomeFeed />}
        {activeTab === 'inventory' && <InventoryView />}
        {activeTab === 'search' && <SearchView />}
        {activeTab === 'activity' && <ActivityView />}
        {activeTab === 'profile' && <ProfileView />}
      </main>

      <PurchaseThreadModal />
      <CreatePurchaseModal />
      <EditPurchaseModal />
      <DeliveryInventoryPrompt />
      <NotificationToast />
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    // reducedMotion="user" makes every spring and slide respect the OS setting.
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <UIProvider>
          <AppProvider>
            <AppContent />
          </AppProvider>
        </UIProvider>
      </AuthProvider>
    </MotionConfig>
  );
}
