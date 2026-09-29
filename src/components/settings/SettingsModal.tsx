import React, { useState } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { useVault } from '../../context/VaultContext';
import { SettingsCategory, SETTINGS_CATEGORIES } from './types';
import { SettingsSidebar } from './SettingsSidebar';
import { SettingsMobileNav } from './SettingsMobileNav';

// Category Components
import { GeneralSettings } from './categories/GeneralSettings';
import { AppearanceSettings } from './categories/AppearanceSettings';
import { SecuritySettings } from './categories/SecuritySettings';
import { PrivacyNetworkSettings } from './categories/PrivacyNetworkSettings';
import { DocumentSettings } from './categories/DocumentSettings';
import { UpdatesSettings } from './categories/UpdatesSettings';

export interface SettingsModalProps {
  initialCategory?: SettingsCategory;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  initialCategory = 'general',
}) => {
  const { isSettingsOpen, setIsSettingsOpen } = useVault();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(initialCategory);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  if (!isSettingsOpen) return null;

  const handleClose = () => {
    setIsSettingsOpen(false);
    setMobileView('list');
  };

  const handleSelectCategory = (cat: SettingsCategory) => {
    setActiveCategory(cat);
    setMobileView('detail');
  };

  const activeCategoryMeta = SETTINGS_CATEGORIES.find((c) => c.id === activeCategory) || SETTINGS_CATEGORIES[0];

  const renderActiveCategoryContent = () => {
    switch (activeCategory) {
      case 'general':
        return <GeneralSettings />;
      case 'appearance':
        return <AppearanceSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'privacy':
        return <PrivacyNetworkSettings />;
      case 'documents':
        return <DocumentSettings />;
      case 'updates':
        return <UpdatesSettings />;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div className="w-full max-w-4xl h-[92vh] sm:h-[84vh] max-h-[700px] glass-panel rounded-2xl shadow-2xl border border-slate-200/90 dark:border-theme-border flex overflow-hidden text-slate-900 dark:text-theme-text bg-white dark:bg-theme-bg">
        
        {/* DESKTOP MASTER-DETAIL VIEW (Hidden on Mobile) */}
        <div className="hidden md:flex w-full h-full">
          {/* Left Master Navigation Sidebar */}
          <SettingsSidebar
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
          />

          {/* Right Detail Content View */}
          <div className="flex-1 flex flex-col h-full min-w-0 bg-white dark:bg-theme-surface/40">
            {/* Desktop Top Header Bar */}
            <div className="px-6 py-4 border-b border-slate-200/80 dark:border-theme-border flex items-center justify-between shrink-0">
              <div className="min-w-0 pr-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-theme-text leading-tight truncate">
                  {activeCategoryMeta.label}
                </h2>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-theme-text hover:bg-slate-100 dark:hover:bg-theme-hover cursor-pointer transition-colors shrink-0"
                title="Close Preferences (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {renderActiveCategoryContent()}
            </div>
          </div>
        </div>

        {/* MOBILE VIEW (Visible only below md breakpoint) */}
        <div className="flex md:hidden w-full h-full flex-col">
          {mobileView === 'list' ? (
            <SettingsMobileNav
              onSelectCategory={handleSelectCategory}
              onClose={handleClose}
            />
          ) : (
            <div className="flex-1 flex flex-col h-full min-w-0">
              {/* Mobile Detail Top Navigation Bar */}
              <div className="px-4 py-3.5 border-b border-slate-200/80 dark:border-theme-border flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-theme-bg/50">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="flex items-center gap-1 text-xs font-semibold text-purple-700 dark:text-purple-400 hover:text-purple-900 cursor-pointer p-1 -ml-1 rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  <span>Preferences</span>
                </button>

                <span className="text-xs font-bold text-slate-800 dark:text-theme-text truncate px-2">
                  {activeCategoryMeta.label}
                </span>

                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-theme-text cursor-pointer"
                  title="Close Preferences"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Scrollable Detail Body */}
              <div className="flex-1 overflow-y-auto p-4">
                {renderActiveCategoryContent()}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
