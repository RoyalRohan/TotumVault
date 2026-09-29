import React, { useState } from 'react';
import { WifiOff, Shield, Activity } from 'lucide-react';
import { useVault } from '../../../context/VaultContext';

export const PrivacyNetworkSettings: React.FC = () => {
  const {
    airGapMode,
    airGapStatus,
    toggleAirGapMode,
    testAirGapBlocking,
  } = useVault();

  const [isTestingAirGap, setIsTestingAirGap] = useState(false);
  const [airGapTestResult, setAirGapTestResult] = useState<string | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Category Header */}
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-theme-text">Privacy & Network</h3>
        <p className="text-xs text-slate-500 dark:text-theme-text-muted mt-0.5">
          Application-level network firewall and connectivity isolation.
        </p>
      </div>

      {/* Air-Gap Mode Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-theme-text-muted">
              Air-Gap Mode
            </h4>
          </div>
          <span
            className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
              airGapMode
                ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-500/40'
                : 'bg-slate-100 dark:bg-theme-surface text-slate-600 dark:text-theme-text-muted border-slate-200 dark:border-theme-border'
            }`}
          >
            {airGapStatus?.status_text || (airGapMode ? 'Network access blocked' : 'Network access allowed')}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-theme-surface/70 border border-slate-200/80 dark:border-theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-900 dark:text-theme-text font-semibold">
              Application-Level Network Firewall
            </p>
            <p className="text-xs text-slate-600 dark:text-theme-text-muted leading-relaxed">
              Blocks all outbound network requests from TotumVault while preserving all local vault operations, encryption, documents, biometrics, and search.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-theme-text-muted pt-0.5">
              Your device's internet connection remains active for other applications; only TotumVault itself is isolated.
            </p>
          </div>

          <button
            type="button"
            onClick={toggleAirGapMode}
            className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer shrink-0 transition-colors flex items-center justify-center gap-1.5 shadow-xs min-h-[42px] ${
              airGapMode
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-white dark:bg-theme-surface border border-slate-300 dark:border-theme-border text-slate-700 dark:text-theme-text hover:bg-slate-50 dark:hover:bg-theme-hover'
            }`}
          >
            {airGapMode ? (
              <>
                <WifiOff className="w-3.5 h-3.5 stroke-[2.25]" />
                <span>Air-Gap ON</span>
              </>
            ) : (
              <>
                <Shield className="w-3.5 h-3.5 stroke-[2.25]" />
                <span>Air-Gap OFF</span>
              </>
            )}
          </button>
        </div>

        {/* Controlled Test Probe */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-theme-surface border border-slate-200/90 dark:border-theme-border space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-semibold text-slate-900 dark:text-theme-text">
              Network Isolation Verification
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-theme-text-muted">
            Send a safe diagnostic probe through the application network policy to verify whether outbound traffic is blocked or allowed.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <button
              type="button"
              disabled={isTestingAirGap}
              onClick={async () => {
                setIsTestingAirGap(true);
                setAirGapTestResult(null);
                try {
                  const res = await testAirGapBlocking();
                  setAirGapTestResult(res);
                } catch (err: any) {
                  setAirGapTestResult(err?.message || 'Network test failed');
                } finally {
                  setIsTestingAirGap(false);
                }
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-purple-200 dark:border-purple-500/30 bg-purple-50/60 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 cursor-pointer shrink-0 transition-colors disabled:opacity-50 min-h-[38px]"
            >
              {isTestingAirGap ? 'Testing Network Policy...' : 'Test Network Blocking'}
            </button>

            {airGapTestResult && (
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border leading-tight ${
                  airGapTestResult.includes('Blocked')
                    ? 'text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-500/30'
                    : 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30'
                }`}
              >
                {airGapTestResult}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
