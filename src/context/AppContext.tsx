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
import { showBrowserNotification } from '../lib/notify';
import { readStored, writeStored } from '../lib/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
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
  Vendor,
} from '../types';

interface AppContextType {
  purchases: Purchase[];
  activities: Activity[];
  unreadActivityCount: number;
  markActivitiesRead: () => void;
  isLoading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;

  selectedPurchase: Purchase | null;
  setSelectedPurchase: (p: Purchase | null) => void;
  editingPurchase: Purchase | null;
  setEditingPurchase: (p: Purchase | null) => void;
  pendingDeliveryPurchase: Purchase | null;
  clearPendingDelivery: () => void;

  createPurchase: (data: NewPurchaseInput) => Promise<void>;
  editPurchase: (purchaseId: string, updates: Partial<NewPurchaseInput>) => Promise<void>;
  updateStatus: (purchaseId: string, status: PurchaseStatus) => Promise<void>;
  addComment: (purchaseId: string, body: string) => Promise<boolean>;
  addQuotation: (purchaseId: string, input: NewQuotationInput) => Promise<void>;
  editQuotation: (purchaseId: string, quotationId: string, updates: { vendor: string; price: number; notes?: string }) => Promise<boolean>;
  deleteQuotation: (purchaseId: string, quotation: Quotation) => Promise<boolean>;
  selectQuotation: (purchaseId: string, quotation: Quotation) => Promise<void>;
  approvePi: (purchaseId: string) => Promise<void>;
  deletePurchase: (purchaseId: string) => Promise<boolean>;
  recordDelivery: (purchaseId: string, quantityReceived: string, notes: string, isFinal: boolean) => Promise<boolean>;
  uploadInvoice: (purchaseId: string, file: File) => Promise<void>;
  removeInvoice: (purchaseId: string) => Promise<boolean>;

  inventoryItems: InventoryItem[];
  inventoryLog: InventoryLogEntry[];
  addInventoryItem: (input: NewInventoryItemInput) => Promise<boolean>;
  consumeItem: (item: InventoryItem, quantity: number, notes?: string) => Promise<boolean>;
  restockItem: (item: InventoryItem, quantity: number, notes?: string) => Promise<boolean>;
  moveItem: (item: InventoryItem, newLocation: string, notes?: string) => Promise<boolean>;
  editInventoryItem: (item: InventoryItem, updates: Partial<Pick<NewInventoryItemInput, 'name' | 'category' | 'quantity' | 'unit' | 'location' | 'lowStockThreshold' | 'expiryDate' | 'notes'>>) => Promise<boolean>;
  removeInventoryItem: (item: InventoryItem) => Promise<void>;

  vendors: Vendor[];
  addVendor: (input: NewVendorInput) => Promise<void>;
  editVendor: (vendorId: string, updates: Partial<NewVendorInput>) => Promise<void>;
  removeVendor: (vendorId: string) => Promise<void>;

  lostFoundItems: LostFoundItem[];
  reportLostItem: (input: NewLostFoundInput) => Promise<void>;
  addLostFoundResponse: (itemId: string, body: string) => Promise<boolean>;
  updateLostFoundStatus: (itemId: string, status: LostFoundStatus) => Promise<void>;
  removeLostFoundItem: (itemId: string) => Promise<boolean>;

  labLists: LabList[];
  createLabList: (input: NewListInput) => Promise<boolean>;
  updateLabList: (listId: string, updates: { title?: string; description?: string; columns?: ListColumn[] }) => Promise<boolean>;
  removeLabList: (listId: string) => Promise<boolean>;
  addListItem: (listId: string, input: NewListItemInput) => Promise<boolean>;
  updateListItem: (itemId: string, updates: { name?: string; checked?: boolean; data?: Record<string, unknown> }) => Promise<boolean>;
  removeListItem: (itemId: string) => Promise<void>;

