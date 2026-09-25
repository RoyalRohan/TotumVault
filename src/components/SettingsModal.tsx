import React, { useState } from 'react';
import { X, Moon, Sun, Laptop, Type, Check } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { useTheme, APP_FONTS } from '../context/ThemeContext';
import { calculatePasswordStrength, calculateEntropy } from '../utils/cryptoUtils';
import logoImg from '../assets/logo.png';

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, setIsSettingsOpen, status, setAutoLockTimer, changeMasterPassword } =
    useVault();
  const { theme, setTheme, resolvedTheme, font, setFont } = useTheme();

  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  if (!isSettingsOpen) return null;

  const newPassStrength = calculatePasswordStrength(newPass);
  const newPassEntropy = calculateEntropy(newPass);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 8) {
      setPassError('New master password must be at least 8 characters long.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('New passwords do not match.');
      return;
    }

    setPassError('');
    setIsChanging(true);
    try {
      await changeMasterPassword(oldPass, newPass);
      setOldPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: any) {
      setPassError(err.toString());
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-md select-none">
      <div className="w-full max-w-lg glass-panel rounded-2xl p-4 sm:p-6 shadow-2xl border border-theme-border animate-scale-up max-h-[94vh] flex flex-col overflow-hidden text-theme-text">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-theme-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center p-1 border border-theme-border bg-theme-surface shrink-0 shadow-sm">
              <img src={logoImg} alt="TotumVault" className="w-full h-full object-cover rounded-[10px]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-theme-text tracking-tight">TotumVault Preferences</h2>
              <p className="text-xs text-theme-text-muted">Manage vault security, appearance, and fonts</p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-2 rounded-xl hover:bg-theme-hover text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          {/* Appearance Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block">
                  Appearance • Theme
                </label>
                <span className="text-xs font-mono text-theme-text-muted capitalize">
                  Active: {resolvedTheme}
                </span>
              </div>
              <p className="text-xs text-theme-text-muted">
                Choose your interface theme or let TotumVault match your operating system.
              </p>
              <div className="grid grid-cols-3 gap-2.5 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`py-2.5 px-3 rounded-xl font-semibold border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
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
                  className={`py-2.5 px-3 rounded-xl font-semibold border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
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
                  className={`py-2.5 px-3 rounded-xl font-semibold border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
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

            {/* Font Selection Section */}
            <div className="space-y-2 pt-2 border-t border-theme-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <label className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block">
                    Appearance • Font
                  </label>
                </div>
                <span className="text-[11px] font-mono text-purple-700 dark:text-purple-400 font-semibold bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-500/30">
                  Offline Bundled
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-theme-text-muted">
                Select a typography system for navigation, vault entries, forms, and documents.
              </p>

              <div className="space-y-2 pt-1">
                {APP_FONTS.map((item) => {
                  const isSelected = font === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setFont(item.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-purple-50/90 dark:bg-purple-600/10 border-purple-400 dark:border-purple-500/50 shadow-xs'
                          : 'bg-white dark:bg-theme-surface border-slate-200/90 dark:border-theme-border hover:border-purple-300 dark:hover:border-purple-500/30 hover:bg-slate-50 dark:hover:bg-theme-hover'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'border-purple-600 bg-purple-600 text-white'
                              : 'border-slate-300 dark:border-theme-border bg-slate-50 dark:bg-theme-bg'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              style={{ fontFamily: item.fontFamily }}
                              className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-theme-text truncate"
                            >
                              {item.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-theme-surface border border-slate-200 dark:border-theme-border text-slate-700 dark:text-theme-text-muted font-medium shrink-0">
                              {item.category}
                            </span>
                          </div>
                          <p
                            style={{ fontFamily: item.fontFamily }}
                            className="text-xs text-slate-500 dark:text-theme-text-muted truncate mt-0.5"
                          >
                            {item.previewText}
                          </p>
                        </div>
                      </div>

                      {/* Small Live Typography Preview */}
                      <div
                        style={{ fontFamily: item.fontFamily }}
                        className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-theme-bg/80 border border-slate-200 dark:border-theme-border text-[11px] text-slate-600 dark:text-theme-text-muted shrink-0 text-left sm:text-right select-none tracking-normal font-mono"
                      >
                        {item.previewText}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Auto-Lock Settings */}
          <div className="space-y-2 pt-2 border-t border-theme-border">
            <label className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block">
              Auto-Lock Timer
            </label>
            <p className="text-xs text-theme-text-muted">
              Automatically lock vault after a period of user inactivity.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1 text-xs">
              {[1, 5, 10, 15, 30, 0].map((mins) => {
                const isSelected = status.auto_lock_minutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setAutoLockTimer(mins)}
                    className={`py-2 px-2.5 rounded-xl font-semibold border transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-purple-600/15 text-purple-600 dark:text-purple-400 border-purple-500/40 shadow-sm'
                        : 'bg-theme-surface border-theme-border text-theme-text-muted hover:text-theme-text hover:bg-theme-hover'
                    }`}
                  >
                    {mins === 0 ? 'Never' : `${mins}m`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Change Master Password Form */}
          <form onSubmit={handleChangePassword} className="space-y-3.5 pt-4 border-t border-theme-border">
            <label className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block">
              Change Master Password
            </label>

            <div>
              <label className="text-xs font-bold text-theme-text-muted block mb-1.5">Current Master Password</label>
              <input
                type="password"
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
                placeholder="Enter current password..."
                className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder:text-theme-text-dim focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-theme-text-muted block mb-1.5">New Master Password</label>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="At least 8 chars..."
                  className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder:text-theme-text-dim focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-theme-text-muted block mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Confirm new password..."
                  className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder:text-theme-text-dim focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* New Password Strength Indicator */}
            {newPass && (
              <div className="p-3 rounded-xl bg-theme-elevated border border-theme-border space-y-2 animate-scale-up">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-theme-text-muted font-medium">Complexity:</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-white text-xs ${newPassStrength.color}`}>
                      {newPassStrength.label}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-theme-text-muted font-medium">
                    {newPassEntropy.bits} bits • {newPassEntropy.crackTimeDisplay}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-theme-hover rounded-full overflow-hidden flex gap-1">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`h-full flex-1 rounded-full transition-all ${
                        idx <= newPassStrength.score ? newPassStrength.color : 'bg-slate-700/30'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {passError && <p className="text-xs text-rose-500 dark:text-rose-400 leading-tight font-medium">{passError}</p>}

            <button
              type="submit"
              disabled={isChanging || !oldPass || !newPass}
              className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isChanging ? 'Updating Password...' : 'Update Master Password'}
            </button>
          </form>

          <div className="pt-3 border-t border-theme-border flex items-center justify-between text-xs text-theme-text-muted">
            <div className="flex items-center gap-1.5">
              <img src={logoImg} alt="TotumVault" className="w-4 h-4 rounded object-cover" />
              <span className="font-medium text-theme-text">TotumVault</span>
            </div>
            <span className="font-mono text-theme-text-muted">v1.2.0 • Offline Security Vault</span>
          </div>
        </div>
      </div>
    </div>
  );
};
