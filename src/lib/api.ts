import { INVOICE_BUCKET, QUOTATION_BUCKET, supabase } from './supabase';
import {
  Activity,
  BookableItem,
  Booking,
  Comment,
  Equipment,
  EquipmentIssue,
  EquipmentStatus,
  InventoryItem,
  InventoryLogEntry,
  IssueResponse,
  IssueStatus,
  LabList,
  ListColumn,
  ListItem,
  LostFoundItem,
  LostFoundResponse,
  LostFoundStatus,
  MaintenanceLog,
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
  User,
  Vendor,
} from '../types';

/** Quotes above this rupee amount need the PI to sign off before a PO is raised. */
export const PI_APPROVAL_THRESHOLD = 25_000;

const PROFILE_FIELDS = 'id, handle, name, role, accent, email, department, birthday';

const PURCHASE_BASE_SELECT = `
  id, title, description, quantity, category, priority, status, preferred_company,
  requires_pi_approval, pi_approved, created_at, updated_at,
  requester:profiles!purchases_requested_by_fkey(${PROFILE_FIELDS}),
  assignee:profiles!purchases_assigned_to_fkey(${PROFILE_FIELDS}),
  quotations(
    id, purchase_id, vendor, price, currency, notes, file_path, file_name, file_size,
    is_approved, is_recommended, created_at,
    uploader:profiles!quotations_uploaded_by_fkey(${PROFILE_FIELDS})
  ),
  comments(
    id, purchase_id, body, created_at,
    author:profiles!comments_author_id_fkey(${PROFILE_FIELDS})
  )
`;

const PURCHASE_INVOICE_FIELDS = `
  invoice_path, invoice_name, invoice_size, invoice_uploaded_at,
  invoice_uploader:profiles!purchases_invoice_uploaded_by_fkey(${PROFILE_FIELDS}),
`;

const PURCHASE_SELECT = PURCHASE_INVOICE_FIELDS + PURCHASE_BASE_SELECT;

/**
 * Migration 0006 adds the invoice columns. Until it has been run they don't
 * exist, and selecting them would 400 the whole feed — so the first failure
 * latches this flag and every later query uses the legacy shape.
 */
let invoiceColumnsAvailable = true;

function purchaseSelect(): string {
  return invoiceColumnsAvailable ? PURCHASE_SELECT : PURCHASE_BASE_SELECT;
}

const ACTIVITY_SELECT = `
  id, purchase_id, purchase_title, type, details, created_at,
  actor:profiles!activities_actor_id_fkey(${PROFILE_FIELDS})
`;

// PostgREST returns embedded one-to-one relations as an object, but the generated
// types widen them to arrays in some versions — normalise to a single row.
function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toUser(row: any): User | null {
  const r = one<any>(row);
  if (!r) return null;
  return {
    id: r.id,
    handle: r.handle,
    name: r.name,
    role: r.role,
    accent: r.accent,
    email: r.email,
    department: r.department,
    birthday: r.birthday ?? null,
  };
}

function toQuotation(row: any): Quotation {
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    vendor: row.vendor,
    price: Number(row.price),
    currency: row.currency,
    notes: row.notes,
    filePath: row.file_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    isApproved: row.is_approved,
    isRecommended: row.is_recommended,
    uploadedBy: toUser(row.uploader),
    createdAt: row.created_at,
  };
}

function toComment(row: any): Comment {
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    author: toUser(row.author),
    body: row.body,
    createdAt: row.created_at,
  };
}

function toPurchase(row: any): Purchase {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    quantity: row.quantity,
    category: row.category,
    priority: row.priority,
    status: row.status,
    preferredCompany: row.preferred_company,
    requestedBy: toUser(row.requester),
    assignedTo: toUser(row.assignee),
    requiresPiApproval: row.requires_pi_approval,
    piApproved: row.pi_approved,
    invoicePath: row.invoice_path ?? null,
    invoiceName: row.invoice_name ?? null,
    invoiceSize: row.invoice_size != null ? Number(row.invoice_size) : null,
    invoiceUploadedBy: toUser(row.invoice_uploader),
    invoiceUploadedAt: row.invoice_uploaded_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    quotations: dedupById((row.quotations ?? []).map(toQuotation)),
    comments: dedupById((row.comments ?? []).map(toComment)),
  };
}

