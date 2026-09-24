import React, { useState } from 'react';
import { X, Moon, Sun, Laptop } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { useTheme } from '../context/ThemeContext';
import { calculatePasswordStrength, calculateEntropy } from '../utils/cryptoUtils';
import logoImg from '../assets/logo.png';

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, setIsSettingsOpen, status, setAutoLockTimer, changeMasterPassword } =
    useVault();
  const { theme, setTheme, resolvedTheme } = useTheme();

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
              <h2 className="text-base font-semibold text-theme-text tracking-tight">TotumVault Settings</h2>
              <p className="text-xs text-theme-text-muted">Manage local vault preferences</p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-2 rounded-xl hover:bg-theme-hover text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          {/* Appearance Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block">
                Appearance
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
                className={`py-3 px-3 rounded-xl font-semibold border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  theme === 'dark'
                    ? 'bg-purple-600/15 text-purple-600 dark:text-purple-400 border-purple-500/40 shadow-sm'
                    : 'bg-theme-surface border-theme-border text-theme-text-muted hover:text-theme-text hover:bg-theme-hover'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Dark</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`py-3 px-3 rounded-xl font-semibold border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  theme === 'light'
                    ? 'bg-purple-600/15 text-purple-600 dark:text-purple-400 border-purple-500/40 shadow-sm'
                    : 'bg-theme-surface border-theme-border text-theme-text-muted hover:text-theme-text hover:bg-theme-hover'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`py-3 px-3 rounded-xl font-semibold border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  theme === 'system'
                    ? 'bg-purple-600/15 text-purple-600 dark:text-purple-400 border-purple-500/40 shadow-sm'
                    : 'bg-theme-surface border-theme-border text-theme-text-muted hover:text-theme-text hover:bg-theme-hover'
                }`}
              >
                <Laptop className="w-4 h-4" />
                <span>System</span>
              </button>
            </div>
          </div>
          {/* Auto-Lock Settings */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block">
              Auto-Lock Timer
            </label>
            <p className="text-xs text-theme-text-muted">
              Automatically lock vault after a period of user inactivity.
            </p>
            <div className="grid grid-cols-3 gap-2.5 pt-1 text-xs">
              {[1, 5, 10, 15, 30, 0].map((mins) => {
                const isSelected = status.auto_lock_minutes === mins;
                return (
                  <button
                    key={mins}
                    onClick={() => setAutoLockTimer(mins)}
                    className={`py-2.5 px-3 rounded-xl font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600/15 text-purple-600 dark:text-purple-400 border-purple-500/40 shadow-sm'
                        : 'bg-theme-surface border-theme-border text-theme-text-muted hover:text-theme-text hover:bg-theme-hover'
                    }`}
                  >
                    {mins === 0 ? 'Never' : `${mins} min`}
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
                className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none"
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
                  className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-theme-text-muted block mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Confirm new password..."
                  className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none font-mono"
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

            {passError && <p className="text-xs text-rose-400 leading-tight">{passError}</p>}

            <button
              type="submit"
              disabled={isChanging || !oldPass || !newPass}
              className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-medium transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isChanging ? 'Updating Password...' : 'Update Master Password'}
            </button>
          </form>

          <div className="pt-3 border-t border-theme-border flex items-center justify-between text-xs text-theme-text-muted">
            <div className="flex items-center gap-1.5">
              <img src={logoImg} alt="TotumVault" className="w-4 h-4 rounded object-cover" />
              <span className="font-medium text-theme-text">TotumVault</span>
            </div>
            <span className="font-mono text-theme-text-muted">v1.2.0 • Offline</span>
          </div>
        </div>
      </div>
    </div>
  );
};
