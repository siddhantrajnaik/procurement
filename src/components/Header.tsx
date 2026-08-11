import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { avatarClasses } from '../lib/accent';
import { initialOf, roleLabel } from '../lib/format';

export const Header: React.FC = () => {
  const { currentUser, logout, setIsCreateModalOpen } = useApp();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isMenuOpen]);

  if (!currentUser) return null;

  return (
    <header className="flex justify-between items-center h-16 px-4 md:px-6 w-full sticky top-0 z-50 bg-background border-b border-[#2A2A2A]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-[18px]">biotech</span>
        </div>
        <span className="font-bold text-lg text-white tracking-tight">MB Lab</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            className="text-sm font-medium text-gray-200 bg-[#1E1E1E] px-3 py-1.5 rounded-md border border-[#2A2A2A] flex items-center gap-2 hover:bg-[#2A2A2A] transition-colors"
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${avatarClasses(currentUser.accent)}`}
            >
              {initialOf(currentUser.name)}
            </div>
            {currentUser.name}
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 bg-[#1E1E1E] border border-[#2A2A2A] shadow-lg rounded-md overflow-hidden z-50 p-1"
            >
              <div className="px-3 py-2 border-b border-[#2A2A2A] mb-1">
                <p className="text-xs font-semibold text-white truncate">{currentUser.name}</p>
                <p className="text-[11px] text-gray-400">{roleLabel(currentUser.role)}</p>
              </div>
              <button
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-400/10 rounded transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sign out
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="text-white font-medium text-sm bg-primary hover:bg-orange-600 transition-colors px-4 py-1.5 rounded-md"
        >
          New request
        </button>
      </div>
    </header>
  );
};