function toActivity(row: any): Activity {
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    purchaseTitle: row.purchase_title,
    actor: toUser(row.actor),
    type: row.type,
    details: row.details,
    createdAt: row.created_at,
  };
}

function dedupById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// ------------------------------------------------------------------ reads

export async function fetchUsers(): Promise<User[]> {
  const data = unwrap(
    await supabase.from('profiles').select(PROFILE_FIELDS).order('name', { ascending: true })
  );
  return (data as any[]).map((r) => toUser(r)!).filter(Boolean);
}

export async function fetchPurchases(): Promise<Purchase[]> {
  const query = () =>
    supabase
      .from('purchases')
      .select(purchaseSelect())
      .order('created_at', { ascending: false })
      .order('created_at', { referencedTable: 'quotations', ascending: false })
      .order('created_at', { referencedTable: 'comments', ascending: true });

  let result = await query();

  // Retry once without the invoice columns if migration 0006 hasn't been run.
  if (result.error && invoiceColumnsAvailable) {
    invoiceColumnsAvailable = false;
    result = await query();
  }

  return (unwrap(result) as any[]).map(toPurchase);
}

export async function fetchActivities(limit = 60): Promise<Activity[]> {
  const data = unwrap(
    await supabase
      .from('activities')
      .select(ACTIVITY_SELECT)
      .order('created_at', { ascending: false })
      .limit(limit)
  );
  return (data as any[]).map(toActivity);
}

export async function updateBirthday(userId: string, birthday: string | null): Promise<void> {
  unwrap(
    await supabase.from('profiles').update({ birthday }).eq('id', userId)
  );
}

// ------------------------------------------------------------------ writes

async function logActivity(
  purchaseId: string,
  purchaseTitle: string,
  actorId: string,
  type: Activity['type'],
  details: string
): Promise<void> {
  const { error } = await supabase.from('activities').insert({
    purchase_id: purchaseId,
    purchase_title: purchaseTitle,
    actor_id: actorId,
    type,
    details,
  });
  // An audit-log write failing should not roll back the user's actual action.
  if (error) console.error('Failed to record activity:', error.message);
}

export async function createPurchase(input: NewPurchaseInput, actor: User): Promise<Purchase> {
  const inserted = unwrap(
    await supabase
      .from('purchases')
      .insert({
        title: input.title,
        description: input.description,
        quantity: input.quantity,
        category: input.category,
        priority: input.priority,
        preferred_company: input.preferredCompany || null,
        requested_by: actor.id,
      })
      .select(purchaseSelect())
      .single()
  );

  const purchase = toPurchase(inserted);
  await logActivity(purchase.id, purchase.title, actor.id, 'created', 'raised a new purchase request');
  return purchase;
}

export async function updatePurchaseStatus(
  purchase: Purchase,
  status: PurchaseStatus,
  actor: User
): Promise<void> {
  unwrap(await supabase.from('purchases').update({ status }).eq('id', purchase.id).select('id'));
  await logActivity(
    purchase.id,
    purchase.title,
    actor.id,
    'status_changed',
    `moved the request to ${STATUS_LABELS[status]}`
  );
}

export async function updatePurchaseFields(
  purchaseId: string,
  updates: Partial<NewPurchaseInput>
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.description !== undefined) row.description = updates.description;
  if (updates.quantity !== undefined) row.quantity = updates.quantity;
  if (updates.category !== undefined) row.category = updates.category;
  if (updates.priority !== undefined) row.priority = updates.priority;
  if (updates.preferredCompany !== undefined) row.preferred_company = updates.preferredCompany || null;
  unwrap(
    await supabase.from('purchases').update(row).eq('id', purchaseId).select('id')
  );
}

export async function deletePurchase(purchaseId: string): Promise<void> {
  const { error } = await supabase.from('purchases').delete().eq('id', purchaseId);
  if (error) throw new Error(error.message);
}

export async function addComment(purchase: Purchase, body: string, actor: User): Promise<void> {
  unwrap(
    await supabase
      .from('comments')
      .insert({ purchase_id: purchase.id, author_id: actor.id, body })
      .select('id')
  );
  await logActivity(purchase.id, purchase.title, actor.id, 'comment_added', 'replied in the thread');
}

export async function approvePi(purchase: Purchase, actor: User): Promise<void> {
  unwrap(
    await supabase.from('purchases').update({ pi_approved: true }).eq('id', purchase.id).select('id')
  );
  await logActivity(purchase.id, purchase.title, actor.id, 'pi_approved', 'approved the expenditure');
}

