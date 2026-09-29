import React from 'react';
import { Moon, Sun, Laptop, Type, Check, Sparkles } from 'lucide-react';
import { useTheme, APP_FONTS } from '../../../context/ThemeContext';

export const AppearanceSettings: React.FC = () => {
  const { theme, setTheme, resolvedTheme, font, setFont } = useTheme();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Category Header */}
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-theme-text">Appearance</h3>
        <p className="text-xs text-slate-500 dark:text-theme-text-muted mt-0.5">
          Customize interface themes, typography systems, and visual presentation.
        </p>
      </div>

      {/* Theme Subsection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-theme-text-muted block">
            Theme
          </label>
          <span className="text-xs font-mono text-purple-700 dark:text-purple-400 capitalize bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-500/30">
            Active: {resolvedTheme}
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-theme-text-muted">
          Choose your interface theme or let TotumVault match your operating system appearance.
        </p>
        <div className="grid grid-cols-3 gap-2.5 pt-1 text-xs">
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`py-3 px-3 rounded-xl font-semibold border transition-all cursor-pointer flex flex-col items-center gap-1.5 min-h-[56px] ${
              theme === 'dark'
                ? 'bg-purple-100 dark:bg-purple-600/15 text-purple-900 dark:text-purple-300 border-purple-400 dark:border-purple-500/40 shadow-xs font-bold'
                : 'bg-white dark:bg-theme-surface border-slate-200/90 dark:border-theme-border text-slate-700 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text hover:bg-slate-50 dark:hover:bg-theme-hover'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span>Dark</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`py-3 px-3 rounded-xl font-semibold border transition-all cursor-pointer flex flex-col items-center gap-1.5 min-h-[56px] ${
              theme === 'light'
                ? 'bg-purple-100 dark:bg-purple-600/15 text-purple-900 dark:text-purple-300 border-purple-400 dark:border-purple-500/40 shadow-xs font-bold'
                : 'bg-white dark:bg-theme-surface border-slate-200/90 dark:border-theme-border text-slate-700 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text hover:bg-slate-50 dark:hover:bg-theme-hover'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>Light</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`py-3 px-3 rounded-xl font-semibold border transition-all cursor-pointer flex flex-col items-center gap-1.5 min-h-[56px] ${
              theme === 'system'
                ? 'bg-purple-100 dark:bg-purple-600/15 text-purple-900 dark:text-purple-300 border-purple-400 dark:border-purple-500/40 shadow-xs font-bold'
                : 'bg-white dark:bg-theme-surface border-slate-200/90 dark:border-theme-border text-slate-700 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text hover:bg-slate-50 dark:hover:bg-theme-hover'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>System</span>
          </button>
        </div>
      </div>

      {/* Fonts Subsection */}
      <div className="space-y-3 pt-5 border-t border-slate-200/80 dark:border-theme-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-theme-text-muted block">
              Typography
            </label>
          </div>
          <span className="text-[11px] font-mono text-purple-700 dark:text-purple-400 font-semibold bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-500/30">
            Offline Bundled
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-theme-text-muted">
          Select an embedded font system for vault navigation, credentials, forms, and documents.
        </p>

        <div className="space-y-2 pt-1">
          {APP_FONTS.map((item) => {
            const isSelected = font === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setFont(item.id)}
                className={`py-3 px-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 min-h-[48px] ${
                  isSelected
                    ? 'bg-purple-50/90 dark:bg-purple-600/10 border-purple-400 dark:border-purple-500/50 shadow-xs'
                    : 'bg-white dark:bg-theme-surface border-slate-200/90 dark:border-theme-border hover:border-purple-300 dark:hover:border-purple-500/30 hover:bg-slate-50 dark:hover:bg-theme-hover'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-slate-300 dark:border-theme-border bg-slate-50 dark:bg-theme-bg'
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span
                    style={{ fontFamily: item.fontFamily }}
                    className="text-sm font-semibold text-slate-900 dark:text-theme-text truncate"
                  >
                    {item.name}
                  </span>
                </div>

                <span
                  style={{ fontFamily: item.fontFamily }}
                  className="text-xs text-slate-400 dark:text-theme-text-muted hidden sm:inline font-mono"
                >
                  Aa Bb 123
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interface Subsection */}
      <div className="space-y-3 pt-5 border-t border-slate-200/80 dark:border-theme-border">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-theme-text-muted block">
          Interface
        </label>
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-theme-surface/70 border border-slate-200/80 dark:border-theme-border space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-theme-text">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>High-Contrast & GPU Acceleration</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-theme-text-muted leading-relaxed">
            TotumVault utilizes hardware acceleration and optimal contrast ratios across dark and light modes. Font rendering is strictly local with zero external web font requests.
          </p>
        </div>
      </div>
    </div>
  );
};
