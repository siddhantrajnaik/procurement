import { useAuth } from '../context/AuthContext';

/**
 * Whether the current viewer may only look.
 *
 * The PI reaches the lab's own screens — equipment, vendors, samples — from her
 * dashboard, and sees exactly what a member sees. What she must not have is the
 * write controls that sit on those screens: Add Equipment, Delete Vendor, delete
 * a sample box. Her screen is a read-only view of the lab by design, and a row
 * deleted from a demo is gone for all thirteen people with no undo.
 *
 * Stated as a hook rather than a prop threaded through four components because a
 * prop is something a future call site can forget to pass; a role check cannot
 * be forgotten. Note this is presentation only — like every other boundary in
 * this app, the RLS underneath is open.
 */
export function useReadOnly(): boolean {
  const { currentUser } = useAuth();
  return currentUser?.role === 'pi';
}