export async function selectQuotation(
  purchase: Purchase,
  quotation: Quotation,
  actor: User
): Promise<void> {
  // The partial unique index allows only one approved quote per purchase, so the
  // others must be cleared before the new one is set.
  unwrap(
    await supabase
      .from('quotations')
      .update({ is_approved: false })
      .eq('purchase_id', purchase.id)
      .neq('id', quotation.id)
      .select('id')
  );
  unwrap(
    await supabase.from('quotations').update({ is_approved: true }).eq('id', quotation.id).select('id')
  );
  unwrap(
    await supabase.from('purchases').update({ status: 'ordered' }).eq('id', purchase.id).select('id')
  );

  await logActivity(
    purchase.id,
    purchase.title,
    actor.id,
    'status_changed',
    `selected ${quotation.vendor} for the purchase order`
  );
}

export async function addQuotation(
  purchase: Purchase,
  input: NewQuotationInput,
  actor: User
): Promise<void> {
  const { error } = await supabase.from('quotations').insert({
    purchase_id: purchase.id,
    vendor: input.vendor,
    price: input.price,
    notes: input.notes || null,
    uploaded_by: actor.id,
  });

  if (error) throw new Error(error.message);

  if (purchase.status === 'waiting') {
    await supabase.from('purchases').update({ status: 'quotes' }).eq('id', purchase.id);
  }
  if (input.price > PI_APPROVAL_THRESHOLD && !purchase.requiresPiApproval) {
    await supabase.from('purchases').update({ requires_pi_approval: true }).eq('id', purchase.id);
  }

  await logActivity(
    purchase.id,
    purchase.title,
    actor.id,
    'quote_added',
    `recorded a quotation from ${input.vendor} (₹${input.price.toLocaleString('en-IN')})`
  );
}

/** Signed URLs expire, so they're minted on demand rather than stored. */
export async function getQuotationFileUrl(filePath: string): Promise<string> {
  const data = unwrap(
    await supabase.storage.from(QUOTATION_BUCKET).createSignedUrl(filePath, 60 * 10)
  );
  return (data as { signedUrl: string }).signedUrl;
}

// ------------------------------------------------------------------ invoices

/** Images are compressed by the caller before they reach this. */
export async function uploadInvoice(
  purchase: Purchase,
  file: File,
  actor: User
): Promise<void> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${purchase.id}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(INVOICE_BUCKET)
    .upload(filePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { error } = await supabase
    .from('purchases')
    .update({
      invoice_path: filePath,
      invoice_name: file.name,
      invoice_size: file.size,
      invoice_uploaded_by: actor.id,
      invoice_uploaded_at: new Date().toISOString(),
    })
    .eq('id', purchase.id);

  if (error) {
    // Don't leave an orphaned object in the bucket if the row update failed.
    await supabase.storage.from(INVOICE_BUCKET).remove([filePath]);
    throw new Error(error.message);
  }

  // Replacing an invoice leaves the old object behind otherwise.
  if (purchase.invoicePath && purchase.invoicePath !== filePath) {
    await supabase.storage.from(INVOICE_BUCKET).remove([purchase.invoicePath]);
  }

  await logActivity(purchase.id, purchase.title, actor.id, 'comment_added', 'attached the delivery invoice');
}

export async function removeInvoice(purchase: Purchase): Promise<void> {
  if (purchase.invoicePath) {
    await supabase.storage.from(INVOICE_BUCKET).remove([purchase.invoicePath]);
  }
  unwrap(
    await supabase
      .from('purchases')
      .update({
        invoice_path: null,
        invoice_name: null,
        invoice_size: null,
        invoice_uploaded_by: null,
        invoice_uploaded_at: null,
      })
      .eq('id', purchase.id)
      .select('id')
  );
}

export async function getInvoiceFileUrl(filePath: string): Promise<string> {
  const data = unwrap(
    await supabase.storage.from(INVOICE_BUCKET).createSignedUrl(filePath, 60 * 10)
  );
  return (data as { signedUrl: string }).signedUrl;
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_admin_pin', { pin });
  if (error) throw new Error(error.message);
  return data === true;
}

export const STATUS_LABELS: Record<PurchaseStatus, string> = {
  waiting: 'Waiting for quotes',
  quotes: 'Quotes received',
  ordered: 'Ordered',
  transit: 'In transit',
  delivered: 'Delivered',
  closed: 'Closed',
};

