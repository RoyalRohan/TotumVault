import React from 'react';
import { Shield, Lock, KeyRound, CameraOff, Fingerprint, WifiOff, CheckCircle2 } from 'lucide-react';
import { useVault } from '../../../context/VaultContext';
import logoImg from '../../../assets/logo.png';

export const GeneralSettings: React.FC = () => {
  const {
    status,
    appVersion,
    updateInfo,
    airGapMode,
    screenProtection,
    isBiometricEnabled,
  } = useVault();

  const rawVersion = appVersion?.version || updateInfo?.currentVersion;
  const currentVersion = rawVersion ? `v${rawVersion}` : '—';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-theme-text">
            Vault Status
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-theme-surface/70 border border-slate-200/80 dark:border-theme-border flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-theme-text-muted mb-2">
              <span className="font-medium">State</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-theme-text">
              {status.unlocked ? 'Unlocked' : 'Locked'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-theme-surface/70 border border-slate-200/80 dark:border-theme-border flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-theme-text-muted mb-2">
              <span className="font-medium">Auto-Lock</span>
              <KeyRound className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-theme-text">
              {status.auto_lock_minutes === 0 ? 'Never' : `${status.auto_lock_minutes}m`}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-theme-surface/70 border border-slate-200/80 dark:border-theme-border flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-theme-text-muted mb-2">
              <span className="font-medium">Encryption</span>
              <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-theme-text font-mono text-xs">
              Argon2id + AES-256-GCM
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200/80 dark:border-theme-border pt-5 space-y-3">
        <h4 className="text-sm font-bold text-slate-900 dark:text-theme-text">
          Active Protections
        </h4>

        <div className="space-y-2">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-theme-surface/70 border border-slate-200/80 dark:border-theme-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <WifiOff className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-900 dark:text-theme-text">Air-Gap Mode</span>
            </div>
            <span
              className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
                airGapMode
                  ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-500/40'
                  : 'bg-slate-100 dark:bg-theme-surface text-slate-600 dark:text-theme-text-muted border-slate-200 dark:border-theme-border'
              }`}
            >
              {airGapMode ? 'Blocked' : 'Normal'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-theme-surface/70 border border-slate-200/80 dark:border-theme-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <CameraOff className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-900 dark:text-theme-text">Screen Protection</span>
            </div>
            <span
              className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
                screenProtection?.active
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                  : 'bg-slate-100 dark:bg-theme-surface text-slate-600 dark:text-theme-text-muted border-slate-200 dark:border-theme-border'
              }`}
            >
              {screenProtection?.active ? 'Active' : 'Disabled'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-theme-surface/70 border border-slate-200/80 dark:border-theme-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <Fingerprint className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-900 dark:text-theme-text">Biometric Unlock</span>
            </div>
            <span
              className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
                isBiometricEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                  : 'bg-slate-100 dark:bg-theme-surface text-slate-600 dark:text-theme-text-muted border-slate-200 dark:border-theme-border'
              }`}
            >
              {isBiometricEnabled ? 'Ready' : 'Not Set Up'}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200/80 dark:border-theme-border pt-5">
        <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center p-1 bg-white dark:bg-theme-surface border border-theme-border shadow-xs shrink-0">
              <img src={logoImg} alt="TotumVault" className="w-full h-full object-cover rounded-md" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-theme-text block">TotumVault</span>
              <span className="text-[11px] text-slate-500 dark:text-theme-text-muted block">
                Offline Password & Document Vault
              </span>
            </div>
          </div>
          <span className="text-xs font-mono text-purple-700 dark:text-purple-400 font-semibold bg-white dark:bg-theme-surface px-2.5 py-1 rounded-md border border-purple-200 dark:border-theme-border">
            {currentVersion}
          </span>
        </div>
      </div>
    </div>
  );
};
