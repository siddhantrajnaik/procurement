import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [toast, setToast] = useState<ToastInfo | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ id: `${Date.now()}`, message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const value: UIContextType = useMemo(() => ({
    activeTab,
    setActiveTab,
    isCreateModalOpen,
    setIsCreateModalOpen,
    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    toast,
    showToast,
  }), [activeTab, isCreateModalOpen, searchQuery, filterStatus, toast, showToast]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within a UIProvider');
  return context;
};