// ------------------------------------------------------------------ inventory

const INVENTORY_ITEM_SELECT = `
  id, name, category, quantity, unit, location, low_stock_threshold, notes,
  linked_purchase_id, created_at, updated_at,
  added_by_profile:profiles!inventory_items_added_by_fkey(${PROFILE_FIELDS})
`;

const INVENTORY_LOG_SELECT = `
  id, item_id, item_name, action, quantity_change, old_location, new_location,
  notes, created_at,
  actor:profiles!inventory_log_actor_id_fkey(${PROFILE_FIELDS})
`;

function toInventoryItem(row: any): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: Number(row.quantity),
    unit: row.unit,
    location: row.location,
    lowStockThreshold: row.low_stock_threshold != null ? Number(row.low_stock_threshold) : null,
    notes: row.notes,
    linkedPurchaseId: row.linked_purchase_id,
    addedBy: toUser(row.added_by_profile),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toInventoryLogEntry(row: any): InventoryLogEntry {
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    action: row.action,
    quantityChange: row.quantity_change != null ? Number(row.quantity_change) : null,
    oldLocation: row.old_location,
    newLocation: row.new_location,
    actor: toUser(row.actor),
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function fetchInventoryItems(): Promise<InventoryItem[]> {
  const data = unwrap(
    await supabase
      .from('inventory_items')
      .select(INVENTORY_ITEM_SELECT)
      .order('updated_at', { ascending: false })
  );
  return (data as any[]).map(toInventoryItem);
}

export async function fetchInventoryLog(limit = 100): Promise<InventoryLogEntry[]> {
  const data = unwrap(
    await supabase
      .from('inventory_log')
      .select(INVENTORY_LOG_SELECT)
      .order('created_at', { ascending: false })
      .limit(limit)
  );
  return (data as any[]).map(toInventoryLogEntry);
}

async function logInventoryAction(
  itemId: string,
  itemName: string,
  action: InventoryLogEntry['action'],
  actorId: string,
  opts: { quantityChange?: number; oldLocation?: string; newLocation?: string; notes?: string } = {}
): Promise<void> {
  const { error } = await supabase.from('inventory_log').insert({
    item_id: itemId,
    item_name: itemName,
    action,
    quantity_change: opts.quantityChange ?? null,
    old_location: opts.oldLocation ?? null,
    new_location: opts.newLocation ?? null,
    actor_id: actorId,
    notes: opts.notes ?? null,
  });
  if (error) console.error('Failed to log inventory action:', error.message);
}

export async function addInventoryItem(
  input: NewInventoryItemInput,
  actor: User
): Promise<InventoryItem> {
  const inserted = unwrap(
    await supabase
      .from('inventory_items')
      .insert({
        name: input.name,
        category: input.category,
        quantity: input.quantity,
        unit: input.unit,
        location: input.location,
        low_stock_threshold: input.lowStockThreshold ?? null,
        notes: input.notes || null,
        added_by: actor.id,
      })
      .select(INVENTORY_ITEM_SELECT)
      .single()
  );
  const item = toInventoryItem(inserted);
  await logInventoryAction(item.id, item.name, 'added', actor.id, {
    quantityChange: input.quantity,
    newLocation: input.location,
    notes: input.notes,
  });
  return item;
}

export async function consumeInventoryItem(
  item: InventoryItem,
  quantity: number,
  actor: User,
  notes?: string
): Promise<void> {
  const newQty = Math.max(0, item.quantity - quantity);
  unwrap(
    await supabase
      .from('inventory_items')
      .update({ quantity: newQty })
      .eq('id', item.id)
      .select('id')
  );
  await logInventoryAction(item.id, item.name, 'consumed', actor.id, {
    quantityChange: -quantity,
    notes,
  });
}

export async function restockInventoryItem(
  item: InventoryItem,
  quantity: number,
  actor: User,
  notes?: string
): Promise<void> {
  const newQty = item.quantity + quantity;
  unwrap(
    await supabase
      .from('inventory_items')
      .update({ quantity: newQty })
      .eq('id', item.id)
      .select('id')
  );
  await logInventoryAction(item.id, item.name, 'restocked', actor.id, {
    quantityChange: quantity,
    notes,
  });
}

export async function moveInventoryItem(
  item: InventoryItem,
  newLocation: string,
  actor: User,
  notes?: string
): Promise<void> {
  unwrap(
    await supabase
      .from('inventory_items')
      .update({ location: newLocation })
      .eq('id', item.id)
      .select('id')
  );
  await logInventoryAction(item.id, item.name, 'moved', actor.id, {
    oldLocation: item.location,
    newLocation,
    notes,
  });
}

export async function updateInventoryItem(
  item: InventoryItem,
  updates: Partial<Pick<NewInventoryItemInput, 'name' | 'category' | 'quantity' | 'unit' | 'location' | 'lowStockThreshold' | 'notes'>>,
  actor: User
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.category !== undefined) row.category = updates.category;
  if (updates.quantity !== undefined) row.quantity = updates.quantity;
  if (updates.unit !== undefined) row.unit = updates.unit;
  if (updates.location !== undefined) row.location = updates.location;
  if (updates.lowStockThreshold !== undefined) row.low_stock_threshold = updates.lowStockThreshold;
  if (updates.notes !== undefined) row.notes = updates.notes || null;

  unwrap(
    await supabase
      .from('inventory_items')
      .update(row)
      .eq('id', item.id)
      .select('id')
  );
  await logInventoryAction(item.id, updates.name ?? item.name, 'adjusted', actor.id, {
    quantityChange: updates.quantity !== undefined ? updates.quantity - item.quantity : undefined,
    oldLocation: updates.location !== undefined ? item.location : undefined,
    newLocation: updates.location,
  });
}

