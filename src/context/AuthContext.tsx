import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../lib/api';
import { readStored, removeStored, writeStored } from '../lib/storage';
import { isSupabaseConfigured } from '../lib/supabase';
import { User } from '../types';

interface AuthContextType {
  allUsers: User[];
  /** True until the directory has been fetched once — an empty list means nothing yet. */
  usersLoading: boolean;
  /** Set when the fetch failed, which is not the same as the lab having no members. */
  usersError: string | null;
  reloadUsers: () => Promise<void>;
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (userId: string) => void;
  logout: () => void;
  verifyAdminPin: (pin: string) => Promise<boolean>;
  patchUser: (userId: string, patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_USER_KEY = 'procure.session.userId';

/**
 * The PI's private way in.
 *
 * GitHub Pages serves a single file with no server, so a hash is the only route
 * that survives a reload — and it keeps her off the main login screen entirely,
 * which is the point: she gets a link, not a name in the lab's list.
 *
 * This is a convenience, not a boundary. Every RLS policy is `using (true)` open
 * to `anon`, so the link controls which screen opens, not what is reachable.
 */
const PI_HASH_KEY = '#/lab-view-capsid';

/** Reads the hash without touching `window` during a render. */
function piLinkPresent(): boolean {
  try {
    return window.location.hash.trim().toLowerCase() === PI_HASH_KEY;
  } catch {
    return false;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(isSupabaseConfigured);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    readStored(SESSION_USER_KEY)
  );

  /**
   * The login screen renders as soon as there is no session, which is before
   * this resolves. Without a loading flag it briefly showed "no lab members
   * found — run the migration", and showed it permanently when the fetch failed,
   * since an error and an empty table look identical from the outside.
   */
  const loadUsers = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setUsersLoading(false);
      return;
    }
    setUsersLoading(true);
    setUsersError(null);
    try {
      setAllUsers(await api.fetchUsers());
    } catch (err) {
      setUsersError(
        err instanceof Error ? err.message : 'Could not reach the lab directory.'
      );
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const currentUser = useMemo(
    () => allUsers.find((u) => u.id === currentUserId) ?? null,
    [allUsers, currentUserId]
  );

  const login = useCallback((userId: string) => {
    writeStored(SESSION_USER_KEY, userId);
    setCurrentUserId(userId);
  }, []);

  /**
   * Sign the PI in from her link, then strip it from the address bar.
   *
   * She will open this in front of students and on shared screens, so a secret
   * left sitting in the URL is not one. The session is already in localStorage by
   * then, so clearing the hash costs nothing and a reload still keeps her in.
   *
   * The link deliberately overrides an existing session — if she borrows a
   * student's phone, opening it should switch to her rather than silently do
   * nothing. It waits for `allUsers` because the role lives on the profile row.
   */
  useEffect(() => {
    if (allUsers.length === 0) return;

    // The hash's own presence is the guard: a successful claim strips it, so
    // there is nothing left to re-claim. A separate "already handled" ref looked
    // equivalent and was not — it outlived the session it was set for, so after
    // she signed out her link was dead in that tab, on a login screen she is
    // deliberately not listed on. Worse, it returned *before* the strip below,
    // leaving the secret sitting in the address bar of whatever she was sharing.
    const claim = () => {
      if (!piLinkPresent()) return;

      const pi = allUsers.find((u) => u.role === 'pi');
      if (!pi) return; // migration 0025 has not been run yet

      login(pi.id);
      try {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch {
        /* a blocked history API is not worth failing the sign-in over */
      }
    };

    claim();
    // Changing only the hash does not reload a single-page app, so without this
    // the link silently does nothing when she opens it in a tab that is already
    // on the site — she would just be looking at the login screen wondering why.
    window.addEventListener('hashchange', claim);
    return () => window.removeEventListener('hashchange', claim);
  }, [allUsers, login]);

  const logout = useCallback(() => {
    removeStored(SESSION_USER_KEY);
    setCurrentUserId(null);
  }, []);

  const patchUser = useCallback((userId: string, patch: Partial<User>) => {
    setAllUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
  }, []);

  const value: AuthContextType = useMemo(() => ({
    allUsers,
    usersLoading,
    usersError,
    reloadUsers: loadUsers,
    currentUser,
    isAuthenticated: currentUser !== null,
    login,
    logout,
    verifyAdminPin: api.verifyAdminPin,
    patchUser,
  }), [allUsers, usersLoading, usersError, loadUsers, currentUser, login, logout, patchUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
