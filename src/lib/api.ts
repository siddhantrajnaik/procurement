import { QUOTATION_BUCKET, supabase } from './supabase';
import {
  Activity,
  Comment,
  NewPurchaseInput,
  NewQuotationInput,
  Purchase,
  PurchaseStatus,
  Quotation,
  User,
} from '../types';

/** Quotes above this rupee amount need the PI to sign off before a PO is raised. */
export const PI_APPROVAL_THRESHOLD = 25_000;

const PROFILE_FIELDS = 'id, handle, name, role, accent, email, department';

const PURCHASE_SELECT = `
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    quotations: (row.quotations ?? []).map(toQuotation),
    comments: (row.comments ?? []).map(toComment),
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
  const data = unwrap(
    await supabase
      .from('purchases')
      .select(PURCHASE_SELECT)
      .order('created_at', { ascending: false })
      .order('created_at', { referencedTable: 'quotations', ascending: false })
      .order('created_at', { referencedTable: 'comments', ascending: true })
  );
  return (data as any[]).map(toPurchase);
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
      .select(PURCHASE_SELECT)
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
  let filePath: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;

  if (input.file) {
    const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    filePath = `${purchase.id}/${crypto.randomUUID()}-${safeName}`;

    const { error } = await supabase.storage
      .from(QUOTATION_BUCKET)
      .upload(filePath, input.file, { contentType: input.file.type, upsert: false });
    if (error) throw new Error(`Upload failed: ${error.message}`);

    fileName = input.file.name;
    fileSize = input.file.size;
  }

  const { error } = await supabase.from('quotations').insert({
    purchase_id: purchase.id,
    vendor: input.vendor,
    price: input.price,
    notes: input.notes || null,
    file_path: filePath,
    file_name: fileName,
    file_size: fileSize,
    uploaded_by: actor.id,
  });

  if (error) {
    // Don't leave an orphaned object in the bucket if the row insert failed.
    if (filePath) await supabase.storage.from(QUOTATION_BUCKET).remove([filePath]);
    throw new Error(error.message);
  }

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
    `uploaded a quotation from ${input.vendor} (₹${input.price.toLocaleString('en-IN')})`
  );
}

/** Signed URLs expire, so they're minted on demand rather than stored. */
export async function getQuotationFileUrl(filePath: string): Promise<string> {
  const data = unwrap(
    await supabase.storage.from(QUOTATION_BUCKET).createSignedUrl(filePath, 60 * 10)
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
