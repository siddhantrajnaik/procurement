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

export type TabType = 'home' | 'search' | 'activity' | 'profile';

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
