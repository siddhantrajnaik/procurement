import { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GuestApp } from './components/guest/GuestApp';
import { PIApp } from './components/pi/PIApp';
import { LaunchScreen, useLaunchLink } from './components/launch/LaunchScreen';
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
      <div className="relative w-full max-w-xs bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 shadow-2xl text-center space-y-4 animate-pop">
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
  const { isAuthenticated, currentUser } = useAuth();
  const { activeTab, tabResetNonce, setIsCreateModalOpen } = useUI();
  const { isLoading, loadError, reload } = useApp();

  const showLaunch = useLaunchLink();

  // The tab list belongs to the lab member's shell. Guests and the PI never see
  // it, so naming their tab after a tab they do not have just leaves whichever
  // title happened to be set last sitting in the title bar.
  const role = currentUser?.role;
  useEffect(() => {
    // The ceremony is named here rather than inside the launch screen: this
    // effect belongs to the parent, so it runs after the child's and would
    // otherwise put "Feed" in the tab on the projector.
    if (showLaunch) {
      document.title = 'MB Lab';
      return;
    }
    const label =
      role === 'guest' ? 'Visiting'
      : role === 'pi' ? 'Lab overview'
      : TAB_TITLES[activeTab] ?? 'MB Lab';
    document.title = `${label} - MB Lab`;
    window.scrollTo(0, 0);
  }, [activeTab, role, showLaunch]);

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

  // Above every gate below, on purpose. The opening ceremony runs once, live, on
  // a projector — if Supabase is slow or unreachable in that room, the checks
  // that follow would put a spinner or an error screen on the wall instead. It
  // reads no data, so there is nothing for it to wait on. Delete this and the
  // launch/ folder once the event is over.
  if (showLaunch) return <LaunchScreen />;

  if (isLoading) return <LoadingScreen />;
  if (loadError) return <ErrorScreen message={loadError} onRetry={() => void reload()} />;
  if (!isAuthenticated) return <LoginScreen />;

  // Visiting researchers get their own shell. Nothing below this line — no feed,
  // no search, no profile, no purchase modals — is ever mounted for them, which
  // is the point: hiding money from the normal shell would mean patching prices
  // on cards, a rupee total on the profile page, and amounts embedded in
  // activity strings, and any component added later would leak again by default.
  if (currentUser?.role === 'guest') return <GuestApp />;

  // The PI sees spend as totals and how the lab is being used — nothing else. A
  // separate shell for the same reason as the guest one: the procurement surface
  // itemises money in a dozen places, and she is to see totals only.
  if (currentUser?.role === 'pi') return <PIApp />;

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
