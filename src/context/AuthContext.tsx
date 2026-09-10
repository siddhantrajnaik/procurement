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
