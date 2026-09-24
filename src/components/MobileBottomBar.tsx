import React from 'react';
import { Layers, FolderLock, Star, Clock, Shield, Menu } from 'lucide-react';
import { useVault } from '../context/VaultContext';

export const MobileBottomBar: React.FC = () => {
  const {
    activeCategory,
    setActiveCategory,
    setSelectedEntryId,
    setIsMobileNavOpen,
    fetchHealthReport,
    healthReport,
  } = useVault();

  const totalVulnerabilities = healthReport
    ? healthReport.weak_passwords + healthReport.reused_passwords
    : 0;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden border-t border-theme-border bg-theme-surface/95 backdrop-blur-xl shrink-0 flex items-center justify-around px-2 py-2 z-30 pb-safe select-none shadow-lg text-theme-text"
    >
      {/* 1. Vault Items */}
      <button
        onClick={() => {
          setActiveCategory('all');
          setSelectedEntryId(null);
        }}
        className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer min-h-[48px] ${
          activeCategory === 'all'
            ? 'text-purple-400 font-semibold'
            : 'text-theme-text-muted hover:text-theme-text'
        }`}
      >
        <Layers className="w-4.5 h-4.5" />
        <span className="text-xs tracking-tight">Vault</span>
      </button>

      {/* 2. Documents & Bills */}
      <button
        onClick={() => {
          setActiveCategory('documents');
          setSelectedEntryId(null);
        }}
        className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer min-h-[48px] ${
          activeCategory === 'documents'
            ? 'text-cyan-500 font-semibold'
            : 'text-theme-text-muted hover:text-theme-text'
        }`}
      >
        <FolderLock className="w-4.5 h-4.5" />
        <span className="text-xs tracking-tight">Docs</span>
      </button>

      {/* 2. Favorites */}
      <button
        onClick={() => {
          setActiveCategory('favorites');
          setSelectedEntryId(null);
        }}
        className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer min-h-[48px] ${
          activeCategory === 'favorites'
            ? 'text-amber-500 font-semibold'
            : 'text-theme-text-muted hover:text-theme-text'
        }`}
      >
        <Star className={`w-4.5 h-4.5 ${activeCategory === 'favorites' ? 'fill-amber-500/30' : ''}`} />
        <span className="text-xs tracking-tight">Favorites</span>
      </button>

      {/* 3. 2FA Authenticator */}
      <button
        onClick={() => {
          setActiveCategory('totp');
          setSelectedEntryId(null);
        }}
        className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer min-h-[48px] ${
          activeCategory === 'totp'
            ? 'text-teal-600 dark:text-teal-400 font-semibold'
            : 'text-theme-text-muted hover:text-theme-text'
        }`}
      >
        <Clock className="w-4.5 h-4.5" />
        <span className="text-xs tracking-tight">2FA</span>
      </button>

      {/* 4. Security Health Audit */}
      <button
        onClick={() => {
          setActiveCategory('health');
          fetchHealthReport();
          setSelectedEntryId(null);
        }}
        className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all relative cursor-pointer min-h-[48px] ${
          activeCategory === 'health'
            ? 'text-sky-600 dark:text-sky-400 font-semibold'
            : 'text-theme-text-muted hover:text-theme-text'
        }`}
      >
        <div className="relative">
          <Shield className="w-4.5 h-4.5" />
          {totalVulnerabilities > 0 && (
            <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-theme-surface" />
          )}
        </div>
        <span className="text-xs tracking-tight">Audit</span>
      </button>

      {/* 5. More / Categories Drawer */}
      <button
        onClick={() => setIsMobileNavOpen(true)}
        className="flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl text-theme-text-muted hover:text-theme-text transition-all cursor-pointer min-h-[48px]"
      >
        <Menu className="w-4.5 h-4.5" />
        <span className="text-xs tracking-tight">More</span>
      </button>
    </nav>
  );
};
