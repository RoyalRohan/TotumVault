import React, { useState } from 'react';
import { Download, RefreshCw, X, AlertCircle, ArrowRight } from 'lucide-react';
import { UpdateInfo } from '../types';
import { downloadAndInstallUpdate } from '../utils/updater';

interface UpdateDialogProps {
  updateInfo: UpdateInfo;
  onClose: () => void;
  onSkipVersion: (version: string) => void;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
  updateInfo,
  onClose,
  onSkipVersion,
}) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUpdateNow = async () => {
    setIsUpdating(true);
    setErrorMessage(null);
    setProgress(5);
    setStatusText('Initiating update...');

    try {
      await downloadAndInstallUpdate(updateInfo, (pct, status) => {
        setProgress(pct);
        setStatusText(status);
      });
    } catch (err: any) {
      setIsUpdating(false);
      setErrorMessage(err?.message || 'Failed to download or install update');
    }
  };

  const handleLater = () => {
    // Dismiss for the current session
    sessionStorage.setItem('totumvault_dismissed_update_session', updateInfo.latestVersion);
    onClose();
  };

  const handleSkip = () => {
    onSkipVersion(updateInfo.latestVersion);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-theme-surface border border-slate-200 dark:border-theme-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-theme-border/60 flex items-center justify-between bg-slate-50/50 dark:bg-theme-bg/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-theme-text">
                TotumVault Update Available
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-theme-text-muted">
                <span>v{updateInfo.currentVersion}</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  v{updateInfo.latestVersion}
                </span>
              </div>
            </div>
          </div>

          {!isUpdating && (
            <button
              onClick={handleLater}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-theme-text hover:bg-slate-100 dark:hover:bg-theme-hover transition-colors cursor-pointer"
              title="Close for this session"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-80 overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Update Error</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-theme-text-muted mb-1.5">
              Release Notes
            </h3>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-theme-bg/60 border border-slate-200/80 dark:border-theme-border/80 text-xs text-slate-700 dark:text-theme-text font-sans whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {updateInfo.releaseNotes || 'Security improvements and stability enhancements.'}
            </div>
          </div>

          {/* Progress Section */}
          {isUpdating && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-theme-text">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600 dark:text-purple-400" />
                  {statusText || 'Updating...'}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-theme-border rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-600 dark:bg-purple-500 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-theme-border/60 bg-slate-50/50 dark:bg-theme-bg/30 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={isUpdating}
            onClick={handleSkip}
            className="text-xs text-slate-500 dark:text-theme-text-muted hover:text-slate-700 dark:hover:text-theme-text underline cursor-pointer disabled:opacity-50"
          >
            Skip This Version
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isUpdating}
              onClick={handleLater}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-theme-border text-slate-700 dark:text-theme-text hover:bg-slate-100 dark:hover:bg-theme-hover transition-colors cursor-pointer disabled:opacity-50"
            >
              Later
            </button>

            <button
              type="button"
              disabled={isUpdating}
              onClick={handleUpdateNow}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-2 shadow-xs shadow-purple-600/30"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Update Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
