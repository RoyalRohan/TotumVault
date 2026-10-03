import React from 'react';
import { Moon, Sun, Laptop, Type, Check } from 'lucide-react';
import { useTheme, APP_FONTS } from '../../../context/ThemeContext';

export const AppearanceSettings: React.FC = () => {
  const { theme, setTheme, font, setFont } = useTheme();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-900 dark:text-theme-text">
          Theme
        </h4>
        <div className="grid grid-cols-3 gap-2.5 text-xs">
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

      <div className="space-y-3 pt-5 border-t border-slate-200/80 dark:border-theme-border">
        <div className="flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-theme-text">
            Font
          </h4>
        </div>

        <div className="space-y-2">
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
    </div>
  );
};
