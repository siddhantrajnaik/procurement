import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import confetti from 'canvas-confetti';
import * as api from '../lib/api';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Activity,
  InventoryItem,
  InventoryLogEntry,
  NewInventoryItemInput,
  NewPurchaseInput,
  NewQuotationInput,
  Purchase,
  PurchaseStatus,
  Quotation,
  TabType,
  User,
} from '../types';

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastInfo {
  id: string;
  message: string;
  type: ToastType;
}

interface AppContextType {
  purchases: Purchase[];
  activities: Activity[];
  allUsers: User[];
  currentUser: User | null;
  isLoading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;

  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  selectedPurchase: Purchase | null;
  setSelectedPurchase: (p: Purchase | null) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;

  toast: ToastInfo | null;
  showToast: (msg: string, type?: ToastType) => void;

  isAuthenticated: boolean;
  login: (userId: string) => void;
  logout: () => void;
  verifyAdminPin: (pin: string) => Promise<boolean>;

  editingPurchase: Purchase | null;
  setEditingPurchase: (p: Purchase | null) => void;

  createPurchase: (data: NewPurchaseInput) => Promise<void>;
  editPurchase: (purchaseId: string, updates: Partial<NewPurchaseInput>) => Promise<void>;
  updateStatus: (purchaseId: string, status: PurchaseStatus) => Promise<void>;
  addComment: (purchaseId: string, body: string) => Promise<void>;
  addQuotation: (purchaseId: string, input: NewQuotationInput) => Promise<void>;
  selectQuotation: (purchaseId: string, quotation: Quotation) => Promise<void>;
  approvePi: (purchaseId: string) => Promise<void>;
  deletePurchase: (purchaseId: string) => Promise<void>;

