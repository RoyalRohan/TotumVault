import React from 'react';
import { X, Star, ChevronDown, Key, FileText, Clock, CreditCard, Scroll, Server, Terminal } from 'lucide-react';
import { CategoryType } from '../../../types';

interface EntryFormShellProps {
  title: string;
  isEditing: boolean;
  category: CategoryType;
  onCategoryChange: (cat: CategoryType) => void;
  favorite: boolean;
  onFavoriteToggle: () => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  submitDisabled?: boolean;
}

export const EntryFormShell: React.FC<EntryFormShellProps> = ({
  title,
  isEditing,
  category,
  onCategoryChange,
  favorite,
  onFavoriteToggle,
  onClose,
  onSubmit,
  children,
  submitDisabled = false,
}) => {
  const getCategoryIcon = (cat: CategoryType) => {
    switch (cat) {
      case 'secure_notes':
        return <FileText className="w-5 h-5 stroke-[1.75]" />;
      case 'totp':
        return <Clock className="w-5 h-5 stroke-[1.75]" />;
      case 'cards':
        return <CreditCard className="w-5 h-5 stroke-[1.75]" />;
      case 'licenses':
        return <Scroll className="w-5 h-5 stroke-[1.75]" />;
      case 'servers':
        return <Server className="w-5 h-5 stroke-[1.75]" />;
      case 'api_credentials':
        return <Terminal className="w-5 h-5 stroke-[1.75]" />;
      default:
        return <Key className="w-5 h-5 stroke-[1.75]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-md select-none">
      <div className="w-full max-w-xl glass-panel rounded-2xl shadow-2xl border border-theme-border animate-scale-up max-h-[94vh] flex flex-col overflow-hidden text-theme-text">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-theme-border bg-theme-surface/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-sm shrink-0">
              {getCategoryIcon(category)}
            </div>
            <div>
              <h2 className="text-base font-semibold text-theme-text tracking-tight">
                {isEditing ? `Edit ${title || 'Item'}` : `New ${title || 'Item'}`}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="relative inline-flex items-center">
                  <select
                    value={category}
                    onChange={(e) => onCategoryChange(e.target.value as CategoryType)}
                    className="bg-theme-surface border border-theme-border rounded-lg pl-2 pr-6 py-1 text-xs text-theme-text font-medium appearance-none cursor-pointer focus:outline-none focus:border-purple-500"
                  >
                    <option value="logins">Login</option>
                    <option value="secure_notes">Secure Note</option>
                    <option value="totp">Authenticator (2FA)</option>
                    <option value="cards">Payment Card</option>
                    <option value="licenses">Software License</option>
                    <option value="servers">Server</option>
                    <option value="api_credentials">API Credential</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-theme-text-muted absolute right-1.5 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFavoriteToggle}
              className="p-2.5 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-hover text-theme-text-muted transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={favorite ? 'Remove from favorites' : 'Mark as favorite'}
            >
              <Star
                className={`w-4.5 h-4.5 ${
                  favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                }`}
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-hover text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Close editor"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4">
            {children}
          </div>

          {/* Footer Actions */}
          <div className="px-4 sm:px-6 py-3 border-t border-theme-border bg-theme-surface/70 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-theme-text-muted hover:text-theme-text hover:bg-theme-hover border border-theme-border transition-colors cursor-pointer min-h-[44px] flex items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs sm:text-sm font-medium shadow-sm transition-colors disabled:opacity-50 cursor-pointer min-h-[44px] flex items-center justify-center"
            >
              Save Encrypted
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
