import React, { useState } from 'react';
import { RefreshCw, Download, ExternalLink, Sparkles, Check, WifiOff, Clock } from 'lucide-react';
import { useVault } from '../../../context/VaultContext';
import { openUrl } from '@tauri-apps/plugin-opener';

export const UpdatesSettings: React.FC = () => {
  const {
    appVersion,
    updateInfo,
    isCheckingUpdate,
    checkForUpdates,
    lastUpdateChecked,
    airGapMode,
  } = useVault();

  const [checkOnStartup, setCheckOnStartup] = useState<boolean>(() => {
    return (
      localStorage.getItem('totumvault_auto_update_check') !== 'false' &&
      localStorage.getItem('totumvault_check_updates_on_startup') !== 'false'
    );
  });

  const rawVersion = appVersion?.version || updateInfo?.currentVersion;
  const currentVersion = rawVersion ? `v${rawVersion}` : 'Unavailable';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Subsection 1: Current Version */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-theme-surface/70 border border-slate-200/80 dark:border-theme-border flex items-center justify-between">
        <span className="text-xs font-bold text-slate-900 dark:text-theme-text">Current Version</span>
        <span className="text-xs font-mono text-purple-700 dark:text-purple-400 font-bold bg-white dark:bg-theme-surface px-3 py-1 rounded-lg border border-purple-200 dark:border-theme-border">
          {currentVersion}
        </span>
      </div>

      {/* Subsection 2: Automatic Updates */}
      <div className="space-y-3 pt-5 border-t border-slate-200/80 dark:border-theme-border">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-theme-text-muted block">
          Automatic Updates
        </h4>
        <div className="p-3.5 rounded-xl bg-white dark:bg-theme-surface border border-slate-200/90 dark:border-theme-border flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900 dark:text-theme-text">
            Check for updates on startup
          </span>

          <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
            <input
              type="checkbox"
              checked={checkOnStartup}
              onChange={(e) => {
                const checked = e.target.checked;
                setCheckOnStartup(checked);
                localStorage.setItem('totumvault_auto_update_check', checked ? 'true' : 'false');
                localStorage.setItem('totumvault_check_updates_on_startup', checked ? 'true' : 'false');
              }}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </div>

      {/* Subsection 3: Update Check */}
      <div className="space-y-3 pt-5 border-t border-slate-200/80 dark:border-theme-border">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-theme-text-muted block">
            Update Check
          </h4>
          {lastUpdateChecked && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-theme-text-muted">
              <Clock className="w-3 h-3" />
              <span>Last checked: {lastUpdateChecked}</span>
            </div>
          )}
        </div>

        {/* Air-Gap Active Notice in Updates */}
        {airGapMode && (
          <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/40 text-xs text-purple-900 dark:text-purple-300 flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>Updates unavailable while Air-Gap Mode is enabled.</span>
          </div>
        )}

        <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-theme-surface border border-slate-200/90 dark:border-theme-border">
          <span className="text-xs font-medium text-slate-700 dark:text-theme-text-muted">
            Release Channel
          </span>

          <button
            type="button"
            onClick={() => checkForUpdates(true)}
            disabled={isCheckingUpdate || airGapMode}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shrink-0 transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50 min-h-[38px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
            <span>{isCheckingUpdate ? 'Checking...' : 'Check for Updates'}</span>
          </button>
        </div>

        {/* Status indicator when checking */}
        {isCheckingUpdate && (
          <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/30 text-xs text-purple-800 dark:text-purple-300 flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-600 dark:text-purple-400 shrink-0" />
            <span>Checking official release repository...</span>
          </div>
        )}

        {/* Up to date state */}
        {updateInfo && !updateInfo.hasUpdate && (
          <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>TotumVault is up to date{rawVersion ? ` (${currentVersion})` : ''}.</span>
          </div>
        )}

        {/* Update available card */}
        {updateInfo && updateInfo.hasUpdate && (
          <div className="p-4 rounded-xl bg-purple-50/90 dark:bg-purple-950/30 border border-purple-300 dark:border-purple-500/50 space-y-3 animate-scale-up">
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
              <div className="max-h-32 overflow-y-auto p-2.5 rounded-lg bg-white/70 dark:bg-theme-bg/60 border border-purple-200 dark:border-theme-border text-[11px] text-slate-700 dark:text-theme-text-muted whitespace-pre-line font-sans leading-relaxed">
                {updateInfo.releaseNotes}
              </div>
            )}

            {updateInfo.assetName && (
              <div className="text-[11px] text-slate-600 dark:text-theme-text-muted flex items-center justify-between font-mono bg-white/50 dark:bg-theme-bg/40 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-theme-border">
                <span className="truncate mr-2">{updateInfo.assetName}</span>
                {updateInfo.assetSize && <span>{(updateInfo.assetSize / (1024 * 1024)).toFixed(1)} MB</span>}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-1">
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
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-purple-300 dark:border-purple-500/40 bg-white dark:bg-theme-surface text-purple-700 dark:text-purple-300 hover:bg-purple-50 cursor-pointer flex items-center gap-1.5 transition-colors min-h-[38px]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Release Notes</span>
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
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer flex items-center gap-1.5 transition-colors shadow-xs min-h-[38px]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download & Install</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