  inventoryItems: InventoryItem[];
  inventoryLog: InventoryLogEntry[];
  addInventoryItem: (input: NewInventoryItemInput) => Promise<void>;
  consumeItem: (item: InventoryItem, quantity: number, notes?: string) => Promise<void>;
  restockItem: (item: InventoryItem, quantity: number, notes?: string) => Promise<void>;
  moveItem: (item: InventoryItem, newLocation: string, notes?: string) => Promise<void>;
  editInventoryItem: (item: InventoryItem, updates: Partial<Pick<NewInventoryItemInput, 'name' | 'category' | 'quantity' | 'unit' | 'location' | 'lowStockThreshold' | 'notes'>>) => Promise<void>;
  removeInventoryItem: (item: InventoryItem) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SESSION_USER_KEY = 'procure.session.userId';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLog, setInventoryLog] = useState<InventoryLogEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    localStorage.getItem(SESSION_USER_KEY)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [toast, setToast] = useState<ToastInfo | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ id: `${Date.now()}`, message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoadError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      setIsLoading(false);
      return;
    }
    try {
      const [users, rows, acts] = await Promise.all([
        api.fetchUsers(),
        api.fetchPurchases(),
        api.fetchActivities(),
      ]);
      setAllUsers(users);
      setPurchases(rows);
      setActivities(acts);
      setLoadError(null);

      // Inventory tables may not exist yet; fetch them non-fatally.
      try {
        const [items, logs] = await Promise.all([
          api.fetchInventoryItems(),
          api.fetchInventoryLog(),
        ]);
        setInventoryItems(items);
        setInventoryLog(logs);
      } catch {
        // Tables not created yet — keep empty defaults.
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load lab data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Any write from any device touches one of these tables; refetching the whole
  // (small) working set is simpler and less bug-prone than patching rows locally.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let pending: ReturnType<typeof setTimeout> | null = null;
    const refetch = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => { void reload(); }, 250);
    };

    const channel = supabase
      .channel('procurement-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_log' }, refetch)
      .subscribe();

    return () => {
      if (pending) clearTimeout(pending);
      void supabase.removeChannel(channel);
    };
  }, [reload]);

  const currentUser = useMemo(
    () => allUsers.find((u) => u.id === currentUserId) ?? null,
    [allUsers, currentUserId]
  );

  const selectedPurchase = useMemo(
    () => purchases.find((p) => p.id === selectedPurchaseId) ?? null,
    [purchases, selectedPurchaseId]
  );

  const setSelectedPurchase = useCallback((p: Purchase | null) => {
    setSelectedPurchaseId(p?.id ?? null);
  }, []);

  const editingPurchase = useMemo(
    () => purchases.find((p) => p.id === editingPurchaseId) ?? null,
    [purchases, editingPurchaseId]
  );

  const setEditingPurchase = useCallback((p: Purchase | null) => {
    setEditingPurchaseId(p?.id ?? null);
  }, []);

  const login = useCallback((userId: string) => {
    localStorage.setItem(SESSION_USER_KEY, userId);
    setCurrentUserId(userId);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_USER_KEY);
    setCurrentUserId(null);
    setActiveTab('home');
    setSelectedPurchaseId(null);
  }, []);

  // Wraps a write so failures surface as a toast instead of an unhandled rejection.
  const run = useCallback(
    async (action: () => Promise<void>, fallbackMessage: string) => {
      try {
        await action();
        await reload();
      } catch (err) {
        showToast(err instanceof Error ? err.message : fallbackMessage, 'error');
      }
    },
    [reload, showToast]
  );

  const requireUser = useCallback((): User | null => {
    if (!currentUser) {
      showToast('Your session expired. Please sign in again.', 'error');
      return null;
    }
    return currentUser;
  }, [currentUser, showToast]);

  const findPurchase = useCallback(
    (id: string) => purchases.find((p) => p.id === id) ?? null,
    [purchases]
  );

  const createPurchase = useCallback(
    async (data: NewPurchaseInput) => {
      const actor = requireUser();
      if (!actor) return;
      await run(async () => {
        const created = await api.createPurchase(data, actor);
        showToast(`Requested "${created.title}".`, 'success');
      }, 'Could not create the request.');
    },
    [requireUser, run, showToast]
  );

  const editPurchase = useCallback(
    async (purchaseId: string, updates: Partial<NewPurchaseInput>) => {
      const actor = requireUser();
      const purchase = findPurchase(purchaseId);
      if (!actor || !purchase) return;
      await run(async () => {
        await api.updatePurchaseFields(purchaseId, updates);
        showToast(`Updated "${updates.title ?? purchase.title}".`, 'success');
        setEditingPurchaseId(null);
      }, 'Could not update the request.');
    },
    [requireUser, findPurchase, run, showToast]
  );

  const updateStatus = useCallback(
    async (purchaseId: string, status: PurchaseStatus) => {
      const actor = requireUser();
      const purchase = findPurchase(purchaseId);
      if (!actor || !purchase) return;
      await run(async () => {
        await api.updatePurchaseStatus(purchase, status, actor);
        if (status === 'delivered') {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
          showToast(`"${purchase.title}" marked as delivered.`, 'success');
        } else {
          showToast(`Status set to ${api.STATUS_LABELS[status]}.`, 'info');
        }
      }, 'Could not update the status.');
    },
    [findPurchase, requireUser, run, showToast]
  );

  const addComment = useCallback(
    async (purchaseId: string, body: string) => {
      const actor = requireUser();
      const purchase = findPurchase(purchaseId);
      if (!actor || !purchase) return;
      await run(() => api.addComment(purchase, body, actor), 'Could not post the reply.');
    },
    [findPurchase, requireUser, run]
  );

  const addQuotation = useCallback(
    async (purchaseId: string, input: NewQuotationInput) => {
      const actor = requireUser();
      const purchase = findPurchase(purchaseId);
      if (!actor || !purchase) return;
      await run(async () => {
        await api.addQuotation(purchase, input, actor);
        showToast(`Quotation from ${input.vendor} added.`, 'success');
      }, 'Could not add the quotation.');
    },
    [findPurchase, requireUser, run, showToast]
  );

  const selectQuotation = useCallback(
    async (purchaseId: string, quotation: Quotation) => {
      const actor = requireUser();
      const purchase = findPurchase(purchaseId);
      if (!actor || !purchase) return;
      await run(async () => {
        await api.selectQuotation(purchase, quotation, actor);
        showToast(`${quotation.vendor} selected for the purchase order.`, 'success');
      }, 'Could not select the quotation.');
    },
    [findPurchase, requireUser, run, showToast]
  );

  const approvePi = useCallback(
    async (purchaseId: string) => {
      const actor = requireUser();
      const purchase = findPurchase(purchaseId);
      if (!actor || !purchase) return;
      await run(async () => {
        await api.approvePi(purchase, actor);
        showToast('Expenditure approved.', 'success');
      }, 'Could not record the approval.');
    },
    [findPurchase, requireUser, run, showToast]
  );

  const deletePurchase = useCallback(
    async (purchaseId: string) => {
      const purchase = findPurchase(purchaseId);
      if (!purchase) return;
      await run(async () => {
        await api.deletePurchase(purchaseId);
        if (selectedPurchaseId === purchaseId) setSelectedPurchaseId(null);
        showToast(`Deleted "${purchase.title}".`, 'warning');
      }, 'Could not delete the request.');
    },
    [findPurchase, run, selectedPurchaseId, showToast]
  );

  const addInventoryItem = useCallback(
    async (input: NewInventoryItemInput) => {
      const actor = requireUser();
      if (!actor) return;
      await run(async () => {
        const created = await api.addInventoryItem(input, actor);
        showToast(`Added "${created.name}" to inventory.`, 'success');
      }, 'Could not add the item.');
    },
    [requireUser, run, showToast]
  );

  const consumeItem = useCallback(
    async (item: InventoryItem, quantity: number, notes?: string) => {
      const actor = requireUser();
      if (!actor) return;
      await run(async () => {
        await api.consumeInventoryItem(item, quantity, actor, notes);
        showToast(`Used ${quantity} ${item.unit} of "${item.name}".`, 'info');
      }, 'Could not record usage.');
    },
    [requireUser, run, showToast]
  );

  const restockItem = useCallback(
    async (item: InventoryItem, quantity: number, notes?: string) => {
      const actor = requireUser();
      if (!actor) return;
      await run(async () => {
        await api.restockInventoryItem(item, quantity, actor, notes);
        showToast(`Restocked ${quantity} ${item.unit} of "${item.name}".`, 'success');
      }, 'Could not record restock.');
    },
    [requireUser, run, showToast]
  );

  const moveItem = useCallback(
    async (item: InventoryItem, newLocation: string, notes?: string) => {
      const actor = requireUser();
      if (!actor) return;
      await run(async () => {
        await api.moveInventoryItem(item, newLocation, actor, notes);
        showToast(`Moved "${item.name}" to ${newLocation}.`, 'info');
      }, 'Could not move the item.');
    },
    [requireUser, run, showToast]
  );

  const editInventoryItem = useCallback(
    async (item: InventoryItem, updates: Partial<Pick<NewInventoryItemInput, 'name' | 'category' | 'quantity' | 'unit' | 'location' | 'lowStockThreshold' | 'notes'>>) => {
      const actor = requireUser();
      if (!actor) return;
      await run(async () => {
        await api.updateInventoryItem(item, updates, actor);
        showToast(`Updated "${updates.name ?? item.name}".`, 'success');
      }, 'Could not update the item.');
    },
    [requireUser, run, showToast]
  );

  const removeInventoryItem = useCallback(
    async (item: InventoryItem) => {
      const actor = requireUser();
      if (!actor) return;
      await run(async () => {
        await api.deleteInventoryItem(item.id, item.name, actor);
        showToast(`Removed "${item.name}" from inventory.`, 'warning');
      }, 'Could not remove the item.');
    },
    [requireUser, run, showToast]
  );

  const value: AppContextType = {
    purchases,
    activities,
    allUsers,
    currentUser,
    isLoading,
    loadError,
    reload,
    activeTab,
    setActiveTab,
    selectedPurchase,
    setSelectedPurchase,
    isCreateModalOpen,
    setIsCreateModalOpen,
    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    toast,
    showToast,
    isAuthenticated: currentUser !== null,
    login,
    logout,
    verifyAdminPin: api.verifyAdminPin,
    editingPurchase,
    setEditingPurchase,
    createPurchase,
    editPurchase,
    updateStatus,
    addComment,
    addQuotation,
    selectQuotation,
    approvePi,
    deletePurchase,
    inventoryItems,
    inventoryLog,
    addInventoryItem,
    consumeItem,
    restockItem,
    moveItem,
    editInventoryItem,
    removeInventoryItem,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
