export type PurchaseStatus = 'waiting' | 'quotes' | 'ordered' | 'transit' | 'partial' | 'delivered' | 'closed';

export type UrgencyLevel = 'low' | 'normal' | 'urgent' | 'critical';

export type UserRole = 'lab_member' | 'procurement_incharge' | 'pi' | 'guest';

export type ActivityType =
  | 'created'
  | 'quote_added'
  | 'status_changed'
  | 'comment_added'
  | 'pi_approved'
  | 'assigned'
  | 'delivery_recorded';

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

export interface Delivery {
  id: string;
  purchaseId: string;
  quantityReceived: string;
  notes: string;
  receivedBy: User | null;
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
  deliveries: Delivery[];
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
  expiryDate: string | null;
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
  expiryDate?: string | null;
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
  /** Free text off the back of the machine. Not unique across makers. */
  serialNumber: string;
  /** Kept off the visitor list. Members and the PI still see it. */
  hideFromGuests: boolean;
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
  usageLog: EquipmentUsage[];
  createdAt: string;
  updatedAt: string;
}

/**
 * One visit to an instrument. Deliberately a single timestamp rather than a
 * start/end pair: the maintenance log asks for five fields and has never been
 * filled in once, so anything a visitor is expected to record has to be one tap.
 *
 * `visitorName` is free text because visiting researchers are not system users —
 * the same shape `MaintenanceLog.performedBy` already uses.
 */
export interface EquipmentUsage {
  id: string;
  equipmentId: string;
  visitorName: string;
  affiliation: string;
  purpose: string;
  /** Free text: "12000 rpm", "1500 g". Only asked for on spin/shake instruments. */
  speed: string;
  /** Free text, kept for rows written before 0027 and anything typed by hand. */
  duration: string;
  /** When the run began. Null on a one-tap entry, which stays valid. */
  startedAt: string | null;
  /** How long it ran, in minutes — the addable version of `duration`. */
  durationMinutes: number | null;
  loggedBy: User | null;
  /** When the row was written, which is not when the instrument was used. */
  createdAt: string;
}

/** Something a visitor took away. Records only — inventory counts are untouched. */
export interface ConsumableLoan {
  id: string;
  itemId: string | null;
  itemName: string;
  quantity: string;
  visitorName: string;
  affiliation: string;
  notes: string;
  loggedBy: User | null;
  createdAt: string;
}

export interface NewUsageInput {
  equipmentId: string;
  visitorName: string;
  affiliation?: string;
  purpose?: string;
  speed?: string;
  duration?: string;
  /** ISO timestamp. Omit for a one-tap entry. */
  startedAt?: string | null;
  durationMinutes?: number | null;
}

export interface NewLoanInput {
  itemId?: string | null;
  itemName: string;
  quantity?: string;
  visitorName: string;
  affiliation?: string;
  notes?: string;
}

export interface NewEquipmentInput {
  name: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  hideFromGuests?: boolean;
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

export interface DriveLink {
  url: string;
  title: string;
}

export interface NotebookPage {
  id: string;
  title: string;
  icon: string;
  body: string;
  driveLinks: DriveLink[];
  addedBy: User | null;
  createdAt: string;
  updatedAt: string;
}

export interface SampleBox {
  id: string;
  name: string;
  condition: string;
  location: string;
  createdBy: User | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sample {
  id: string;
  name: string;
  boxId: string | null;
  container: string;
  volume: string;
  notes: string;
  addedBy: User | null;
  createdAt: string;
  updatedAt: string;
}

export interface SampleLogEntry {
  id: string;
  sampleId: string | null;
  action: string;
  details: string;
  actor: User | null;
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