export async function deleteInventoryItem(id: string, itemName: string, actor: User): Promise<void> {
  await logInventoryAction(id, itemName, 'removed', actor.id);
  const { error } = await supabase.from('inventory_items').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------------ vendors

const VENDOR_SELECT = `
  id, name, type, comment, contact, photo_url, created_at, updated_at,
  created_by_profile:profiles!vendors_created_by_fkey(${PROFILE_FIELDS})
`;

function toVendor(row: any): Vendor {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    comment: row.comment ?? '',
    contact: row.contact ?? '',
    photoUrl: row.photo_url,
    createdBy: toUser(row.created_by_profile),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchVendors(): Promise<Vendor[]> {
  const data = unwrap(
    await supabase
      .from('vendors')
      .select(VENDOR_SELECT)
      .order('name', { ascending: true })
  );
  return (data as any[]).map(toVendor);
}

export async function addVendor(input: NewVendorInput, actor: User): Promise<Vendor> {
  const inserted = unwrap(
    await supabase
      .from('vendors')
      .insert({
        name: input.name,
        type: input.type,
        comment: input.comment || '',
        contact: input.contact || '',
        photo_url: input.photoUrl || null,
        created_by: actor.id,
      })
      .select(VENDOR_SELECT)
      .single()
  );
  return toVendor(inserted);
}

export async function updateVendor(
  vendorId: string,
  updates: Partial<NewVendorInput>
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.comment !== undefined) row.comment = updates.comment;
  if (updates.contact !== undefined) row.contact = updates.contact;
  if (updates.photoUrl !== undefined) row.photo_url = updates.photoUrl || null;
  unwrap(
    await supabase.from('vendors').update(row).eq('id', vendorId).select('id')
  );
}

export async function deleteVendor(vendorId: string): Promise<void> {
  const { error } = await supabase.from('vendors').delete().eq('id', vendorId);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------------ lost & found

const LOST_FOUND_SELECT = `
  id, title, description, location_last_seen, status, created_at, updated_at,
  reporter:profiles!lost_found_items_reported_by_fkey(${PROFILE_FIELDS}),
  resolver:profiles!lost_found_items_resolved_by_fkey(${PROFILE_FIELDS}),
  lost_found_responses(
    id, item_id, body, created_at,
    author:profiles!lost_found_responses_author_id_fkey(${PROFILE_FIELDS})
  )
`;

function toLostFoundResponse(row: any): LostFoundResponse {
  return {
    id: row.id,
    itemId: row.item_id,
    author: toUser(row.author),
    body: row.body,
    createdAt: row.created_at,
  };
}

function toLostFoundItem(row: any): LostFoundItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    locationLastSeen: row.location_last_seen ?? '',
    status: row.status,
    reportedBy: toUser(row.reporter),
    resolvedBy: toUser(row.resolver),
    responses: dedupById((row.lost_found_responses ?? []).map(toLostFoundResponse)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchLostFoundItems(): Promise<LostFoundItem[]> {
  const data = unwrap(
    await supabase
      .from('lost_found_items')
      .select(LOST_FOUND_SELECT)
      .order('created_at', { ascending: false })
      .order('created_at', { referencedTable: 'lost_found_responses', ascending: true })
  );
  return (data as any[]).map(toLostFoundItem);
}

export async function reportLostItem(input: NewLostFoundInput, actor: User): Promise<LostFoundItem> {
  const inserted = unwrap(
    await supabase
      .from('lost_found_items')
      .insert({
        title: input.title,
        description: input.description || '',
        location_last_seen: input.locationLastSeen || '',
        reported_by: actor.id,
      })
      .select(LOST_FOUND_SELECT)
      .single()
  );
  return toLostFoundItem(inserted);
}

export async function addLostFoundResponse(
  itemId: string,
  body: string,
  actor: User
): Promise<void> {
  unwrap(
    await supabase
      .from('lost_found_responses')
      .insert({ item_id: itemId, author_id: actor.id, body })
      .select('id')
  );
}

export async function updateLostFoundStatus(
  itemId: string,
  status: LostFoundStatus,
  actor: User
): Promise<void> {
  const row: Record<string, unknown> = { status };
  if (status === 'resolved' || status === 'found') row.resolved_by = actor.id;
  unwrap(
    await supabase.from('lost_found_items').update(row).eq('id', itemId).select('id')
  );
}

export async function deleteLostFoundItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('lost_found_items').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------------ lists

const LIST_SELECT = `
  id, title, description, columns, created_at, updated_at,
  creator:profiles!lists_created_by_fkey(${PROFILE_FIELDS}),
  list_items(
    id, list_id, name, checked, data, sort_order, created_at
  )
`;

function toListItem(row: any): ListItem {
  return {
    id: row.id,
    listId: row.list_id,
    name: row.name,
    checked: row.checked,
    data: row.data ?? {},
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function toLabList(row: any): LabList {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    columns: (row.columns ?? []) as ListColumn[],
    items: dedupById((row.list_items ?? []).map(toListItem)),
    createdBy: toUser(row.creator),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchLists(): Promise<LabList[]> {
  const data = unwrap(
    await supabase
      .from('lists')
      .select(LIST_SELECT)
      .order('created_at', { ascending: false })
      .order('sort_order', { referencedTable: 'list_items', ascending: true })
  );
  return (data as any[]).map(toLabList);
}

export async function createList(input: NewListInput, actor: User): Promise<LabList> {
  const inserted = unwrap(
    await supabase
      .from('lists')
      .insert({
        title: input.title,
        description: input.description || '',
        created_by: actor.id,
      })
      .select(LIST_SELECT)
      .single()
  );
  return toLabList(inserted);
}

export async function updateList(
  listId: string,
  updates: { title?: string; description?: string; columns?: ListColumn[] }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.description !== undefined) row.description = updates.description;
  if (updates.columns !== undefined) row.columns = updates.columns;
  unwrap(
    await supabase.from('lists').update(row).eq('id', listId).select('id')
  );
}

export async function deleteList(listId: string): Promise<void> {
  const { error } = await supabase.from('lists').delete().eq('id', listId);
  if (error) throw new Error(error.message);
}

export async function addListItem(
  listId: string,
  input: NewListItemInput,
  sortOrder: number
): Promise<void> {
  unwrap(
    await supabase
      .from('list_items')
      .insert({
        list_id: listId,
        name: input.name,
        data: input.data ?? {},
        sort_order: sortOrder,
      })
      .select('id')
  );
}

export async function updateListItem(
  itemId: string,
  updates: { name?: string; checked?: boolean; data?: Record<string, unknown>; sort_order?: number }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.checked !== undefined) row.checked = updates.checked;
  if (updates.data !== undefined) row.data = updates.data;
  if (updates.sort_order !== undefined) row.sort_order = updates.sort_order;
  unwrap(
    await supabase.from('list_items').update(row).eq('id', itemId).select('id')
  );
}

export async function deleteListItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('list_items').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------------ equipment

const EQUIPMENT_SELECT = `
  id, name, model, manufacturer, category, location, status, photo_url,
  purchase_date, warranty_expiry, service_vendor, service_contact_person,
  service_phone, notes, created_at, updated_at,
  added_by:profiles!equipment_added_by_fkey(${PROFILE_FIELDS}),
  issues:equipment_issues(
    id, equipment_id, title, description, status, fix_summary, fixed_by,
    fix_cost, created_at, resolved_at,
    reporter:profiles!equipment_issues_reported_by_fkey(${PROFILE_FIELDS}),
    responses:issue_responses(
      id, issue_id, body, created_at,
      author:profiles!issue_responses_author_id_fkey(${PROFILE_FIELDS})
    )
  ),
  maintenance:maintenance_logs(
    id, equipment_id, performed_by, description, cost, service_date,
    next_due_date, created_at,
    logger:profiles!maintenance_logs_logged_by_fkey(${PROFILE_FIELDS})
  )
`;

function toIssueResponse(row: any): IssueResponse {
  return {
    id: row.id,
    issueId: row.issue_id,
    author: toUser(row.author),
    body: row.body,
    createdAt: row.created_at,
  };
}

function toIssue(row: any): EquipmentIssue {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    reportedBy: toUser(row.reporter),
    title: row.title,
    description: row.description,
    status: row.status,
    fixSummary: row.fix_summary,
    fixedBy: row.fixed_by,
    fixCost: row.fix_cost != null ? Number(row.fix_cost) : null,
    responses: (row.responses ?? []).map(toIssueResponse),
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function toMaintenanceLog(row: any): MaintenanceLog {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    performedBy: row.performed_by,
    description: row.description,
    cost: row.cost != null ? Number(row.cost) : null,
    serviceDate: row.service_date,
    nextDueDate: row.next_due_date,
    loggedBy: toUser(row.logger),
    createdAt: row.created_at,
  };
}

function toEquipment(row: any): Equipment {
  return {
    id: row.id,
    name: row.name,
    model: row.model,
    manufacturer: row.manufacturer,
    category: row.category,
    location: row.location,
    status: row.status,
    photoUrl: row.photo_url,
    purchaseDate: row.purchase_date,
    warrantyExpiry: row.warranty_expiry,
    serviceVendor: row.service_vendor,
    serviceContactPerson: row.service_contact_person,
    servicePhone: row.service_phone,
    notes: row.notes,
    addedBy: toUser(row.added_by),
    issues: (row.issues ?? []).map(toIssue),
    maintenanceLogs: (row.maintenance ?? []).map(toMaintenanceLog),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchEquipment(): Promise<Equipment[]> {
  const rows = unwrap(
    await supabase
      .from('equipment')
      .select(EQUIPMENT_SELECT)
      .order('name')
  );
  return rows.map(toEquipment);
}

export async function addEquipment(
  input: NewEquipmentInput,
  userId: string
): Promise<Equipment> {
  const row = unwrap(
    await supabase
      .from('equipment')
      .insert({
        name: input.name,
        model: input.model ?? '',
        manufacturer: input.manufacturer ?? '',
        category: input.category ?? 'other',
        location: input.location ?? '',
        service_vendor: input.serviceVendor ?? '',
        service_contact_person: input.serviceContactPerson ?? '',
        service_phone: input.servicePhone ?? '',
        notes: input.notes ?? '',
        purchase_date: input.purchaseDate || null,
        warranty_expiry: input.warrantyExpiry || null,
        added_by: userId,
      })
      .select(EQUIPMENT_SELECT)
      .single()
  );
  return toEquipment(row);
}

export async function updateEquipment(
  equipmentId: string,
  updates: Partial<NewEquipmentInput> & { status?: EquipmentStatus }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.model !== undefined) row.model = updates.model;
  if (updates.manufacturer !== undefined) row.manufacturer = updates.manufacturer;
  if (updates.category !== undefined) row.category = updates.category;
  if (updates.location !== undefined) row.location = updates.location;
  if (updates.serviceVendor !== undefined) row.service_vendor = updates.serviceVendor;
  if (updates.serviceContactPerson !== undefined) row.service_contact_person = updates.serviceContactPerson;
  if (updates.servicePhone !== undefined) row.service_phone = updates.servicePhone;
  if (updates.notes !== undefined) row.notes = updates.notes;
  if (updates.purchaseDate !== undefined) row.purchase_date = updates.purchaseDate || null;
  if (updates.warrantyExpiry !== undefined) row.warranty_expiry = updates.warrantyExpiry || null;
  if (updates.status !== undefined) row.status = updates.status;
  unwrap(
    await supabase.from('equipment').update(row).eq('id', equipmentId).select('id')
  );
}

export async function deleteEquipment(equipmentId: string): Promise<void> {
  const { error } = await supabase.from('equipment').delete().eq('id', equipmentId);
  if (error) throw new Error(error.message);
}

export async function reportIssue(
  equipmentId: string,
  input: NewIssueInput,
  userId: string
): Promise<void> {
  unwrap(
    await supabase.from('equipment_issues').insert({
      equipment_id: equipmentId,
      reported_by: userId,
      title: input.title,
      description: input.description ?? '',
    }).select('id')
  );
}

export async function updateIssueStatus(
  issueId: string,
  status: IssueStatus,
  fixSummary?: string,
  fixedBy?: string,
  fixCost?: number
): Promise<void> {
  const row: Record<string, unknown> = { status };
  if (fixSummary !== undefined) row.fix_summary = fixSummary;
  if (fixedBy !== undefined) row.fixed_by = fixedBy;
  if (fixCost !== undefined) row.fix_cost = fixCost;
  if (status === 'fixed') row.resolved_at = new Date().toISOString();
  unwrap(
    await supabase.from('equipment_issues').update(row).eq('id', issueId).select('id')
  );
}

export async function addIssueResponse(
  issueId: string,
  body: string,
  userId: string
): Promise<void> {
  unwrap(
    await supabase.from('issue_responses').insert({
      issue_id: issueId,
      author_id: userId,
      body,
    }).select('id')
  );
}

export async function addMaintenanceLog(
  equipmentId: string,
  input: NewMaintenanceInput,
  userId: string
): Promise<void> {
  unwrap(
    await supabase.from('maintenance_logs').insert({
      equipment_id: equipmentId,
      performed_by: input.performedBy ?? '',
      description: input.description,
      cost: input.cost ?? null,
      service_date: input.serviceDate ?? new Date().toISOString().slice(0, 10),
      next_due_date: input.nextDueDate || null,
      logged_by: userId,
    }).select('id')
  );
}

// ------------------------------------------------------------------ bookings

const BOOKABLE_ITEM_SELECT = `
  id, name, description, color, created_at, updated_at,
  creator:profiles!bookable_items_created_by_fkey(${PROFILE_FIELDS})
`;

const BOOKING_SELECT = `
  id, item_id, date, start_time, end_time, purpose, status, created_at,
  booker:profiles!bookings_booked_by_fkey(${PROFILE_FIELDS})
`;

function toBookableItem(row: any): BookableItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    color: row.color,
    createdBy: toUser(row.creator),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toBooking(row: any): Booking {
  return {
    id: row.id,
    itemId: row.item_id,
    bookedBy: toUser(row.booker),
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    purpose: row.purpose ?? '',
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function fetchBookableItems(): Promise<BookableItem[]> {
  const data = unwrap(
    await supabase
      .from('bookable_items')
      .select(BOOKABLE_ITEM_SELECT)
      .order('name')
  );
  return (data as any[]).map(toBookableItem);
}

export async function addBookableItem(
  input: NewBookableItemInput,
  userId: string
): Promise<BookableItem> {
  const row = unwrap(
    await supabase
      .from('bookable_items')
      .insert({
        name: input.name,
        description: input.description || '',
        color: input.color || '#8B5CF6',
        created_by: userId,
      })
      .select(BOOKABLE_ITEM_SELECT)
      .single()
  );
  return toBookableItem(row);
}

export async function deleteBookableItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('bookable_items').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function fetchBookings(dateFrom?: string, dateTo?: string): Promise<Booking[]> {
  let query = supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('status', 'confirmed')
    .order('date')
    .order('start_time');

  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);

  const data = unwrap(await query);
  return (data as any[]).map(toBooking);
}

export async function createBooking(
  input: NewBookingInput,
  userId: string
): Promise<Booking> {
  const row = unwrap(
    await supabase
      .from('bookings')
      .insert({
        item_id: input.itemId,
        booked_by: userId,
        date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        purpose: input.purpose || '',
      })
      .select(BOOKING_SELECT)
      .single()
  );
  return toBooking(row);
}

export async function cancelBooking(bookingId: string): Promise<void> {
  unwrap(
    await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .select('id')
  );
}
