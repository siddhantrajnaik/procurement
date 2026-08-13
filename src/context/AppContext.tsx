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
  BookableItem,
  Booking,
  Equipment,
  EquipmentStatus,
  InventoryItem,
  InventoryLogEntry,
  IssueStatus,
  LabList,
  ListColumn,
  LostFoundItem,
  LostFoundStatus,
  NewBookableItemInput,
  NewBookingInput,
  NewEquipmentInput,
  NewInventoryItemInput,
  NewIssueInput,
  NewListInput,
  NewListItemInput,
  NewLostFoundInput,
  NewMaintenanceInput,
  NewPurchaseInput,
  NewQuotationInput,
  NewVendorInput,
  Purchase,
  PurchaseStatus,
  Quotation,
  TabType,
  User,
  Vendor,
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

  pendingDeliveryPurchase: Purchase | null;
  clearPendingDelivery: () => void;

  createPurchase: (data: NewPurchaseInput) => Promise<void>;
  editPurchase: (purchaseId: string, updates: Partial<NewPurchaseInput>) => Promise<void>;
  updateStatus: (purchaseId: string, status: PurchaseStatus) => Promise<void>;
  addComment: (purchaseId: string, body: string) => Promise<void>;
  addQuotation: (purchaseId: string, input: NewQuotationInput) => Promise<void>;
  selectQuotation: (purchaseId: string, quotation: Quotation) => Promise<void>;
  approvePi: (purchaseId: string) => Promise<void>;
  deletePurchase: (purchaseId: string) => Promise<void>;
  uploadInvoice: (purchaseId: string, file: File) => Promise<void>;
  removeInvoice: (purchaseId: string) => Promise<void>;

  inventoryItems: InventoryItem[];
  inventoryLog: InventoryLogEntry[];
  addInventoryItem: (input: NewInventoryItemInput) => Promise<void>;
  consumeItem: (item: InventoryItem, quantity: number, notes?: string) => Promise<void>;
  restockItem: (item: InventoryItem, quantity: number, notes?: string) => Promise<void>;
  moveItem: (item: InventoryItem, newLocation: string, notes?: string) => Promise<void>;
  editInventoryItem: (item: InventoryItem, updates: Partial<Pick<NewInventoryItemInput, 'name' | 'category' | 'quantity' | 'unit' | 'location' | 'lowStockThreshold' | 'notes'>>) => Promise<void>;
  removeInventoryItem: (item: InventoryItem) => Promise<void>;

  vendors: Vendor[];
  addVendor: (input: NewVendorInput) => Promise<void>;
  editVendor: (vendorId: string, updates: Partial<NewVendorInput>) => Promise<void>;
  removeVendor: (vendorId: string) => Promise<void>;

  lostFoundItems: LostFoundItem[];
  reportLostItem: (input: NewLostFoundInput) => Promise<void>;
  addLostFoundResponse: (itemId: string, body: string) => Promise<void>;
  updateLostFoundStatus: (itemId: string, status: LostFoundStatus) => Promise<void>;
  removeLostFoundItem: (itemId: string) => Promise<void>;

  labLists: LabList[];
  createLabList: (input: NewListInput) => Promise<void>;
  updateLabList: (listId: string, updates: { title?: string; description?: string; columns?: ListColumn[] }) => Promise<void>;
  removeLabList: (listId: string) => Promise<void>;
  addListItem: (listId: string, input: NewListItemInput) => Promise<void>;
  updateListItem: (itemId: string, updates: { name?: string; checked?: boolean; data?: Record<string, unknown> }) => Promise<void>;
  removeListItem: (itemId: string) => Promise<void>;

  equipment: Equipment[];
  addEquipment: (input: NewEquipmentInput) => Promise<void>;
  editEquipment: (equipmentId: string, updates: Partial<NewEquipmentInput> & { status?: EquipmentStatus }) => Promise<void>;
  removeEquipment: (equipmentId: string) => Promise<void>;
  reportIssue: (equipmentId: string, input: NewIssueInput) => Promise<void>;
  updateIssueStatus: (issueId: string, status: IssueStatus, fixSummary?: string, fixedBy?: string, fixCost?: number) => Promise<void>;
  addIssueResponse: (issueId: string, body: string) => Promise<void>;
  addMaintenanceLog: (equipmentId: string, input: NewMaintenanceInput) => Promise<void>;

  bookableItems: BookableItem[];
  bookings: Booking[];
  addBookableItem: (input: NewBookableItemInput) => Promise<void>;
  removeBookableItem: (itemId: string) => Promise<void>;
  createBooking: (input: NewBookingInput) => Promise<void>;
  cancelBooking: (bookingId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SESSION_USER_KEY = 'procure.session.userId';

function dedup<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLog, setInventoryLog] = useState<InventoryLogEntry[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [lostFoundItems, setLostFoundItems] = useState<LostFoundItem[]>([]);
  const [labLists, setLabLists] = useState<LabList[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [bookableItems, setBookableItems] = useState<BookableItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
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
  const [pendingDeliveryPurchaseId, setPendingDeliveryPurchaseId] = useState<string | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ id: `${Date.now()}`, message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
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
      setAllUsers(dedup(users));
      setPurchases(dedup(rows));
      setActivities(dedup(acts));
      setLoadError(null);

      try {
        const [items, logs] = await Promise.all([
          api.fetchInventoryItems(),
          api.fetchInventoryLog(),
        ]);
        setInventoryItems(dedup(items));
        setInventoryLog(dedup(logs));
      } catch {
        // Tables not created yet — keep empty defaults.
      }

      try {
        const v = await api.fetchVendors();
        setVendors(dedup(v));
      } catch {
        // Table not created yet — keep empty default.
      }

      try {
        const lf = await api.fetchLostFoundItems();
        setLostFoundItems(dedup(lf));
      } catch {
        // Table not created yet — keep empty default.
      }

      try {
        const ll = await api.fetchLists();
        setLabLists(dedup(ll));
      } catch {
        // Table not created yet — keep empty default.
      }

      try {
        const eq = await api.fetchEquipment();
        setEquipment(dedup(eq));
      } catch {
        // Table not created yet — keep empty default.
      }

      try {
        const [bi, bk] = await Promise.all([
          api.fetchBookableItems(),
          api.fetchBookings(),
        ]);
        setBookableItems(dedup(bi));
        setBookings(dedup(bk));
      } catch {
        // Table not created yet — keep empty default.
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_found_items' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_found_responses' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_issues' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issue_responses' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_logs' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookable_items' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, refetch)
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

  const pendingDeliveryPurchase = useMemo(
    () => purchases.find((p) => p.id === pendingDeliveryPurchaseId) ?? null,
    [purchases, pendingDeliveryPurchaseId]
  );

  const clearPendingDelivery = useCallback(() => {
    setPendingDeliveryPurchaseId(null);
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
          setPendingDeliveryPurchaseId(purchaseId);
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

  const uploadInvoice = useCallback(
    async (purchaseId: string, file: File) => {
      const actor = requireUser();
      const purchase = findPurchase(purchaseId);
      if (!actor || !purchase) return;
      await run(async () => {
        const { compressImage } = await import('../lib/compress');
        const result = await compressImage(file);
        await api.uploadInvoice(purchase, result.file, actor);
        if (result.skipped) {
          showToast('Invoice attached.', 'success');
        } else {
          const saved = Math.round((1 - result.compressedSize / result.originalSize) * 100);
          showToast(`Invoice attached — compressed ${saved}% smaller.`, 'success');
        }
      }, 'Could not attach the invoice.');
    },
    [findPurchase, requireUser, run, showToast]
  );

  const removeInvoice = useCallback(
    async (purchaseId: string) => {
      const purchase = findPurchase(purchaseId);
      if (!purchase) return;
      await run(async () => {
        await api.removeInvoice(purchase);
        showToast('Invoice removed.', 'warning');
      }, 'Could not remove the invoice.');
    },
    [findPurchase, run, showToast]
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

  const addVendor = useCallback(
    async (input: NewVendorInput) => {
      const actor = requireUser();
      if (!actor) return;
      await run(async () => {
        const created = await api.addVendor(input, actor);
        showToast(`Added vendor "${created.name}".`, 'success');
      }, 'Could not add the vendor.');
    },
    [requireUser, run, showToast]
  );

  const editVendor = useCallback(
    async (vendorId: string, updates: Partial<NewVendorInput>) => {
      await run(async () => {
        await api.updateVendor(vendorId, updates);
        showToast(`Vendor updated.`, 'success');
      }, 'Could not update the vendor.');
    },
    [run, showToast]
  );

  const removeVendor = useCallback(
    async (vendorId: string) => {
      const vendor = vendors.find((v) => v.id === vendorId);
      await run(async () => {
        await api.deleteVendor(vendorId);
        showToast(`Removed "${vendor?.name ?? 'vendor'}".`, 'warning');
      }, 'Could not remove the vendor.');
    },
    [vendors, run, showToast]
  );

  const reportLostItem = useCallback(
    async (input: NewLostFoundInput) => {
      const actor = requireUser();
      if (!actor) return;
      await run(async () => {
        await api.reportLostItem(input, actor);
        showToast(`Reported "${input.title}" as lost.`, 'success');
      }, 'Could not report the item.');
    },
    [requireUser, run, showToast]
  );

  const addLostFoundResponse = useCallback(
    async (itemId: string, body: string) => {
      const actor = requireUser();
      if (!actor) return;
      await run(() => api.addLostFoundResponse(itemId, body, actor), 'Could not post the response.');
    },
    [requireUser, run]
  );

  const updateLostFoundStatus = useCallback(
    async (itemId: string, status: LostFoundStatus) => {
      const actor = requireUser();
      if (!actor) return;
      const label = status === 'found' ? 'found' : status === 'resolved' ? 'resolved' : 'reopened';
      await run(async () => {
        await api.updateLostFoundStatus(itemId, status, actor);
        showToast(`Item marked as ${label}.`, 'success');
      }, 'Could not update status.');
    },
    [requireUser, run, showToast]
  );

  const removeLostFoundItem = useCallback(
    async (itemId: string) => {
      const item = lostFoundItems.find((i) => i.id === itemId);
      await run(async () => {
        await api.deleteLostFoundItem(itemId);
        showToast(`Removed "${item?.title ?? 'item'}".`, 'warning');
      }, 'Could not remove the item.');
    },
    [lostFoundItems, run, showToast]
  );

  const createLabList = useCallback(
    async (input: NewListInput) => {
      const actor = requireUser();
      if (!actor) return;
      await run(async () => {
        const created = await api.createList(input, actor);
        showToast(`Created list "${created.title}".`, 'success');
      }, 'Could not create the list.');
    },
    [requireUser, run, showToast]
  );

  const updateLabList = useCallback(
    async (listId: string, updates: { title?: string; description?: string; columns?: ListColumn[] }) => {
      await run(async () => {
        await api.updateList(listId, updates);
      }, 'Could not update the list.');
    },
    [run]
  );

  const removeLabList = useCallback(
    async (listId: string) => {
      const list = labLists.find((l) => l.id === listId);
      await run(async () => {
        await api.deleteList(listId);
        showToast(`Deleted "${list?.title ?? 'list'}".`, 'warning');
      }, 'Could not delete the list.');
    },
    [labLists, run, showToast]
  );

  const addListItem = useCallback(
    async (listId: string, input: NewListItemInput) => {
      const list = labLists.find((l) => l.id === listId);
      const nextOrder = list ? Math.max(0, ...list.items.map((i) => i.sortOrder)) + 1 : 0;
      await run(async () => {
        await api.addListItem(listId, input, nextOrder);
      }, 'Could not add the item.');
    },
    [labLists, run]
  );

  const updateListItemCb = useCallback(
    async (itemId: string, updates: { name?: string; checked?: boolean; data?: Record<string, unknown> }) => {
      await run(async () => {
        await api.updateListItem(itemId, updates);
      }, 'Could not update the item.');
    },
    [run]
  );

  const removeListItem = useCallback(
    async (itemId: string) => {
      await run(async () => {
        await api.deleteListItem(itemId);
      }, 'Could not remove the item.');
    },
    [run]
  );

  // ---- equipment ----
  const addEquipmentCb = useCallback(
    async (input: NewEquipmentInput) => {
      if (!currentUser) return;
      await run(async () => {
        await api.addEquipment(input, currentUser.id);
        showToast(`Added "${input.name}".`, 'success');
      }, 'Could not add equipment.');
    },
    [currentUser, run, showToast]
  );

  const editEquipmentCb = useCallback(
    async (equipmentId: string, updates: Partial<NewEquipmentInput> & { status?: EquipmentStatus }) => {
      await run(async () => {
        await api.updateEquipment(equipmentId, updates);
      }, 'Could not update equipment.');
    },
    [run]
  );

  const removeEquipmentCb = useCallback(
    async (equipmentId: string) => {
      const eq = equipment.find((e) => e.id === equipmentId);
      await run(async () => {
        await api.deleteEquipment(equipmentId);
        showToast(`Deleted "${eq?.name ?? 'equipment'}".`, 'warning');
      }, 'Could not delete equipment.');
    },
    [equipment, run, showToast]
  );

  const reportIssueCb = useCallback(
    async (equipmentId: string, input: NewIssueInput) => {
      if (!currentUser) return;
      await run(async () => {
        await api.reportIssue(equipmentId, input, currentUser.id);
        showToast('Issue reported.', 'success');
      }, 'Could not report issue.');
    },
    [currentUser, run, showToast]
  );

  const updateIssueStatusCb = useCallback(
    async (issueId: string, status: IssueStatus, fixSummary?: string, fixedBy?: string, fixCost?: number) => {
      await run(async () => {
        await api.updateIssueStatus(issueId, status, fixSummary, fixedBy, fixCost);
        if (status === 'fixed') showToast('Issue marked as fixed.', 'success');
      }, 'Could not update issue.');
    },
    [run, showToast]
  );

  const addIssueResponseCb = useCallback(
    async (issueId: string, body: string) => {
      if (!currentUser) return;
      await run(async () => {
        await api.addIssueResponse(issueId, body, currentUser.id);
      }, 'Could not add response.');
    },
    [currentUser, run]
  );

  const addMaintenanceLogCb = useCallback(
    async (equipmentId: string, input: NewMaintenanceInput) => {
      if (!currentUser) return;
      await run(async () => {
        await api.addMaintenanceLog(equipmentId, input, currentUser.id);
        showToast('Maintenance logged.', 'success');
      }, 'Could not log maintenance.');
    },
    [currentUser, run, showToast]
  );

  // ---- bookings ----
  const addBookableItemCb = useCallback(
    async (input: NewBookableItemInput) => {
      if (!currentUser) return;
      await run(async () => {
        await api.addBookableItem(input, currentUser.id);
        showToast(`Added "${input.name}" to bookable items.`, 'success');
      }, 'Could not add bookable item.');
    },
    [currentUser, run, showToast]
  );

  const removeBookableItemCb = useCallback(
    async (itemId: string) => {
      const item = bookableItems.find((i) => i.id === itemId);
      await run(async () => {
        await api.deleteBookableItem(itemId);
        showToast(`Removed "${item?.name ?? 'item'}".`, 'warning');
      }, 'Could not remove bookable item.');
    },
    [bookableItems, run, showToast]
  );

  const createBookingCb = useCallback(
    async (input: NewBookingInput) => {
      if (!currentUser) return;
      await run(async () => {
        await api.createBooking(input, currentUser.id);
        showToast('Slot booked.', 'success');
      }, 'Could not create booking.');
    },
    [currentUser, run, showToast]
  );

  const cancelBookingCb = useCallback(
    async (bookingId: string) => {
      await run(async () => {
        await api.cancelBooking(bookingId);
        showToast('Booking cancelled.', 'warning');
      }, 'Could not cancel booking.');
    },
    [run, showToast]
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
    pendingDeliveryPurchase,
    clearPendingDelivery,
    createPurchase,
    editPurchase,
    updateStatus,
    addComment,
    addQuotation,
    selectQuotation,
    approvePi,
    deletePurchase,
    uploadInvoice,
    removeInvoice,
    inventoryItems,
    inventoryLog,
    addInventoryItem,
    consumeItem,
    restockItem,
    moveItem,
    editInventoryItem,
    removeInventoryItem,
    vendors,
    addVendor,
    editVendor,
    removeVendor,
    lostFoundItems,
    reportLostItem,
    addLostFoundResponse,
    updateLostFoundStatus,
    removeLostFoundItem,
    labLists,
    createLabList,
    updateLabList,
    removeLabList,
    addListItem,
    updateListItem: updateListItemCb,
    removeListItem,
    equipment,
    addEquipment: addEquipmentCb,
    editEquipment: editEquipmentCb,
    removeEquipment: removeEquipmentCb,
    reportIssue: reportIssueCb,
    updateIssueStatus: updateIssueStatusCb,
    addIssueResponse: addIssueResponseCb,
    addMaintenanceLog: addMaintenanceLogCb,
    bookableItems,
    bookings,
    addBookableItem: addBookableItemCb,
    removeBookableItem: removeBookableItemCb,
    createBooking: createBookingCb,
    cancelBooking: cancelBookingCb,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
