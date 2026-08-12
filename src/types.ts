export type PurchaseStatus = 'waiting' | 'quotes' | 'ordered' | 'transit' | 'delivered' | 'closed';

export type UrgencyLevel = 'low' | 'normal' | 'urgent' | 'critical';

export type UserRole = 'lab_member' | 'procurement_incharge' | 'pi';

export type ActivityType =
  | 'created'
  | 'quote_added'
  | 'status_changed'
  | 'comment_added'
  | 'pi_approved'
  | 'assigned';

export type AccentToken =
  | 'purple'
  | 'blue'
  | 'emerald'
  | 'indigo'
  | 'pink'
  | 'orange'
  | 'cyan'
  | 'amber'
  | 'red'
  | 'slate';

export interface User {
  id: string;
  handle: string;
  name: string;
  role: UserRole;
  accent: AccentToken;
  email: string | null;
  department: string | null;
}

export interface Quotation {
  id: string;
  purchaseId: string;
  vendor: string;
  price: number;
  currency: string;
  notes: string | null;
  filePath: string | null;
  fileName: string | null;
  fileSize: number | null;
  isApproved: boolean;
  isRecommended: boolean;
  uploadedBy: User | null;
  createdAt: string;
}

export interface Comment {
  id: string;
  purchaseId: string;
  author: User | null;
  body: string;
  createdAt: string;
}

export interface Purchase {
  id: string;
  title: string;
  description: string;
  quantity: string;
  category: string;
  priority: UrgencyLevel;
  status: PurchaseStatus;
  preferredCompany: string | null;
  requestedBy: User | null;
  assignedTo: User | null;
  requiresPiApproval: boolean;
  piApproved: boolean;
  createdAt: string;
  updatedAt: string;
  quotations: Quotation[];
  comments: Comment[];
}

export interface Activity {
  id: string;
  purchaseId: string | null;
  purchaseTitle: string;
  actor: User | null;
  type: ActivityType;
  details: string;
  createdAt: string;
}

export type InventoryAction =
  | 'added'
  | 'moved'
  | 'consumed'
  | 'restocked'
  | 'arrived'
  | 'adjusted'
  | 'removed';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  lowStockThreshold: number | null;
  notes: string | null;
  linkedPurchaseId: string | null;
  addedBy: User | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryLogEntry {
  id: string;
  itemId: string;
  itemName: string;
  action: InventoryAction;
  quantityChange: number | null;
  oldLocation: string | null;
  newLocation: string | null;
  actor: User | null;
  notes: string | null;
  createdAt: string;
}

export interface NewInventoryItemInput {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  lowStockThreshold?: number | null;
  notes?: string;
}

export type VendorType = 'direct' | 'third_party';

export interface Vendor {
  id: string;
  name: string;
  type: VendorType;
  comment: string;
  contact: string;
  photoUrl: string | null;
  createdBy: User | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewVendorInput {
  name: string;
  type: VendorType;
  comment?: string;
  contact?: string;
  photoUrl?: string;
}

export type LostFoundStatus = 'open' | 'found' | 'resolved';

export interface LostFoundItem {
  id: string;
  title: string;
  description: string;
  locationLastSeen: string;
  status: LostFoundStatus;
  reportedBy: User | null;
  resolvedBy: User | null;
  responses: LostFoundResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface LostFoundResponse {
  id: string;
  itemId: string;
  author: User | null;
  body: string;
  createdAt: string;
}

export interface NewLostFoundInput {
  title: string;
  description?: string;
  locationLastSeen?: string;
}

export type TabType = 'home' | 'search' | 'activity' | 'profile' | 'inventory';

export interface NewPurchaseInput {
  title: string;
  description: string;
  quantity: string;
  category: string;
  priority: UrgencyLevel;
  preferredCompany?: string;
}

export interface NewQuotationInput {
  vendor: string;
  price: number;
  notes?: string;
  file?: File | null;
}
