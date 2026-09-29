import React from 'react';
import {
  X,
  ChevronRight,
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

interface SettingsMobileNavProps {
  onSelectCategory: (category: SettingsCategory) => void;
  onClose: () => void;
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

export const SettingsMobileNav: React.FC<SettingsMobileNavProps> = ({
  onSelectCategory,
  onClose,
}) => {
  const { appVersion, updateInfo } = useVault();
  const rawVersion = appVersion?.version || updateInfo?.currentVersion;
  const currentVersion = rawVersion ? `v${rawVersion}` : '';

  return (
    <div className="flex flex-col h-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200/80 dark:border-theme-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center p-1 border border-slate-200 dark:border-theme-border bg-white dark:bg-theme-surface shrink-0 shadow-xs">
            <img src={logoImg} alt="TotumVault" className="w-full h-full object-cover rounded-lg" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-theme-text leading-tight">
              Preferences
            </h2>
            <p className="text-xs text-slate-500 dark:text-theme-text-muted">
              Choose a category to configure
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-theme-text hover:bg-slate-100 dark:hover:bg-theme-hover cursor-pointer transition-colors"
          title="Close Preferences"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Categories List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {SETTINGS_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id];

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-theme-surface border border-slate-200/80 dark:border-theme-border hover:bg-purple-50/50 dark:hover:bg-theme-hover text-left transition-all cursor-pointer min-h-[52px] group shadow-2xs"
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-theme-bg text-slate-600 dark:text-purple-400 group-hover:bg-purple-100 dark:group-hover:bg-purple-950/60 group-hover:text-purple-700 transition-colors shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-slate-900 dark:text-theme-text block leading-tight">
                    {cat.label}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-theme-text-muted truncate block mt-0.5">
                    {cat.description}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-theme-text-muted group-hover:text-purple-600 dark:group-hover:text-purple-400 shrink-0 transition-colors" />
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200/80 dark:border-theme-border text-center text-xs text-slate-500 dark:text-theme-text-muted font-mono shrink-0">
        <span>TotumVault{currentVersion ? ` ${currentVersion}` : ''} • Offline Security Vault</span>
      </div>
    </div>
  );
};
