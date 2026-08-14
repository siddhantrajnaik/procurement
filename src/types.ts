export type PurchaseStatus = 'waiting' | 'quotes' | 'ordered' | 'transit' | 'delivered' | 'closed';

export type UrgencyLevel = 'low' | 'normal' | 'urgent' | 'critical';

export type UserRole = 'lab_member' | 'procurement_incharge' | 'pi' | 'guest';

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
  birthday: string | null;
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
  invoicePath: string | null;
  invoiceName: string | null;
  invoiceSize: number | null;
  invoiceUploadedBy: User | null;
  invoiceUploadedAt: string | null;
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

export interface ListColumn {
  name: string;
  type: 'text' | 'number' | 'checkbox';
}

export interface ListItem {
  id: string;
  listId: string;
  name: string;
  checked: boolean;
  data: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
}

export interface LabList {
  id: string;
  title: string;
  description: string;
  columns: ListColumn[];
  items: ListItem[];
  createdBy: User | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewListInput {
  title: string;
  description?: string;
}

export interface NewListItemInput {
  name: string;
  data?: Record<string, unknown>;
}

export type EquipmentStatus = 'working' | 'needs_attention' | 'down' | 'under_service';

export type IssueStatus = 'reported' | 'investigating' | 'vendor_called' | 'fixed';

export interface MaintenanceLog {
  id: string;
  equipmentId: string;
  performedBy: string;
  description: string;
  cost: number | null;
  serviceDate: string;
  nextDueDate: string | null;
  loggedBy: User | null;
  createdAt: string;
}

export interface IssueResponse {
  id: string;
  issueId: string;
  author: User | null;
  body: string;
  createdAt: string;
}

export interface EquipmentIssue {
  id: string;
  equipmentId: string;
  reportedBy: User | null;
  title: string;
  description: string;
  status: IssueStatus;
  fixSummary: string;
  fixedBy: string;
  fixCost: number | null;
  responses: IssueResponse[];
  createdAt: string;
  resolvedAt: string | null;
}

export interface Equipment {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  category: string;
  location: string;
  status: EquipmentStatus;
  photoUrl: string | null;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  serviceVendor: string;
  serviceContactPerson: string;
  servicePhone: string;
  notes: string;
  addedBy: User | null;
  issues: EquipmentIssue[];
  maintenanceLogs: MaintenanceLog[];
  createdAt: string;
  updatedAt: string;
}

export interface NewEquipmentInput {
  name: string;
  model?: string;
  manufacturer?: string;
  category?: string;
  location?: string;
  serviceVendor?: string;
  serviceContactPerson?: string;
  servicePhone?: string;
  notes?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
}

export interface NewIssueInput {
  title: string;
  description?: string;
}

export interface NewMaintenanceInput {
  description: string;
  performedBy?: string;
  cost?: number;
  serviceDate?: string;
  nextDueDate?: string;
}

export type BookingStatus = 'confirmed' | 'cancelled';

export interface BookableItem {
  id: string;
  name: string;
  description: string;
  color: string;
  createdBy: User | null;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  itemId: string;
  bookedBy: User | null;
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
  status: BookingStatus;
  createdAt: string;
}

export interface NewBookableItemInput {
  name: string;
  description?: string;
  color?: string;
}

export interface NewBookingInput {
  itemId: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose?: string;
}

export type TabType = 'home' | 'search' | 'activity' | 'profile' | 'inventory';

export interface QuickLink {
  id: string;
  title: string;
  url: string;
  addedBy: User | null;
  createdAt: string;
}

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
}
