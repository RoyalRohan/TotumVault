import React, { useState } from 'react';
import {
  X,
  Moon,
  Sun,
  Laptop,
  Type,
  Check,
  Fingerprint,
  CameraOff,
  RefreshCw,
  Download,
  ExternalLink,
  ClipboardCheck,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { useTheme, APP_FONTS } from '../context/ThemeContext';
import { calculatePasswordStrength, calculateEntropy } from '../utils/cryptoUtils';
import { openUrl } from '@tauri-apps/plugin-opener';
import logoImg from '../assets/logo.png';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    status,
    setAutoLockTimer,
    changeMasterPassword,
    clipboardClearSeconds,
    setClipboardClearSeconds,
    clearClipboard,
    screenProtection,
    setScreenProtection,
    triggerPrivacyShieldTest,
    isBiometricSupported,
    isBiometricEnabled,
    setupBiometric,
    disableBiometric,
    updateInfo,
    isCheckingUpdate,
    checkForUpdates,
  } = useVault();
  const { theme, setTheme, resolvedTheme, font, setFont } = useTheme();

  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  const [isEnrollingBio, setIsEnrollingBio] = useState(false);
  const [bioMasterPassword, setBioMasterPassword] = useState('');
  const [bioEnrollError, setBioEnrollError] = useState('');
  const [checkOnStartup, setCheckOnStartup] = useState(() => {
    return localStorage.getItem('totumvault_check_updates_on_startup') !== 'false';
  });

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

  const handleEnrollBio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bioMasterPassword) {
      setBioEnrollError('Master password is required.');
      return;
    }
    setBioEnrollError('');
    const success = await setupBiometric(bioMasterPassword);
    if (success) {
      setIsEnrollingBio(false);
      setBioMasterPassword('');
    } else {
      setBioEnrollError('Failed to configure biometric unlock. Please check your password.');
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
                      className={`py-3 px-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
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
                        ? 'bg-purple-100 dark:bg-purple-600/15 text-purple-900 dark:text-purple-300 border-purple-400 dark:border-purple-500/40 shadow-xs'
                        : 'bg-white dark:bg-theme-surface border-slate-200/90 dark:border-theme-border text-slate-700 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text hover:bg-slate-50 dark:hover:bg-theme-hover'
                    }`}
                  >
                    {mins === 0 ? 'Never' : `${mins}m`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clipboard Security Settings */}
          <div className="space-y-2 pt-2 border-t border-theme-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ClipboardCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <label className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block">
                  Clipboard • Security & Auto-Clear
                </label>
              </div>
              <span className="text-[11px] font-mono text-purple-700 dark:text-purple-400 font-semibold bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-500/30">
                {clipboardClearSeconds === 0 ? 'Manual Clear' : `Timer: ${clipboardClearSeconds}s`}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-theme-text-muted">
              Automatically purges copied passwords from the OS clipboard. Smart clear validates content before erasing, and clipboard is immediately cleared when the vault locks.
            </p>
            <div className="grid grid-cols-5 gap-2 pt-1 text-xs">
              {[
                { label: '5s', secs: 5 },
                { label: '15s', secs: 15 },
                { label: '30s', secs: 30 },
                { label: '60s', secs: 60 },
                { label: 'Never', secs: 0 },
              ].map((item) => {
                const isSelected = clipboardClearSeconds === item.secs;
                return (
                  <button
                    key={item.secs}
                    type="button"
                    onClick={() => setClipboardClearSeconds(item.secs)}
                    className={`py-2 px-2 rounded-xl font-semibold border transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-purple-100 dark:bg-purple-600/15 text-purple-900 dark:text-purple-300 border-purple-400 dark:border-purple-500/40 shadow-xs'
                        : 'bg-white dark:bg-theme-surface border-slate-200/90 dark:border-theme-border text-slate-700 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text hover:bg-slate-50 dark:hover:bg-theme-hover'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500 dark:text-theme-text-muted">
                Purge clipboard immediately:
              </span>
              <button
                type="button"
                onClick={() => clearClipboard(true)}
                className="py-1 px-2.5 rounded-lg bg-slate-100 dark:bg-theme-surface hover:bg-slate-200 dark:hover:bg-theme-hover border border-slate-200 dark:border-theme-border text-xs text-slate-700 dark:text-theme-text font-medium transition-all cursor-pointer"
              >
                Clear Clipboard Now
              </button>
            </div>
          </div>

          {/* Screen Protection Settings */}
          <div className="space-y-2 pt-2 border-t border-theme-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CameraOff className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <label className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block">
                  Privacy • Screen Protection
                </label>
              </div>
              <span
                className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
                  screenProtection?.active
                    ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30'
                    : 'text-slate-600 dark:text-theme-text-muted bg-slate-100 dark:bg-theme-surface border-slate-200 dark:border-theme-border'
                }`}
              >
                {screenProtection?.active ? 'Active' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-theme-text-muted">
              Prevents screenshots, screen recordings, window mirroring, and OS app-switcher capture on supported platforms. Window is automatically blurred when unfocused.
            </p>

            <div className="p-3 rounded-xl bg-white dark:bg-theme-surface border border-slate-200/90 dark:border-theme-border flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-900 dark:text-theme-text flex items-center gap-2">
                  <span>Hardware Screen Shield</span>
                  {screenProtection?.platform && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-theme-bg border border-slate-200 dark:border-theme-border text-slate-600 dark:text-theme-text-muted uppercase font-mono">
                      {screenProtection.platform}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-theme-text-muted">
                  {screenProtection?.description || 'Enforce hardware capture blocking on the active window.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setScreenProtection(!screenProtection?.active)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
                  screenProtection?.active
                    ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-xs'
                    : 'bg-slate-100 dark:bg-theme-hover border-slate-300 dark:border-theme-border text-slate-700 dark:text-theme-text hover:bg-slate-200'
                }`}
              >
                {screenProtection?.active ? 'Protected' : 'Enable'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-500 dark:text-theme-text-muted">
                Preview screen shield overlay & blur:
              </span>
              <button
                type="button"
                onClick={triggerPrivacyShieldTest}
                className="py-1 px-2.5 rounded-lg bg-slate-100 dark:bg-theme-surface hover:bg-slate-200 dark:hover:bg-theme-hover border border-slate-200 dark:border-theme-border text-xs text-slate-700 dark:text-theme-text font-medium transition-all cursor-pointer whitespace-nowrap"
              >
                Test Screen Shield
              </button>
            </div>
          </div>

          {/* Biometric Unlock Settings (Class 3 Strong Biometrics) */}
          <div className="space-y-2 pt-2 border-t border-theme-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <label className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block">
                  Security • Biometric Unlock
                </label>
              </div>
              <span
                className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
                  isBiometricEnabled
                    ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30'
                    : 'text-slate-600 dark:text-theme-text-muted bg-slate-100 dark:bg-theme-surface border-slate-200 dark:border-theme-border'
                }`}
              >
                {isBiometricEnabled ? 'Configured' : isBiometricSupported ? 'Supported' : 'Unavailable'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-theme-text-muted">
              Securely unlock TotumVault using Class 3 strong biometrics (BIOMETRIC_STRONG). Enforces a 3-attempt app lockout policy and native Keystore binding. Never allows device PIN/pattern as a fallback.
            </p>

            {isBiometricSupported ? (
              <div className="p-3 rounded-xl bg-white dark:bg-theme-surface border border-slate-200/90 dark:border-theme-border space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-theme-text block">
                      Biometric Sensor Authentication
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-theme-text-muted block">
                      {isBiometricEnabled
                        ? 'Strong biometric authenticator is registered to unlock this vault.'
                        : 'Enroll your biometric authenticator using your master password.'}
                    </span>
                  </div>

                  {isBiometricEnabled ? (
                    <button
                      type="button"
                      onClick={() => disableBiometric()}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 cursor-pointer shrink-0 transition-colors"
                    >
                      Disable
                    </button>
                  ) : !isEnrollingBio ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEnrollingBio(true);
                        setBioEnrollError('');
                        setBioMasterPassword('');
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shrink-0 transition-colors shadow-xs"
                    >
                      Setup Biometrics
                    </button>
                  ) : null}
                </div>

                {isEnrollingBio && (
                  <form onSubmit={handleEnrollBio} className="pt-2 border-t border-slate-200 dark:border-theme-border space-y-2.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-theme-text block">
                      Confirm Master Password to Enroll Biometrics
                    </label>
                    <input
                      type="password"
                      value={bioMasterPassword}
                      onChange={(e) => setBioMasterPassword(e.target.value)}
                      placeholder="Enter master password..."
                      className="w-full input-themed rounded-xl px-3.5 py-2 text-xs placeholder:text-theme-text-dim focus:outline-none"
                      autoFocus
                    />
                    {bioEnrollError && (
                      <p className="text-xs text-rose-500 font-medium">{bioEnrollError}</p>
                    )}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEnrollingBio(false);
                          setBioMasterPassword('');
                          setBioEnrollError('');
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-theme-border text-slate-700 dark:text-theme-text hover:bg-slate-100 dark:hover:bg-theme-hover cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!bioMasterPassword}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 cursor-pointer"
                      >
                        Verify & Enable
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-theme-surface/50 border border-slate-200/80 dark:border-theme-border text-xs text-slate-500 dark:text-theme-text-muted flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  Hardware biometric authentication (BIOMETRIC_STRONG) is not available or enrolled on this platform/device. Master password authentication is strictly enforced.
                </span>
              </div>
            )}
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

          {/* Software Updates Section */}
          <div className="space-y-3 pt-4 border-t border-theme-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 text-purple-600 dark:text-purple-400 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                <label className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block">
                  Application • Updates
                </label>
              </div>
              <span className="text-[11px] font-mono text-slate-600 dark:text-theme-text-muted font-semibold bg-slate-100 dark:bg-theme-surface px-2 py-0.5 rounded border border-slate-200 dark:border-theme-border">
                Current: v{updateInfo?.currentVersion || '1.2.0'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-600 dark:text-theme-text-muted">
                Keep TotumVault secure with cryptographic updates and platform fixes.
              </p>
              <button
                type="button"
                onClick={() => checkForUpdates(true)}
                disabled={isCheckingUpdate}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 cursor-pointer shrink-0 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                <span>{isCheckingUpdate ? 'Checking...' : 'Check for Updates'}</span>
              </button>
            </div>

            {/* Check on startup option */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 dark:text-theme-text-muted">
              <input
                type="checkbox"
                checked={checkOnStartup}
                onChange={(e) => {
                  setCheckOnStartup(e.target.checked);
                  localStorage.setItem('totumvault_check_updates_on_startup', e.target.checked ? 'true' : 'false');
                }}
                className="rounded border-slate-300 dark:border-theme-border text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
              />
              <span>Automatically check for updates on startup</span>
            </label>

            {/* Update available card */}
            {updateInfo && updateInfo.hasUpdate && (
              <div className="p-3.5 rounded-xl bg-purple-50/90 dark:bg-purple-950/30 border border-purple-300 dark:border-purple-500/50 space-y-2.5 animate-scale-up">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span className="text-xs font-bold text-purple-950 dark:text-purple-200">
                      New Release Available: v{updateInfo.latestVersion}
                    </span>
                  </div>
                  {updateInfo.publishedAt && (
                    <span className="text-[10px] text-purple-700 dark:text-purple-400 font-mono">
                      {new Date(updateInfo.publishedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {updateInfo.releaseTitle && (
                  <p className="text-xs font-semibold text-slate-900 dark:text-theme-text">
                    {updateInfo.releaseTitle}
                  </p>
                )}

                {updateInfo.releaseNotes && (
                  <div className="max-h-28 overflow-y-auto p-2 rounded-lg bg-white/70 dark:bg-theme-bg/60 border border-purple-200 dark:border-theme-border text-[11px] text-slate-700 dark:text-theme-text-muted whitespace-pre-line font-sans leading-relaxed">
                    {updateInfo.releaseNotes}
                  </div>
                )}

                {updateInfo.assetName && (
                  <div className="text-[11px] text-slate-600 dark:text-theme-text-muted flex items-center justify-between font-mono bg-white/50 dark:bg-theme-bg/40 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-theme-border">
                    <span className="truncate mr-2">{updateInfo.assetName}</span>
                    {updateInfo.assetSize && <span>{(updateInfo.assetSize / (1024 * 1024)).toFixed(1)} MB</span>}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      const url = updateInfo.htmlUrl;
                      try {
                        await openUrl(url);
                      } catch {
                        window.open(url, '_blank');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-purple-300 dark:border-purple-500/40 bg-white dark:bg-theme-surface text-purple-700 dark:text-purple-300 hover:bg-purple-50 cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>View Notes</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const url = updateInfo.assetDownloadUrl || updateInfo.htmlUrl;
                      try {
                        await openUrl(url);
                      } catch {
                        window.open(url, '_blank');
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download & Install</span>
                  </button>
                </div>
              </div>
            )}

            {updateInfo && !updateInfo.hasUpdate && (
              <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>TotumVault is up to date with the latest release.</span>
              </div>
            )}
          </div>

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