  equipment: Equipment[];
  addEquipment: (input: NewEquipmentInput) => Promise<void>;
  editEquipment: (equipmentId: string, updates: Partial<NewEquipmentInput> & { status?: EquipmentStatus }) => Promise<boolean>;
  removeEquipment: (equipmentId: string) => Promise<boolean>;
  reportIssue: (equipmentId: string, input: NewIssueInput) => Promise<boolean>;
  updateIssueStatus: (issueId: string, status: IssueStatus, fixSummary?: string, fixedBy?: string, fixCost?: number) => Promise<boolean>;
  addIssueResponse: (issueId: string, body: string) => Promise<boolean>;
  addMaintenanceLog: (equipmentId: string, input: NewMaintenanceInput) => Promise<boolean>;

  bookableItems: BookableItem[];
  bookings: Booking[];
  addBookableItem: (input: NewBookableItemInput) => Promise<boolean>;
  removeBookableItem: (itemId: string) => Promise<void>;
  createBooking: (input: NewBookingInput) => Promise<boolean>;
  cancelBooking: (bookingId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function dedup<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/** Independently refreshable areas of the lab dataset. */
type LoadScope =
  | 'purchases'
  | 'activities'
  | 'inventory'
  | 'vendors'
  | 'lostFound'
  | 'lists'
  | 'equipment'
  | 'bookings';

/**
 * Which area each realtime table belongs to. A change only refreshes its own
 * area — editing a list item shouldn't re-download every purchase thread.
 * Child tables map to their parent's area because the parent fetch embeds
 * them (quotations/comments/deliveries arrive inside the purchase query).
 */
const TABLE_SCOPES: Record<string, LoadScope> = {
  purchases: 'purchases',
  quotations: 'purchases',
  comments: 'purchases',
  deliveries: 'purchases',
  activities: 'activities',
  inventory_items: 'inventory',
  inventory_log: 'inventory',
  vendors: 'vendors',
  lost_found_items: 'lostFound',
  lost_found_responses: 'lostFound',
  lists: 'lists',
  list_items: 'lists',
  equipment: 'equipment',
  equipment_issues: 'equipment',
  issue_responses: 'equipment',
  maintenance_logs: 'equipment',
  bookable_items: 'bookings',
  bookings: 'bookings',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { showToast } = useUI();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLog, setInventoryLog] = useState<InventoryLogEntry[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [lostFoundItems, setLostFoundItems] = useState<LostFoundItem[]>([]);
  const [labLists, setLabLists] = useState<LabList[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [bookableItems, setBookableItems] = useState<BookableItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [pendingDeliveryPurchaseId, setPendingDeliveryPurchaseId] = useState<string | null>(null);

  // Stable ref so callbacks don't re-create when currentUser changes
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const NOTIF_KEY = currentUser ? `procure.notif.${currentUser.id}` : '';

  const [activitiesReadAt, setActivitiesReadAt] = useState<string>(() => {
    if (!NOTIF_KEY) return new Date().toISOString();
    return readStored(NOTIF_KEY) ?? new Date().toISOString();
  });

  useEffect(() => {
    if (!NOTIF_KEY) return;
    const stored = readStored(NOTIF_KEY);
    if (stored) setActivitiesReadAt(stored);
    else {
      const now = new Date().toISOString();
      writeStored(NOTIF_KEY, now);
      setActivitiesReadAt(now);
    }
  }, [NOTIF_KEY]);

  const unreadActivityCount = useMemo(() => {
    if (!currentUser) return 0;
    return activities.filter(
      (a) => a.createdAt > activitiesReadAt && a.actor?.id !== currentUser.id
    ).length;
  }, [activities, activitiesReadAt, currentUser]);

  const markActivitiesRead = useCallback(() => {
    if (!NOTIF_KEY) return;
    const now = new Date().toISOString();
    writeStored(NOTIF_KEY, now);
    setActivitiesReadAt(now);
  }, [NOTIF_KEY]);

  const lastSeenActivityRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentUser || activities.length === 0) return;
    const latest = activities[0].createdAt;
    const prev = lastSeenActivityRef.current;
    if (!prev) {
      lastSeenActivityRef.current = latest;
      return;
    }
    const fresh = activities.filter(
      (a) => a.createdAt > prev && a.actor?.id !== currentUser.id,
    );
    if (fresh.length > 0) {
      lastSeenActivityRef.current = latest;
      const a = fresh[0];
      showBrowserNotification(
        a.actor?.name ?? 'Someone',
        a.type,
        a.purchaseTitle,
        import.meta.env.BASE_URL,
      );
    }
  }, [activities, currentUser]);

