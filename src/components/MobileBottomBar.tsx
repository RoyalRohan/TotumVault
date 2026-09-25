import React from 'react';
import { Layers, FolderLock, Star, Clock, Shield } from 'lucide-react';
import { useVault } from '../context/VaultContext';

export const MobileBottomBar: React.FC = () => {
  const {
    activeCategory,
    setActiveCategory,
    setSelectedEntryId,
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
            ? 'text-purple-700 dark:text-purple-300 font-bold'
            : 'text-slate-600 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text font-medium'
        }`}
      >
        <Layers className="w-4.5 h-4.5 stroke-[1.75]" />
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
            ? 'text-purple-700 dark:text-purple-300 font-bold'
            : 'text-slate-600 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text font-medium'
        }`}
      >
        <FolderLock className="w-4.5 h-4.5 stroke-[1.75]" />
        <span className="text-xs tracking-tight">Docs</span>
      </button>

      {/* 3. Favorites */}
      <button
        onClick={() => {
          setActiveCategory('favorites');
          setSelectedEntryId(null);
        }}
        className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer min-h-[48px] ${
          activeCategory === 'favorites'
            ? 'text-purple-700 dark:text-purple-300 font-bold'
            : 'text-slate-600 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text font-medium'
        }`}
      >
        <Star className={`w-4.5 h-4.5 stroke-[1.75] ${activeCategory === 'favorites' ? 'fill-purple-500/20' : ''}`} />
        <span className="text-xs tracking-tight">Favorites</span>
      </button>

      {/* 4. 2FA Authenticator */}
      <button
        onClick={() => {
          setActiveCategory('totp');
          setSelectedEntryId(null);
        }}
        className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer min-h-[48px] ${
          activeCategory === 'totp'
            ? 'text-purple-700 dark:text-purple-300 font-bold'
            : 'text-slate-600 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text font-medium'
        }`}
      >
        <Clock className="w-4.5 h-4.5 stroke-[1.75]" />
        <span className="text-xs tracking-tight">2FA</span>
      </button>

      {/* 5. Security Health Audit */}
      <button
        onClick={() => {
          setActiveCategory('health');
          fetchHealthReport();
          setSelectedEntryId(null);
        }}
        className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all relative cursor-pointer min-h-[48px] ${
          activeCategory === 'health'
            ? 'text-purple-700 dark:text-purple-300 font-bold'
            : 'text-slate-600 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text font-medium'
        }`}
      >
        <div className="relative">
          <Shield className="w-4.5 h-4.5 stroke-[1.75]" />
          {totalVulnerabilities > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </div>
        <span className="text-xs tracking-tight">Health</span>
      </button>
    </nav>
  );
};
