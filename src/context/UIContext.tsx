import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initSound, playSound } from '../lib/sound';
import { TabType } from '../types';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastInfo {
  id: string;
  message: string;
  type: ToastType;
}

interface UIContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  /** Bumped when the already-active tab is tapped, to reset it to its root. */
  tabResetNonce: number;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  toast: ToastInfo | null;
  showToast: (msg: string, type?: ToastType) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTabState] = useState<TabType>('home');
  const [tabResetNonce, setTabResetNonce] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [toast, setToast] = useState<ToastInfo | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastSeq = useRef(0);

  // Read through a ref so the callback stays stable while still knowing which
  // tab is showing — tapping the active tab means "go back to its root".
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const setActiveTab = useCallback((tab: TabType) => {
    if (activeTabRef.current === tab) {
      setTabResetNonce((n) => n + 1);
    } else {
      setActiveTabState(tab);
    }
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    // A timestamp alone collides when two toasts fire in the same millisecond,
    // which makes AnimatePresence skip the swap.
    toastSeq.current += 1;
    setToast({ id: `${Date.now()}-${toastSeq.current}`, message, type });
    playSound(type);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => { initSound(); }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const value: UIContextType = useMemo(() => ({
    activeTab,
    setActiveTab,
    tabResetNonce,
    isCreateModalOpen,
    setIsCreateModalOpen,
    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    toast,
    showToast,
  }), [activeTab, setActiveTab, tabResetNonce, isCreateModalOpen, searchQuery, filterStatus, toast, showToast]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within a UIProvider');
  return context;
};