  // One loader per area, so a realtime change can refresh just the data it
  // actually touched instead of re-downloading the whole lab.
  const loadPurchases = useCallback(async () => {
    setPurchases(dedup(await api.fetchPurchases()));
  }, []);

  const loadActivities = useCallback(async () => {
    setActivities(dedup(await api.fetchActivities()));
  }, []);

  const loadInventory = useCallback(async () => {
    const [items, logs] = await Promise.all([
      api.fetchInventoryItems(),
      api.fetchInventoryLog(),
    ]);
    setInventoryItems(dedup(items));
    setInventoryLog(dedup(logs));
  }, []);

  const loadVendors = useCallback(async () => {
    setVendors(dedup(await api.fetchVendors()));
  }, []);

  const loadLostFound = useCallback(async () => {
    setLostFoundItems(dedup(await api.fetchLostFoundItems()));
  }, []);

  const loadLists = useCallback(async () => {
    setLabLists(dedup(await api.fetchLists()));
  }, []);

  const loadEquipment = useCallback(async () => {
    setEquipment(dedup(await api.fetchEquipment()));
  }, []);

  const loadBookings = useCallback(async () => {
    const [bi, bk] = await Promise.all([
      api.fetchBookableItems(),
      api.fetchBookings(),
    ]);
    setBookableItems(dedup(bi));
    setBookings(dedup(bk));
  }, []);

  const scopeLoaders = useMemo<Record<LoadScope, () => Promise<void>>>(() => ({
    purchases: loadPurchases,
    activities: loadActivities,
    inventory: loadInventory,
    vendors: loadVendors,
    lostFound: loadLostFound,
    lists: loadLists,
    equipment: loadEquipment,
    bookings: loadBookings,
  }), [
    loadPurchases, loadActivities, loadInventory, loadVendors,
    loadLostFound, loadLists, loadEquipment, loadBookings,
  ]);

