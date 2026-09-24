import React from 'react';
import {
  Key,
  Star,
  FileText,
  Clock,
  Shield,
  Settings,
  Lock,
  HardDriveDownload,
  CreditCard,
  Layers,
  Server,
  Scroll,
  Terminal,
  FolderLock,
  X,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { CategoryType } from '../types';
import logoImg from '../assets/logo.png';

export const Sidebar: React.FC = () => {
  const {
    entries,
    documents,
    activeCategory,
    setActiveCategory,
    lockVault,
    setIsSettingsOpen,
    setIsImportExportOpen,
    fetchHealthReport,
    healthReport,
    isMobileNavOpen,
    setIsMobileNavOpen,
  } = useVault();

  const getCount = (cat: CategoryType) => {
    if (cat === 'all') return entries.length;
    if (cat === 'favorites') return entries.filter((e) => e.favorite).length + documents.filter((d) => d.favorite).length;
    if (cat === 'totp') return entries.filter((e) => Boolean(e.totp_secret) || e.category === 'totp').length;
    if (cat === 'documents') return documents.length;
    return entries.filter((e) => e.category === cat).length;
  };

  const navItems: { id: CategoryType; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All Items', icon: <Layers className="w-4 h-4" /> },
    { id: 'favorites', label: 'Favorites', icon: <Star className="w-4 h-4 text-amber-500 fill-amber-500/20" /> },
    { id: 'documents', label: 'Documents & Bills', icon: <FolderLock className="w-4 h-4 text-cyan-500" /> },
    { id: 'logins', label: 'Logins', icon: <Key className="w-4 h-4 text-purple-400" /> },
    { id: 'secure_notes', label: 'Secure Notes', icon: <FileText className="w-4 h-4 text-emerald-500" /> },
    { id: 'totp', label: 'Authenticator (2FA)', icon: <Clock className="w-4 h-4 text-teal-500" /> },
    { id: 'cards', label: 'Payment Cards', icon: <CreditCard className="w-4 h-4 text-indigo-500" /> },
    { id: 'licenses', label: 'Software Licenses', icon: <Scroll className="w-4 h-4 text-amber-600 dark:text-amber-500" /> },
    { id: 'servers', label: 'Servers & SSH', icon: <Server className="w-4 h-4 text-purple-500" /> },
    { id: 'api_credentials', label: 'API Credentials', icon: <Terminal className="w-4 h-4 text-rose-500" /> },
    { id: 'health', label: 'Security Health', icon: <Shield className="w-4 h-4 text-sky-500" /> },
  ];

  const handleNavClick = (id: CategoryType) => {
    setActiveCategory(id);
    setIsMobileNavOpen(false);
    if (id === 'health') {
      fetchHealthReport();
    }
  };

  const totalVulnerabilities = healthReport
    ? healthReport.weak_passwords + healthReport.reused_passwords
    : 0;

  const renderSidebarBody = (isMobile: boolean = false) => (
    <div className="flex flex-col h-full select-none text-theme-text">
      {/* Brand Header */}
      <div className="p-4 border-b border-theme-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center p-0.5 border border-theme-border bg-theme-surface shrink-0 shadow-sm">
            <img
              src={logoImg}
              alt="TotumVault"
              className="w-full h-full object-cover rounded-[10px]"
            />
          </div>
          <div>
            <h1 className="font-bold text-theme-text tracking-wide text-sm">TotumVault</h1>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              lockVault();
              if (isMobile) setIsMobileNavOpen(false);
            }}
            title="Lock Vault Now"
            className="p-2 rounded-xl bg-theme-surface hover:bg-theme-hover border border-theme-border text-theme-text-muted hover:text-theme-text transition-all cursor-pointer shadow-sm group"
          >
            <Lock className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          </button>

          {isMobile && (
            <button
              onClick={() => setIsMobileNavOpen(false)}
              className="p-2 rounded-xl bg-theme-surface hover:bg-theme-hover border border-theme-border text-theme-text-muted hover:text-theme-text transition-all cursor-pointer shadow-sm"
              title="Close Menu"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
        <span className="text-xs font-bold text-theme-text-muted uppercase tracking-wider px-3 mb-1.5 block">
          Categories
        </span>
        {navItems.map((item) => {
          const count = getCount(item.id);
          const isActive = activeCategory === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer group min-h-[44px] ${
                isActive
                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 shadow-sm border border-purple-500/20 font-semibold'
                  : 'text-theme-text-muted hover:text-theme-text hover:bg-theme-hover border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`transition-transform group-hover:scale-105 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-theme-text-muted'}`}>
                  {item.icon}
                </span>
                <span className="tracking-tight">{item.label}</span>
              </div>

              {item.id === 'health' ? (
                totalVulnerabilities > 0 ? (
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 font-bold">
                    {totalVulnerabilities} alert{totalVulnerabilities > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-medium">
                    Secure
                  </span>
                )
              ) : (
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-mono transition-colors ${
                    isActive
                      ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold'
                      : 'bg-theme-elevated text-theme-text-muted'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Status, Backup & Settings */}
      <div className="p-3 border-t border-theme-border space-y-1 bg-theme-surface/80 pb-safe">
        <button
          onClick={() => {
            setIsImportExportOpen(true);
            if (isMobile) setIsMobileNavOpen(false);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-theme-text-muted hover:text-theme-text hover:bg-theme-hover border border-transparent hover:border-theme-border transition-all cursor-pointer min-h-[44px]"
        >
          <HardDriveDownload className="w-4 h-4 text-purple-400" />
          <span>Backup & Restore</span>
        </button>

        <button
          onClick={() => {
            setIsSettingsOpen(true);
            if (isMobile) setIsMobileNavOpen(false);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-theme-text-muted hover:text-theme-text hover:bg-theme-hover border border-transparent hover:border-theme-border transition-all cursor-pointer min-h-[44px]"
        >
          <Settings className="w-4 h-4 text-theme-text-muted" />
          <span>Preferences</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden md:flex w-64 bg-theme-surface/70 backdrop-blur-xl border-r border-theme-border flex-col h-full select-none shrink-0">
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile Off-Canvas Drawer */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            onClick={() => setIsMobileNavOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
          />
          <div className="relative w-72 max-w-[85vw] h-full bg-theme-surface border-r border-theme-border shadow-2xl flex flex-col z-10 animate-scale-up">
            {renderSidebarBody(true)}
          </div>
        </div>
      )}
    </>
  );
};
