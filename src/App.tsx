import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeFeed } from './components/HomeFeed';
import { SearchView } from './components/SearchView';
import { ActivityView } from './components/ActivityView';
import { ProfileView } from './components/ProfileView';
import { PurchaseThreadModal } from './components/PurchaseThreadModal';
import { CreatePurchaseModal } from './components/CreatePurchaseModal';
import { NotificationToast } from './components/NotificationToast';
import { LoginScreen } from './components/LoginScreen';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-[#2A2A2A] border-t-primary animate-spin" />
      <p className="text-sm text-gray-400">Loading lab data…</p>
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

function AppContent() {
  const { activeTab, isAuthenticated, isLoading, loadError, reload } = useApp();

  if (isLoading) return <LoadingScreen />;
  if (loadError) return <ErrorScreen message={loadError} onRetry={() => void reload()} />;
  if (!isAuthenticated) return <LoginScreen />;

  return (
    <div className="min-h-screen bg-background text-gray-100 flex flex-col font-sans selection:bg-primary selection:text-white pb-12 md:pb-0">
      <Header />

      <main className="flex-1 flex flex-col">
        {activeTab === 'home' && <HomeFeed />}
        {activeTab === 'search' && <SearchView />}
        {activeTab === 'activity' && <ActivityView />}
        {activeTab === 'profile' && <ProfileView />}
      </main>

      <PurchaseThreadModal />
      <CreatePurchaseModal />
      <NotificationToast />
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
