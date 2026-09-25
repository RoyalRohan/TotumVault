import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Key, ArrowRight, AlertTriangle } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useVault } from '../context/VaultContext';
import logoImg from '../assets/logo.png';

interface LockScreenProps {
  onOpenSetup: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onOpenSetup }) => {
  const { status, unlockVault } = useVault();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setError('');
    setIsSubmitting(true);

    const success = await unlockVault(password);
    setIsSubmitting(false);
    setPassword('');

    if (!success) {
      setError('Incorrect master password. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  };

  const handleKeyModifier = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleOpenDeveloper = async (e: React.MouseEvent) => {
    e.preventDefault();
    const url = 'https://github.com/RoyalRohan';
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-theme-bg text-theme-text p-4 sm:p-6 overflow-hidden select-none pt-safe pb-safe">
      <div
        className={`w-full max-w-[400px] glass-panel p-6 sm:p-8 rounded-2xl shadow-xl relative z-10 border border-theme-border ${
          shake ? 'animate-shake border-rose-500/60 shadow-rose-500/10' : 'animate-scale-up'
        }`}
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl shadow-md mb-4 flex items-center justify-center p-1 border border-theme-border bg-theme-surface select-none">
            <img
              src={logoImg}
              alt="TotumVault Official Logo"
              className="w-full h-full object-cover rounded-[14px]"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-theme-text mb-1">TotumVault</h1>
          <p className="text-sm text-theme-text-muted font-medium">Local Password Manager</p>
        </div>

        {!status.exists ? (
          <div className="text-center space-y-6">
            <p className="text-sm text-theme-text-muted leading-relaxed">
              Your encrypted vault is stored exclusively on this device and never leaves your control.
            </p>
            <button
              onClick={onOpenSetup}
              className="w-full py-3.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-medium text-sm transition-colors shadow-sm flex items-center justify-center gap-2 group cursor-pointer"
            >
              <Key className="w-4 h-4 text-white" />
              <span>Initialize Local Vault</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform text-white/80" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-theme-surface border border-slate-200/90 dark:border-theme-border text-xs text-slate-800 dark:text-theme-text font-semibold shadow-2xs">
                <Lock className="w-3.5 h-3.5 stroke-[1.75] text-purple-700 dark:text-purple-400" />
                <span>Vault Locked</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-theme-text-muted block">
                  Master Password
                </label>
                {capsLockOn && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-400 animate-scale-up">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Caps Lock ON</span>
                  </div>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyModifier}
                  onKeyUp={handleKeyModifier}
                  placeholder="Enter master password..."
                  autoFocus
                  className="input-themed w-full rounded-xl pl-4 pr-11 py-3 text-sm sm:text-base font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 dark:text-theme-text-muted dark:hover:text-theme-text p-1.5 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && <p className="text-xs text-rose-500 mt-1 leading-tight font-medium">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="w-full py-3.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-medium text-sm transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4 text-white" />
                  <span>Unlock Vault</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Developer Credit Footer / Watermark */}
      <footer className="mt-6 sm:mt-8 text-center text-xs text-theme-text-muted/60 select-none relative z-10">
        Developed by{' '}
        <a
          href="https://github.com/RoyalRohan"
          onClick={handleOpenDeveloper}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-theme-text-muted hover:text-purple-600 dark:hover:text-purple-400 transition-colors underline underline-offset-4 decoration-theme-border hover:decoration-purple-600 dark:hover:decoration-purple-400 cursor-pointer"
        >
          Rohan Ghimire
        </a>
      </footer>
    </div>
  );
};
