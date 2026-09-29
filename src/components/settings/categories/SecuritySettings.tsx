import React, { useState } from 'react';
import {
  Lock,
  KeyRound,
  Fingerprint,
  ClipboardCheck,
  CameraOff,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useVault } from '../../../context/VaultContext';
import { calculatePasswordStrength, calculateEntropy } from '../../../utils/cryptoUtils';

export const SecuritySettings: React.FC = () => {
  const {
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
  } = useVault();

  // Password Change State
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState('');
  const [isChanging, setIsChanging] = useState(false);
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Biometrics Enrollment State
  const [isEnrollingBio, setIsEnrollingBio] = useState(false);
  const [bioMasterPassword, setBioMasterPassword] = useState('');
  const [bioEnrollError, setBioEnrollError] = useState('');

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
    <div className="space-y-6 animate-fade-in">
      {/* Subsection 1: Vault Security */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-theme-text">
            Vault Security
          </h4>
        </div>

        {/* Auto-Lock Timer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800 dark:text-theme-text">
              Auto-Lock
            </span>
            <span className="text-[11px] font-mono text-purple-700 dark:text-purple-400 font-semibold bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-500/30">
              {status.auto_lock_minutes === 0 ? 'Never' : `${status.auto_lock_minutes}m`}
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1 text-xs">
            {[1, 5, 10, 15, 30, 0].map((mins) => {
              const isSelected = status.auto_lock_minutes === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setAutoLockTimer(mins)}
                  className={`py-2 px-2.5 rounded-xl font-semibold border transition-all cursor-pointer text-center min-h-[40px] ${
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

        {/* Change Master Password */}
        <form onSubmit={handleChangePassword} className="space-y-3 pt-3 border-t border-slate-200/80 dark:border-theme-border">
          <div className="flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-theme-text">
              Change Master Password
            </h4>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-theme-text-muted block mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showOldPass ? 'text' : 'password'}
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
                placeholder="Enter current password..."
                className="w-full input-themed rounded-xl px-3.5 py-2.5 text-xs placeholder:text-theme-text-dim focus:outline-none pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOldPass(!showOldPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-theme-text cursor-pointer p-1"
              >
                {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-theme-text-muted block mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="At least 8 chars..."
                  className="w-full input-themed rounded-xl px-3.5 py-2.5 text-xs placeholder:text-theme-text-dim focus:outline-none font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-theme-text cursor-pointer p-1"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-theme-text-muted block mb-1">
                Confirm New Password
              </label>
              <input
                type={showNewPass ? 'text' : 'password'}
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Confirm new password..."
                className="w-full input-themed rounded-xl px-3.5 py-2.5 text-xs placeholder:text-theme-text-dim focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* New Password Strength Indicator */}
          {newPass && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-theme-surface/70 border border-slate-200/80 dark:border-theme-border space-y-2 animate-scale-up">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-theme-text-muted font-medium">Complexity:</span>
                  <span className={`px-2 py-0.5 rounded font-bold text-white text-xs ${newPassStrength.color}`}>
                    {newPassStrength.label}
                  </span>
                </div>
                <span className="font-mono text-xs text-slate-500 dark:text-theme-text-muted font-medium">
                  {newPassEntropy.bits} bits • {newPassEntropy.crackTimeDisplay}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-theme-hover rounded-full overflow-hidden flex gap-1">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`h-full flex-1 rounded-full transition-all ${
                      idx <= newPassStrength.score ? newPassStrength.color : 'bg-slate-300 dark:bg-slate-700/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {passError && (
            <p className="text-xs text-rose-500 dark:text-rose-400 leading-tight font-medium">
              {passError}
            </p>
          )}

          <button
            type="submit"
            disabled={isChanging || !oldPass || !newPass}
            className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50 cursor-pointer min-h-[42px]"
          >
            {isChanging ? 'Updating Password...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Subsection 2: Biometric Unlock */}
      <div className="space-y-3 pt-5 border-t border-slate-200/80 dark:border-theme-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Fingerprint className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-theme-text">
              Biometric Unlock
            </h4>
          </div>
          <span
            className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
              isBiometricEnabled
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30'
                : 'text-slate-600 dark:text-theme-text-muted bg-slate-100 dark:bg-theme-surface border-slate-200 dark:border-theme-border'
            }`}
          >
            {isBiometricEnabled ? 'Ready' : isBiometricSupported ? 'Not Set Up' : 'Unavailable'}
          </span>
        </div>

        {isBiometricSupported ? (
          <div className="p-3.5 rounded-xl bg-white dark:bg-theme-surface border border-slate-200/90 dark:border-theme-border space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-900 dark:text-theme-text">
                Biometric Authentication
              </span>

              {isBiometricEnabled ? (
                <button
                  type="button"
                  onClick={() => disableBiometric()}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 cursor-pointer shrink-0 transition-colors min-h-[38px]"
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
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shrink-0 transition-colors shadow-xs min-h-[38px]"
                >
                  Set Up
                </button>
              ) : null}
            </div>

            {isEnrollingBio && (
              <form onSubmit={handleEnrollBio} className="pt-2 border-t border-slate-200 dark:border-theme-border space-y-2.5">
                <label className="text-xs font-bold text-slate-700 dark:text-theme-text block">
                  Confirm Master Password
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
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 cursor-pointer shadow-xs"
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
            <span>Biometrics are not supported on this device.</span>
          </div>
        )}
      </div>

      {/* Subsection 3: Clipboard Security */}
      <div className="space-y-3 pt-5 border-t border-slate-200/80 dark:border-theme-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-theme-text">
              Clipboard Security
            </h4>
          </div>
          <span className="text-[11px] font-mono text-purple-700 dark:text-purple-400 font-semibold bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-500/30">
            {clipboardClearSeconds === 0
              ? 'Never'
              : clipboardClearSeconds === 120
              ? '2m'
              : `${clipboardClearSeconds}s`}
          </span>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-800 dark:text-theme-text block">
            Clipboard Auto-Clear
          </span>
          <div className="grid grid-cols-5 gap-2 text-xs">
            {[
              { label: '15s', secs: 15 },
              { label: '30s', secs: 30 },
              { label: '60s', secs: 60 },
              { label: '2m', secs: 120 },
              { label: 'Never', secs: 0 },
            ].map((item) => {
              const isSelected = clipboardClearSeconds === item.secs;
              return (
                <button
                  key={item.secs}
                  type="button"
                  onClick={() => setClipboardClearSeconds(item.secs)}
                  className={`py-2 px-2 rounded-xl font-semibold border transition-all cursor-pointer text-center min-h-[40px] ${
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
        </div>

        <p className="text-xs text-slate-500 dark:text-theme-text-muted">
          Only TotumVault-copied secrets are cleared.
        </p>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => clearClipboard(true, true)}
            className="w-full sm:w-auto py-2 px-3 rounded-xl bg-slate-100 dark:bg-theme-surface hover:bg-slate-200 dark:hover:bg-theme-hover border border-slate-200 dark:border-theme-border text-xs text-slate-700 dark:text-theme-text font-semibold transition-all cursor-pointer min-h-[38px]"
          >
            Clear Clipboard Now
          </button>
        </div>
      </div>

      {/* Subsection 4: Screen Protection */}
      <div className="space-y-3 pt-5 border-t border-slate-200/80 dark:border-theme-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CameraOff className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-theme-text">
              Screen Protection
            </h4>
          </div>
          <span
            className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
              screenProtection?.status_code === 'active'
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30'
                : screenProtection?.status_code === 'partial'
                ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-500/30'
                : screenProtection?.status_code === 'unsupported'
                ? 'text-slate-600 dark:text-theme-text-muted bg-slate-100 dark:bg-theme-surface border-slate-200 dark:border-theme-border'
                : screenProtection?.active
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30'
                : 'text-slate-600 dark:text-theme-text-muted bg-slate-100 dark:bg-theme-surface border-slate-200 dark:border-theme-border'
            }`}
          >
            {screenProtection?.status_code === 'active'
              ? 'Active'
              : screenProtection?.status_code === 'partial'
              ? 'Partial'
              : screenProtection?.status_code === 'unsupported'
              ? 'Unsupported'
              : screenProtection?.active
              ? 'Active'
              : 'Disabled'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-theme-surface border border-slate-200/90 dark:border-theme-border flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-slate-900 dark:text-theme-text flex items-center gap-2">
            <span>Screen Shield</span>
            {screenProtection?.platform && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-theme-bg border border-slate-200 dark:border-theme-border text-slate-600 dark:text-theme-text-muted uppercase font-mono">
                {screenProtection.platform}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setScreenProtection(!screenProtection?.active)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0 min-h-[38px] ${
              screenProtection?.status_code === 'unsupported'
                ? 'bg-slate-100 dark:bg-theme-hover border-slate-300 dark:border-theme-border text-slate-500 dark:text-theme-text-muted opacity-80 cursor-not-allowed'
                : screenProtection?.active
                ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-xs'
                : 'bg-slate-100 dark:bg-theme-hover border-slate-300 dark:border-theme-border text-slate-700 dark:text-theme-text hover:bg-slate-200'
            }`}
            disabled={screenProtection?.status_code === 'unsupported'}
          >
            {screenProtection?.status_code === 'unsupported'
              ? 'Unsupported'
              : screenProtection?.active
              ? 'Protected'
              : 'Enable'}
          </button>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={triggerPrivacyShieldTest}
            className="w-full sm:w-auto py-2 px-3 rounded-xl bg-slate-100 dark:bg-theme-surface hover:bg-slate-200 dark:hover:bg-theme-hover border border-slate-200 dark:border-theme-border text-xs text-slate-700 dark:text-theme-text font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[38px]"
          >
            Test Screen Shield
          </button>
        </div>
      </div>
    </div>
  );
};
