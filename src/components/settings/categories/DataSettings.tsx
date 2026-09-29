import React, { useState } from 'react';
import { Database, HardDriveDownload, HardDriveUpload, FileSpreadsheet } from 'lucide-react';
import { useVault } from '../../../context/VaultContext';

export const DataSettings: React.FC = () => {
  const {
    exportBackup,
    exportCsv,
    setIsImportExportOpen,
  } = useVault();

  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const handleExportBackup = async () => {
    setIsExportingBackup(true);
    try {
      await exportBackup();
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleExportCsv = async () => {
    if (!confirm('Exporting to CSV saves passwords in plaintext. Anyone with access to the file can view your passwords. Proceed?')) {
      return;
    }
    setIsExportingCsv(true);
    try {
      await exportCsv();
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Import & Export */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-theme-text">
            Import & Export
          </h4>
        </div>

        {/* Encrypted Vault Backup Card */}
        <div className="p-4 rounded-xl bg-white dark:bg-theme-surface border border-slate-200/90 dark:border-theme-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0">
              <HardDriveDownload className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-theme-text block">
                Encrypted Backup
              </span>
              <span className="text-[11px] text-slate-500 dark:text-theme-text-muted">
                .tvault format
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={isExportingBackup}
            onClick={handleExportBackup}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shrink-0 transition-colors shadow-xs disabled:opacity-50 min-h-[38px]"
          >
            {isExportingBackup ? 'Exporting...' : 'Export .tvault'}
          </button>
        </div>

        {/* Import Wizard Card */}
        <div className="p-4 rounded-xl bg-white dark:bg-theme-surface border border-slate-200/90 dark:border-theme-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0">
              <HardDriveUpload className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-theme-text block">
                Import Data
              </span>
              <span className="text-[11px] text-slate-500 dark:text-theme-text-muted">
                Restore from backup or import passwords
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsImportExportOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 cursor-pointer shrink-0 transition-colors min-h-[38px]"
          >
            Open Import Wizard
          </button>
        </div>

        {/* Plaintext CSV Export Card */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-theme-surface/70 border border-slate-200/80 dark:border-theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-theme-text block">
                  CSV Export
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 text-amber-800 dark:text-amber-400 font-bold uppercase font-mono">
                  Unencrypted
                </span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400 pt-0.5">
                CSV is not encrypted.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isExportingCsv}
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer shrink-0 transition-colors min-h-[38px]"
          >
            {isExportingCsv ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>
    </div>
  );
};