  /**
   * Background refresh of just the named areas. Failures are swallowed on
   * purpose: a dropped refresh should leave the last good data on screen
   * rather than replacing a working view with an error.
   */
  const refreshScopes = useCallback(async (scopes: LoadScope[]) => {
    await Promise.allSettled(scopes.map((s) => scopeLoaders[s]()));
  }, [scopeLoaders]);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoadError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      setIsLoading(false);
      return;
    }
    try {
      // Purchases and activity are the core feed — failing to load them is a
      // real error worth showing.
      await Promise.all([loadPurchases(), loadActivities()]);
      setLoadError(null);

      // The rest are optional: their tables may not exist yet if a migration
      // hasn't been run, so a failure here must not blank the app.
      await Promise.allSettled([
        loadInventory(),
        loadVendors(),
        loadLostFound(),
        loadLists(),
        loadEquipment(),
        loadBookings(),
      ]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load lab data.');
    } finally {
      setIsLoading(false);
    }
  }, [
    loadPurchases, loadActivities, loadInventory, loadVendors,
    loadLostFound, loadLists, loadEquipment, loadBookings,
  ]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Collect the areas touched during the debounce window, then refresh only
    // those. Several tables often change together (a comment also writes an
    // activity row), and batching keeps that to one refresh per area.
    const queued = new Set<LoadScope>();
    let pending: ReturnType<typeof setTimeout> | null = null;

    const queue = (scope: LoadScope) => {
      queued.add(scope);
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        const scopes = [...queued];
        queued.clear();
        pending = null;
        void refreshScopes(scopes);
      }, 250);
    };

    let channel = supabase.channel('procurement-changes');
    for (const [table, scope] of Object.entries(TABLE_SCOPES)) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => queue(scope)
      );
    }
    channel.subscribe();

    return () => {
      if (pending) clearTimeout(pending);
      void supabase.removeChannel(channel);
    };
  }, [refreshScopes]);

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

  /**
   * Runs a mutation, refreshes, and reports whether it succeeded.
   *
   * Errors are still caught and surfaced as a toast rather than rethrown, so
   * existing callers that ignore the result behave exactly as before. Callers
   * that need to know — a modal deciding whether to close, a form deciding
   * whether to clear — can check the boolean instead of assuming success.
   */
  const run = useCallback(
    async (action: () => Promise<void>, fallbackMessage: string): Promise<boolean> => {
      try {
        await action();
        await reload();
        return true;
      } catch (err) {
        showToastRef.current(err instanceof Error ? err.message : fallbackMessage, 'error');
        return false;
      }
    },
    [reload]
  );

  const requireUser = useCallback((): import('../types').User | null => {
    const user = currentUserRef.current;
    if (!user) {
      showToastRef.current('Your session expired. Please sign in again.', 'error');
      return null;
    }
    return user;
  }, []);

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
        showToastRef.current(`Requested "${created.title}".`, 'success');
      }, 'Could not create the request.');
    },
    [requireUser, run]
  );

  const editPurchase = useCallback(
    async (purchaseId: string, updates: Partial<NewPurchaseInput>) => {
      const actor = requireUser();
      const purchase = findPurchase(purchaseId);
      if (!actor || !purchase) return;
      await run(async () => {
        await api.updatePurchaseFields(purchaseId, updates);
        showToastRef.current(`Updated "${updates.title ?? purchase.title}".`, 'success');
        setEditingPurchaseId(null);
      }, 'Could not update the request.');
    },
    [requireUser, findPurchase, run]
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
          showToastRef.current(`"${purchase.title}" marked as delivered.`, 'success');
          setPendingDeliveryPurchaseId(purchaseId);
        } else {
          showToastRef.current(`Status set to ${api.STATUS_LABELS[status]}.`, 'info');
        }
      }, 'Could not update the status.');
    },
    [findPurchase, requireUser, run]
  );

  const addComment = useCallback(
    async (purchaseId: string, body: string) => {
      const actor = requireUser();
      const purchase = findPurchase(purchaseId);
      if (!actor || !purchase) return false;
      return run(() => api.addComment(purchase, body, actor), 'Could not post the reply.');
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
        showToastRef.current(`Quotation from ${input.vendor} added.`, 'success');
      }, 'Could not add the quotation.');
    },
    [findPurchase, requireUser, run]
  );

  const editQuotation = useCallback(
    async (purchaseId: string, quotationId: string, updates: { vendor: string; price: number; notes?: string }) => {
      const actor = requireUser();
      const purchase = findPurchase(purchaseId);
      if (!actor || !purchase) return false;
      return run(async () => {
        await api.updateQuotation(purchase, quotationId, updates, actor);
        showToastRef.current('Quotation updated.', 'success');
      }, 'Could not update the quotation.');
    },
    [findPurchase, requireUser, run]
  );

  const deleteQuotation = useCallback(
    async (purchaseId: string, quotation: Quotation) => {
      const actor = requireUser();
      const purchase = findPurchase(purchaseId);
      if (!actor || !purchase) return false;
      return run(async () => {
        await api.deleteQuotation(purchase, quotation, actor);
        showToastRef.current(`Quotation from ${quotation.vendor} removed.`, 'success');
      }, 'Could not remove the quotation.');
    },
    [findPurchase, requireUser, run]
  );

  const selectQuotation = useCallback(
    async (purchaseId: string, quotation: Quotation) => {
      const actor = requireUser();
      const purchase = findPurchase(purchaseId);
      if (!actor || !purchase) return;
      await run(async () => {
        await api.selectQuotation(purchase, quotation, actor);
        showToastRef.current(`${quotation.vendor} selected for the purchase order.`, 'success');
      }, 'Could not select the quotation.');
    },
    [findPurchase, requireUser, run]
  );

  const approvePi = useCallback(
    async (purchaseId: string) => {
      const actor = requireUser();
      const purchase = findPurchase(purchaseId);
      if (!actor || !purchase) return;
      await run(async () => {
        await api.approvePi(purchase, actor);
        showToastRef.current('Expenditure approved.', 'success');
      }, 'Could not record the approval.');
    },
    [findPurchase, requireUser, run]
  );

  const deletePurchase = useCallback(
    async (purchaseId: string) => {
      const purchase = findPurchase(purchaseId);
      if (!purchase) return false;
      return run(async () => {
        await api.deletePurchase(purchaseId);
        if (selectedPurchaseId === purchaseId) setSelectedPurchaseId(null);
        showToastRef.current(`Deleted "${purchase.title}".`, 'warning');
      }, 'Could not delete the request.');
    },
    [findPurchase, run, selectedPurchaseId]
  );

  const recordDelivery = useCallback(
    async (purchaseId: string, quantityReceived: string, notes: string, isFinal: boolean) => {
      const actor = requireUser();
      const purchase = findPurchase(purchaseId);
      if (!actor || !purchase) return false;
      return run(async () => {
        await api.recordDelivery(purchase, quantityReceived, notes, isFinal, actor);
        if (isFinal) {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
          showToastRef.current(`"${purchase.title}" fully delivered.`, 'success');
          setPendingDeliveryPurchaseId(purchaseId);
        } else {
          showToastRef.current(`Recorded ${quantityReceived} for "${purchase.title}".`, 'info');
        }
      }, 'Could not record the delivery.');
    },
    [findPurchase, requireUser, run]
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
          showToastRef.current('Invoice attached.', 'success');
        } else {
          const saved = Math.round((1 - result.compressedSize / result.originalSize) * 100);
          showToastRef.current(`Invoice attached — compressed ${saved}% smaller.`, 'success');
        }
      }, 'Could not attach the invoice.');
    },
    [findPurchase, requireUser, run]
  );

  const removeInvoice = useCallback(
    async (purchaseId: string) => {
      const purchase = findPurchase(purchaseId);
      if (!purchase) return false;
      return run(async () => {
        await api.removeInvoice(purchase);
        showToastRef.current('Invoice removed.', 'warning');
      }, 'Could not remove the invoice.');
    },
    [findPurchase, run]
  );

  const addInventoryItem = useCallback(
    async (input: NewInventoryItemInput) => {
      const actor = requireUser();
      if (!actor) return false;
      return run(async () => {
        const created = await api.addInventoryItem(input, actor);
        showToastRef.current(`Added "${created.name}" to inventory.`, 'success');
      }, 'Could not add the item.');
    },
    [requireUser, run]
  );

  const consumeItem = useCallback(
    async (item: InventoryItem, quantity: number, notes?: string) => {
      const actor = requireUser();
      if (!actor) return false;
      return run(async () => {
        await api.consumeInventoryItem(item, quantity, actor, notes);
        showToastRef.current(`Used ${quantity} ${item.unit} of "${item.name}".`, 'info');
      }, 'Could not record usage.');
    },
    [requireUser, run]
  );

  const restockItem = useCallback(
    async (item: InventoryItem, quantity: number, notes?: string) => {
      const actor = requireUser();
      if (!actor) return false;
      return run(async () => {
        await api.restockInventoryItem(item, quantity, actor, notes);
        showToastRef.current(`Restocked ${quantity} ${item.unit} of "${item.name}".`, 'success');
      }, 'Could not record restock.');
    },
    [requireUser, run]
  );

  const moveItem = useCallback(
    async (item: InventoryItem, newLocation: string, notes?: string) => {
      const actor = requireUser();
      if (!actor) return false;
      return run(async () => {
        await api.moveInventoryItem(item, newLocation, actor, notes);
        showToastRef.current(`Moved "${item.name}" to ${newLocation}.`, 'info');
      }, 'Could not move the item.');
    },
    [requireUser, run]
  );

  const editInventoryItem = useCallback(
    async (item: InventoryItem, updates: Partial<Pick<NewInventoryItemInput, 'name' | 'category' | 'quantity' | 'unit' | 'location' | 'lowStockThreshold' | 'expiryDate' | 'notes'>>) => {
      const actor = requireUser();
      if (!actor) return false;
      return run(async () => {
        await api.updateInventoryItem(item, updates, actor);
        showToastRef.current(`Updated "${updates.name ?? item.name}".`, 'success');
      }, 'Could not update the item.');
    },
    [requireUser, run]
  );

  const removeInventoryItem = useCallback(
    async (item: InventoryItem) => {
      const actor = requireUser();
      if (!actor) return;
      await run(async () => {
        await api.deleteInventoryItem(item.id, item.name, actor);
        showToastRef.current(`Removed "${item.name}" from inventory.`, 'warning');
      }, 'Could not remove the item.');
    },
    [requireUser, run]
  );

  const addVendor = useCallback(
    async (input: NewVendorInput) => {
      const actor = requireUser();
      if (!actor) return;
      await run(async () => {
        const created = await api.addVendor(input, actor);
        showToastRef.current(`Added vendor "${created.name}".`, 'success');
      }, 'Could not add the vendor.');
    },
    [requireUser, run]
  );

  const editVendor = useCallback(
    async (vendorId: string, updates: Partial<NewVendorInput>) => {
      await run(async () => {
        await api.updateVendor(vendorId, updates);
        showToastRef.current(`Vendor updated.`, 'success');
      }, 'Could not update the vendor.');
    },
    [run]
  );

  const removeVendor = useCallback(
    async (vendorId: string) => {
      const vendor = vendors.find((v) => v.id === vendorId);
      await run(async () => {
        await api.deleteVendor(vendorId);
        showToastRef.current(`Removed "${vendor?.name ?? 'vendor'}".`, 'warning');
      }, 'Could not remove the vendor.');
    },
    [vendors, run]
  );

  const reportLostItem = useCallback(
    async (input: NewLostFoundInput) => {
      const actor = requireUser();
      if (!actor) return;
      await run(async () => {
        await api.reportLostItem(input, actor);
        showToastRef.current(`Reported "${input.title}" as lost.`, 'success');
      }, 'Could not report the item.');
    },
    [requireUser, run]
  );

  const addLostFoundResponse = useCallback(
    async (itemId: string, body: string) => {
      const actor = requireUser();
      if (!actor) return false;
      return run(() => api.addLostFoundResponse(itemId, body, actor), 'Could not post the response.');
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
        showToastRef.current(`Item marked as ${label}.`, 'success');
      }, 'Could not update status.');
    },
    [requireUser, run]
  );

  const removeLostFoundItem = useCallback(
    async (itemId: string) => {
      const item = lostFoundItems.find((i) => i.id === itemId);
      return run(async () => {
        await api.deleteLostFoundItem(itemId);
        showToastRef.current(`Removed "${item?.title ?? 'item'}".`, 'warning');
      }, 'Could not remove the item.');
    },
    [lostFoundItems, run]
  );

  const createLabList = useCallback(
    async (input: NewListInput) => {
      const actor = requireUser();
      if (!actor) return false;
      return run(async () => {
        const created = await api.createList(input, actor);
        showToastRef.current(`Created list "${created.title}".`, 'success');
      }, 'Could not create the list.');
    },
    [requireUser, run]
  );

  const updateLabList = useCallback(
    async (listId: string, updates: { title?: string; description?: string; columns?: ListColumn[] }) => {
      return run(async () => {
        await api.updateList(listId, updates);
      }, 'Could not update the list.');
    },
    [run]
  );

  const removeLabList = useCallback(
    async (listId: string) => {
      const list = labLists.find((l) => l.id === listId);
      return run(async () => {
        await api.deleteList(listId);
        showToastRef.current(`Deleted "${list?.title ?? 'list'}".`, 'warning');
      }, 'Could not delete the list.');
    },
    [labLists, run]
  );

  const addListItem = useCallback(
    async (listId: string, input: NewListItemInput) => {
      const list = labLists.find((l) => l.id === listId);
      const nextOrder = list ? Math.max(0, ...list.items.map((i) => i.sortOrder)) + 1 : 0;
      return run(async () => {
        await api.addListItem(listId, input, nextOrder);
      }, 'Could not add the item.');
    },
    [labLists, run]
  );

  const updateListItemCb = useCallback(
    async (itemId: string, updates: { name?: string; checked?: boolean; data?: Record<string, unknown> }) => {
      return run(async () => {
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

  const addEquipmentCb = useCallback(
    async (input: NewEquipmentInput) => {
      const user = currentUserRef.current;
      if (!user) return;
      await run(async () => {
        await api.addEquipment(input, user.id);
        showToastRef.current(`Added "${input.name}".`, 'success');
      }, 'Could not add equipment.');
    },
    [run]
  );

  const editEquipmentCb = useCallback(
    async (equipmentId: string, updates: Partial<NewEquipmentInput> & { status?: EquipmentStatus }) => {
      return run(async () => {
        await api.updateEquipment(equipmentId, updates);
      }, 'Could not update equipment.');
    },
    [run]
  );

  const removeEquipmentCb = useCallback(
    async (equipmentId: string) => {
      const eq = equipment.find((e) => e.id === equipmentId);
      return run(async () => {
        await api.deleteEquipment(equipmentId);
        showToastRef.current(`Deleted "${eq?.name ?? 'equipment'}".`, 'warning');
      }, 'Could not delete equipment.');
    },
    [equipment, run]
  );

  const reportIssueCb = useCallback(
    async (equipmentId: string, input: NewIssueInput) => {
      const user = currentUserRef.current;
      if (!user) return false;
      return run(async () => {
        await api.reportIssue(equipmentId, input, user.id);
        showToastRef.current('Issue reported.', 'success');
      }, 'Could not report issue.');
    },
    [run]
  );

  const updateIssueStatusCb = useCallback(
    async (issueId: string, status: IssueStatus, fixSummary?: string, fixedBy?: string, fixCost?: number) => {
      return run(async () => {
        await api.updateIssueStatus(issueId, status, fixSummary, fixedBy, fixCost);
        if (status === 'fixed') showToastRef.current('Issue marked as fixed.', 'success');
      }, 'Could not update issue.');
    },
    [run]
  );

  const addIssueResponseCb = useCallback(
    async (issueId: string, body: string) => {
      const user = currentUserRef.current;
      if (!user) return false;
      return run(async () => {
        await api.addIssueResponse(issueId, body, user.id);
      }, 'Could not add response.');
    },
    [run]
  );

  const addMaintenanceLogCb = useCallback(
    async (equipmentId: string, input: NewMaintenanceInput) => {
      const user = currentUserRef.current;
      if (!user) return false;
      return run(async () => {
        await api.addMaintenanceLog(equipmentId, input, user.id);
        showToastRef.current('Maintenance logged.', 'success');
      }, 'Could not log maintenance.');
    },
    [run]
  );

  const addBookableItemCb = useCallback(
    async (input: NewBookableItemInput) => {
      const user = currentUserRef.current;
      if (!user) return false;
      return run(async () => {
        await api.addBookableItem(input, user.id);
        showToastRef.current(`Added "${input.name}" to bookable items.`, 'success');
      }, 'Could not add bookable item.');
    },
    [run]
  );

  const removeBookableItemCb = useCallback(
    async (itemId: string) => {
      const item = bookableItems.find((i) => i.id === itemId);
      await run(async () => {
        await api.deleteBookableItem(itemId);
        showToastRef.current(`Removed "${item?.name ?? 'item'}".`, 'warning');
      }, 'Could not remove bookable item.');
    },
    [bookableItems, run]
  );

  const createBookingCb = useCallback(
    async (input: NewBookingInput) => {
      const user = currentUserRef.current;
      if (!user) return false;
      return run(async () => {
        await api.createBooking(input, user.id);
        showToastRef.current('Slot booked.', 'success');
      }, 'Could not create booking.');
    },
    [run]
  );

  const cancelBookingCb = useCallback(
    async (bookingId: string) => {
      await run(async () => {
        await api.cancelBooking(bookingId);
        showToastRef.current('Booking cancelled.', 'warning');
      }, 'Could not cancel booking.');
    },
    [run]
  );

  const value: AppContextType = {
    purchases,
    activities,
    unreadActivityCount,
    markActivitiesRead,
    isLoading,
    loadError,
    reload,
    selectedPurchase,
    setSelectedPurchase,
    editingPurchase,
    setEditingPurchase,
    pendingDeliveryPurchase,
    clearPendingDelivery,
    createPurchase,
    editPurchase,
    updateStatus,
    addComment,
    addQuotation,
    editQuotation,
    deleteQuotation,
    selectQuotation,
    approvePi,
    deletePurchase,
    recordDelivery,
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
