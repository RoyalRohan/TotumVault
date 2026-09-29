import React from 'react';
import {
  Settings,
  Palette,
  Shield,
  WifiOff,
  FileText,
  Database,
  RefreshCw,
} from 'lucide-react';
import { SettingsCategory, SETTINGS_CATEGORIES } from './types';
import logoImg from '../../assets/logo.png';
import { useVault } from '../../context/VaultContext';

interface SettingsSidebarProps {
  activeCategory: SettingsCategory;
  onSelectCategory: (category: SettingsCategory) => void;
}

const CATEGORY_ICONS: Record<SettingsCategory, React.ElementType> = {
  general: Settings,
  appearance: Palette,
  security: Shield,
  privacy: WifiOff,
  documents: FileText,
  data: Database,
  updates: RefreshCw,
};

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeCategory,
  onSelectCategory,
}) => {
  const { appVersion, updateInfo } = useVault();
  const rawVersion = appVersion?.version || updateInfo?.currentVersion;
  const currentVersion = rawVersion ? `v${rawVersion}` : '—';

  return (
    <aside className="w-56 sm:w-60 border-r border-slate-200/80 dark:border-theme-border flex flex-col justify-between bg-slate-50/60 dark:bg-theme-bg/40 shrink-0 select-none">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-200/80 dark:border-theme-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center p-0.5 border border-slate-200 dark:border-theme-border bg-white dark:bg-theme-surface shrink-0 shadow-xs">
            <img src={logoImg} alt="TotumVault" className="w-full h-full object-cover rounded-md" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-theme-text leading-tight">Preferences</h2>
          </div>
        </div>
      </div>

      {/* Categories Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto" aria-label="Preferences Categories">
        {SETTINGS_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id];
          const isActive = activeCategory === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer text-left font-medium min-h-[40px] ${
                isActive
                  ? 'bg-purple-100 dark:bg-purple-600/15 text-purple-900 dark:text-purple-300 font-bold border-l-2 border-purple-600 dark:border-purple-500 shadow-xs'
                  : 'text-slate-600 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text hover:bg-slate-100 dark:hover:bg-theme-hover border-l-2 border-transparent'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-purple-700 dark:text-purple-400' : 'text-slate-400 dark:text-theme-text-muted'
                }`}
              />
              <span className="truncate">{cat.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-slate-200/80 dark:border-theme-border text-[11px] text-slate-500 dark:text-theme-text-muted flex items-center justify-between font-mono">
        <span>{currentVersion}</span>
        <span className="text-[10px] text-slate-400">Offline Vault</span>
      </div>
    </aside>
  );
};
