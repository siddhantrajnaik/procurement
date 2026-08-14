import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../lib/api';
import { isSupabaseConfigured } from '../lib/supabase';
import { User } from '../types';

interface AuthContextType {
  allUsers: User[];
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (userId: string) => void;
  logout: () => void;
  verifyAdminPin: (pin: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_USER_KEY = 'procure.session.userId';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    localStorage.getItem(SESSION_USER_KEY)
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void api.fetchUsers().then(setAllUsers).catch(() => {});
  }, []);

  const currentUser = useMemo(
    () => allUsers.find((u) => u.id === currentUserId) ?? null,
    [allUsers, currentUserId]
  );

  const login = useCallback((userId: string) => {
    localStorage.setItem(SESSION_USER_KEY, userId);
    setCurrentUserId(userId);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_USER_KEY);
    setCurrentUserId(null);
  }, []);

  const value: AuthContextType = useMemo(() => ({
    allUsers,
    currentUser,
    isAuthenticated: currentUser !== null,
    login,
    logout,
    verifyAdminPin: api.verifyAdminPin,
  }), [allUsers, currentUser, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
