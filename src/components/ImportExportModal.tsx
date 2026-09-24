import React, { useState, useRef } from 'react';
import {
  X,
  HardDriveDownload,
  HardDriveUpload,
  Shield,
  FileSpreadsheet,
  FileUp,
  Check,
  Lock,
  Folder,
  AlertTriangle,
  Copy,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  Layers,
  Trash2,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { ImportPreview, ImportResultSummary } from '../types';

export const ImportExportModal: React.FC = () => {
  const {
    isImportExportOpen,
    setIsImportExportOpen,
    exportBackup,
    exportCsv,
    analyzeImport,
    commitImport,
    copyToClipboard,
    showToast,
  } = useVault();

  // Mode: 'export' or 'import'
  const [mode, setMode] = useState<'export' | 'import'>('export');
  const [exportFormat, setExportFormat] = useState<'tvault' | 'csv'>('tvault');

  // Success state after export
  const [exportSuccess, setExportSuccess] = useState<{
    path: string;
    filename: string;
    content: string;
    format: 'tvault' | 'csv';
  } | null>(null);
  const [copiedContent, setCopiedContent] = useState(false);

  // Safe Import workflow state
  const [importStep, setImportStep] = useState<'select' | 'preview' | 'confirm_replace' | 'summary'>('select');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [importPath, setImportPath] = useState('');
  const [importContent, setImportContent] = useState('');
  const [importPass, setImportPass] = useState('');
  const [detectedType, setDetectedType] = useState<'tvault' | 'csv' | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'keep_existing' | 'import_both' | 'replace_existing'>('keep_existing');
  const [importSummary, setImportSummary] = useState<ImportResultSummary | null>(null);
  const [showDuplicatesList, setShowDuplicatesList] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isImportExportOpen) return null;

  // Handle Export: Opens native OS / Android system Save Document dialog
  const handleExport = async () => {
    setIsProcessing(true);
    const date = new Date().toISOString().slice(0, 10);
    const defaultFilename = exportFormat === 'tvault' ? `totumvault_backup_${date}.tvault` : `totumvault_export_${date}.csv`;

    if (exportFormat === 'csv') {
      if (!confirm('Exporting to CSV saves passwords unencrypted. Anyone with access to the file can view your passwords. Proceed?')) {
        setIsProcessing(false);
        return;
      }
    }

    try {
      let selectedPath: string | null = null;
      try {
        selectedPath = await save({
          defaultPath: defaultFilename,
          filters: exportFormat === 'tvault'
            ? [{ name: 'TotumVault Encrypted Backup (*.tvault)', extensions: ['tvault'] }]
            : [{ name: 'CSV Spreadsheet (*.csv)', extensions: ['csv'] }],
        });
      } catch (pickerErr: any) {
        const msg = (pickerErr?.message || pickerErr?.toString() || '').toLowerCase();
        if (msg.includes('cancel')) {
          setIsProcessing(false);
          return;
        }
        console.warn('Dialog save error, attempting direct path fallback:', pickerErr);
      }

      if (!selectedPath) {
        setIsProcessing(false);
        return;
      }

      const res = exportFormat === 'tvault'
        ? await exportBackup(selectedPath)
        : await exportCsv(selectedPath);

      let savedName = defaultFilename;
      let displayLocation = res.path;
      if (res.path.includes('/')) {
        savedName = res.path.split('/').pop() || defaultFilename;
      } else if (res.path.includes('\\')) {
        savedName = res.path.split('\\').pop() || defaultFilename;
      }

      if (res.path.startsWith('content:')) {
        try {
          const decoded = decodeURIComponent(res.path);
          const parts = decoded.split('/');
          savedName = parts[parts.length - 1] || defaultFilename;
          displayLocation = `Android Storage Provider: ${savedName}`;
        } catch {
          displayLocation = `Android System Storage (${savedName})`;
        }
      }

      setExportSuccess({
        path: displayLocation,
        filename: savedName,
        content: res.content,
        format: exportFormat,
      });
    } catch (err: any) {
      showToast(err?.toString() || 'Export failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyExportContent = () => {
    if (!exportSuccess) return;
    copyToClipboard(exportSuccess.content, `${exportSuccess.filename} content`);
    setCopiedContent(true);
    setTimeout(() => setCopiedContent(false), 3000);
  };

  // Handle native file picker for Restore / Import
  const handleChooseImportFile = async () => {
    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

    try {
      const selected = await open({
        multiple: false,
        title: 'Select TotumVault Backup or CSV',
        filters: isAndroid
          ? [
              {
                name: 'All Files (*.*)',
                extensions: ['*/*'],
              },
            ]
          : [
              {
                name: 'TotumVault Backups (*.tvault, *.vlock, *.csv, *.txt, *.json)',
                extensions: ['tvault', 'vlock', 'csv', 'txt', 'json'],
              },
              {
                name: 'All Files (*.*)',
                extensions: ['*'],
              },
            ],
      });

      if (!selected) return;

      const pathStr = typeof selected === 'string' ? selected : (selected as any)?.path || '';
      if (!pathStr) return;

      let displayName = pathStr;
      if (displayName.includes('/')) {
        displayName = displayName.split('/').pop() || displayName;
      }
      if (displayName.includes('\\')) {
        displayName = displayName.split('\\').pop() || displayName;
      }
      if (displayName.startsWith('content:')) {
        try {
          const decoded = decodeURIComponent(displayName);
          displayName = decoded.split('/').pop() || 'selected_backup.tvault';
        } catch {
          displayName = 'Android Selected Backup';
        }
      }

      setSelectedFileName(displayName);
      setImportPath(pathStr);

      // Attempt to read file content immediately via backend IPC command read_source_file
      // which properly handles Android content:// URIs, local storage paths, and scopes
      let loadedContent = '';
      try {
        loadedContent = await invoke<string>('read_source_file', { path: pathStr });
      } catch (readErr) {
        console.warn('Backend read_source_file error, falling back to readTextFile:', readErr);
        try {
          loadedContent = await readTextFile(pathStr);
        } catch (fsErr) {
          console.warn('Frontend readTextFile also failed:', fsErr);
        }
      }

      if (loadedContent) {
        setImportContent(loadedContent);
        const trimmed = loadedContent.trim();
        if (trimmed.startsWith('{') && (trimmed.includes('TOTUMVAULT_VAULT_V1') || trimmed.includes('VEYLOCK_VAULT_V1') || trimmed.includes('"magic"'))) {
          setDetectedType('tvault');
        } else if (trimmed.startsWith('{')) {
          setDetectedType('tvault');
        } else if (trimmed.includes(',') || trimmed.toLowerCase().startsWith('title')) {
          setDetectedType('csv');
        } else {
          setDetectedType(displayName.toLowerCase().endsWith('.csv') ? 'csv' : 'tvault');
        }
      } else {
        const lower = displayName.toLowerCase();
        if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
          setDetectedType('csv');
        } else {
          setDetectedType('tvault');
        }
      }
    } catch (err: any) {
      const msg = (err?.message || err?.toString() || '').toLowerCase();
      if (msg.includes('cancel')) {
        return;
      }
      console.warn('Native open dialog error, falling back to file input:', err);
      fileInputRef.current?.click();
    }
  };

  // Fallback File Selection for Import via HTML5 file input
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    const fullPath = (file as any).path || '';
    setImportPath(fullPath);

    try {
      const text = await file.text();
      setImportContent(text);
      const trimmed = text.trim();
      if (trimmed.startsWith('{') && (trimmed.includes('TOTUMVAULT_VAULT_V1') || trimmed.includes('VEYLOCK_VAULT_V1') || trimmed.includes('"magic"'))) {
        setDetectedType('tvault');
      } else if (trimmed.startsWith('{')) {
        setDetectedType('tvault');
      } else if (trimmed.includes(',') || trimmed.toLowerCase().startsWith('title')) {
        setDetectedType('csv');
      } else {
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
          setDetectedType('csv');
        } else {
          setDetectedType('tvault');
        }
      }
    } catch (err) {
      console.error('File read error:', err);
    }
  };

  // Step 1 -> Step 2: Validate and inspect import data
  const handleAnalyze = async () => {
    const source = importContent || importPath;
    if (!source) {
      showToast('Please select a file to import', 'error');
      return;
    }

    if (detectedType !== 'csv' && !importPass) {
      showToast('Enter the master password for this backup', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const preview = await analyzeImport(source, importPass || undefined);
      setImportPreview(preview);
      setImportStep('preview');
    } catch (err: any) {
      showToast(err?.toString() || 'Failed to inspect backup file. Check master password.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Commit the import with user choice: 'add' or 'replace'
  const handleCommit = async (commitMode: 'add' | 'replace') => {
    const source = importContent || importPath;
    if (!source) {
      showToast('No import file available', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const summary = await commitImport({
        src_path: source,
        master_password: importPass || undefined,
        mode: commitMode,
        duplicate_strategy: duplicateStrategy,
      });
      setImportSummary(summary);
      setImportStep('summary');
      showToast(`Import completed: ${summary.added} added, ${summary.duplicates} duplicates handled`, 'success');
    } catch (err: any) {
      showToast(err?.toString() || 'Import failed to apply', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetImportState = () => {
    setSelectedFileName('');
    setImportPath('');
    setImportContent('');
    setImportPass('');
    setDetectedType(null);
    setExportSuccess(null);
    setCopiedContent(false);
    setImportStep('select');
    setImportPreview(null);
    setDuplicateStrategy('keep_existing');
    setImportSummary(null);
    setShowDuplicatesList(false);
  };

  const handleClose = () => {
    setIsImportExportOpen(false);
    resetImportState();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md select-none">
      <div className="w-full max-w-lg glass-panel rounded-2xl p-5 sm:p-6 shadow-2xl border border-theme-border animate-scale-up max-h-[92vh] flex flex-col overflow-hidden">
        {/* Hidden Fallback File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="*/*,.vlock,.csv,.json,.txt,application/octet-stream,text/csv,text/plain"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-theme-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-sm shrink-0">
              {mode === 'export' ? <HardDriveDownload className="w-5 h-5" /> : <HardDriveUpload className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-theme-text tracking-tight">
                {exportSuccess
                  ? 'Export Completed'
                  : mode === 'export'
                  ? 'Export Vault'
                  : importStep === 'preview'
                  ? 'Import Preview & Options'
                  : importStep === 'confirm_replace'
                  ? 'Confirm Vault Overwrite'
                  : importStep === 'summary'
                  ? 'Import Summary'
                  : 'Import Vault'}
              </h2>
              <p className="text-xs text-theme-text-muted">
                {exportSuccess
                  ? 'Backup saved and ready on your device'
                  : mode === 'export'
                  ? 'Save an encrypted backup to your files'
                  : importStep === 'preview'
                  ? 'Review entries and resolve any duplicates'
                  : importStep === 'confirm_replace'
                  ? 'Warning: Destructive operation'
                  : importStep === 'summary'
                  ? 'Vault updated successfully'
                  : 'Restore credentials with safe duplicate preview'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-theme-surface text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* If Export Success View */}
        {exportSuccess ? (
          <div className="flex-1 overflow-y-auto py-5 space-y-4 pr-0.5 animate-scale-up">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-300">
                  File Saved Successfully!
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-200/80 leading-relaxed">
                  Your backup has been saved to your selected destination.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-theme-surface border border-theme-border space-y-2.5">
              <div>
                <span className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1">
                  Saved Filename
                </span>
                <span className="text-sm font-mono font-semibold text-theme-text break-all">
                  {exportSuccess.filename}
                </span>
              </div>
              <div className="pt-2 border-t border-theme-border">
                <span className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1">
                  Storage Location
                </span>
                <span className="text-xs font-mono text-theme-text-muted break-all bg-theme-bg px-2.5 py-1.5 rounded-lg block border border-theme-border">
                  {exportSuccess.path}
                </span>
              </div>
            </div>

            <div className="pt-2 space-y-2.5">
              <button
                type="button"
                onClick={handleCopyExportContent}
                className="w-full py-3 px-4 rounded-xl bg-theme-surface hover:bg-theme-bg border border-theme-border text-theme-text text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedContent ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-300">Backup Content Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-theme-text-muted" />
                    <span>Copy Raw Content to Clipboard</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setExportSuccess(null)}
                className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-medium shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Export / Import Mode Selector (Only on Step 'select') */}
            {importStep === 'select' && (
              <div className="flex bg-theme-surface p-1.5 rounded-xl border border-theme-border my-4 text-sm shrink-0">
                <button
                  type="button"
                  onClick={() => setMode('export')}
                  className={`flex-1 py-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    mode === 'export'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-theme-text-muted hover:text-theme-text'
                  }`}
                >
                  <HardDriveDownload className="w-4 h-4" />
                  <span>Export</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('import')}
                  className={`flex-1 py-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    mode === 'import'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-theme-text-muted hover:text-theme-text'
                  }`}
                >
                  <HardDriveUpload className="w-4 h-4" />
                  <span>Import</span>
                </button>
              </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-0.5 mt-2">
              {mode === 'export' ? (
                /* EXPORT SECTION */
                <div className="space-y-4">
                  {/* Format Choice */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block">
                      Choose Format
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setExportFormat('tvault')}
                        className={`p-3.5 sm:p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          exportFormat === 'tvault'
                            ? 'bg-purple-600/15 border-purple-500/50 text-purple-600 dark:text-purple-300 shadow-sm font-semibold'
                            : 'bg-theme-surface border-theme-border text-theme-text-muted hover:text-theme-text'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Shield className={`w-4 h-4 ${exportFormat === 'tvault' ? 'text-purple-400' : 'text-theme-text-muted'}`} />
                          <span className="text-sm font-semibold">Encrypted</span>
                        </div>
                        <span className="text-xs text-theme-text-muted block">.tvault (Full Vault Backup)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExportFormat('csv')}
                        className={`p-3.5 sm:p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          exportFormat === 'csv'
                            ? 'bg-amber-600/15 border-amber-500/50 text-amber-600 dark:text-amber-300 shadow-sm font-semibold'
                            : 'bg-theme-surface border-theme-border text-theme-text-muted hover:text-theme-text'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <FileSpreadsheet className={`w-4 h-4 ${exportFormat === 'csv' ? 'text-amber-500' : 'text-theme-text-muted'}`} />
                          <span className="text-sm font-semibold">CSV</span>
                        </div>
                        <span className="text-xs text-theme-text-muted block">.csv (Spreadsheet)</span>
                      </button>
                    </div>
                  </div>

                  {/* Destination Information */}
                  <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border text-xs space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-theme-text">
                      <Folder className="w-4 h-4 text-purple-400" />
                      <span>Save Destination</span>
                    </div>
                    <p className="text-theme-text-muted leading-relaxed">
                      Tap export to open your device's system file picker. You can choose any destination (Downloads, Documents, SD card, or Cloud storage).
                    </p>
                  </div>

                  {/* Security Hint */}
                  {exportFormat === 'csv' ? (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>CSV files are unencrypted. Anyone who opens the file can see your passwords in plain text.</span>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300 text-xs flex items-center gap-2.5">
                      <Shield className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Protected with your current master password using AES-256-GCM. Includes documents.</span>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={isProcessing}
                    className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-medium shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <HardDriveDownload className="w-4 h-4" />
                    <span>{isProcessing ? 'Opening File Picker...' : `Export ${exportFormat === 'tvault' ? 'Encrypted Backup' : 'CSV File'}`}</span>
                  </button>
                </div>
              ) : (
                /* IMPORT SECTION WITH 4-STEP WIZARD */
                <div className="space-y-4">
                  {/* STEP 1: SELECT FILE & ENTER PASSWORD */}
                  {importStep === 'select' && (
                    <div className="space-y-4 animate-scale-up">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block">
                          Select Backup or CSV File
                        </label>
                        <button
                          type="button"
                          onClick={handleChooseImportFile}
                          className="w-full p-5 rounded-xl border border-dashed border-theme-border hover:border-purple-500/60 bg-theme-surface/50 hover:bg-theme-surface transition-all flex flex-col items-center justify-center gap-2.5 cursor-pointer group"
                        >
                          <div className="w-11 h-11 rounded-xl bg-theme-surface group-hover:bg-purple-600/20 text-theme-text-muted group-hover:text-purple-400 flex items-center justify-center transition-colors">
                            <FileUp className="w-5 h-5" />
                          </div>
                          <div className="text-center">
                            <span className="text-sm font-semibold text-theme-text block">
                              {selectedFileName || 'Tap to choose file via system file picker'}
                            </span>
                            <span className="text-xs text-theme-text-muted mt-0.5 block">
                              Supports .tvault, .vlock (legacy backup), or .csv (spreadsheet)
                            </span>
                          </div>
                        </button>
                      </div>

                      {/* Password Field (Only for encrypted backup files) */}
                      {detectedType !== 'csv' && selectedFileName && (
                        <div className="space-y-1.5 animate-scale-up">
                          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block">
                            Backup Master Password
                          </label>
                          <div className="relative">
                            <input
                              type="password"
                              value={importPass}
                              onChange={(e) => setImportPass(e.target.value)}
                              placeholder="Enter password used when exporting this backup..."
                              className="input-themed w-full rounded-xl pl-9 pr-3.5 py-2.5 text-sm"
                            />
                            <Lock className="w-4 h-4 text-theme-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      )}

                      {/* Validate & Preview Button */}
                      <button
                        type="button"
                        onClick={handleAnalyze}
                        disabled={isProcessing || !selectedFileName || (detectedType !== 'csv' && !importPass)}
                        className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-medium shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <span>Inspecting File...</span>
                        ) : (
                          <>
                            <span>Inspect & Preview File</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* STEP 2: PREVIEW & DUPLICATE RESOLUTION */}
                  {importStep === 'preview' && importPreview && (
                    <div className="space-y-4 animate-scale-up">
                      {/* Top Bar Navigation */}
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setImportStep('select')}
                          className="flex items-center gap-1.5 text-xs text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-theme-surface"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Choose different file</span>
                        </button>
                        <span className="text-xs font-mono font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                          {importPreview.format.toUpperCase()}
                        </span>
                      </div>

                      {/* Stat Tiles */}
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="p-3 rounded-xl bg-theme-surface border border-theme-border text-center">
                          <span className="text-xl font-bold text-theme-text block">
                            {importPreview.total_imported}
                          </span>
                          <span className="text-[11px] text-theme-text-muted font-medium">To Import</span>
                        </div>
                        <div className="p-3 rounded-xl bg-theme-surface border border-theme-border text-center">
                          <span className="text-xl font-bold text-theme-text block">
                            {importPreview.existing_count}
                          </span>
                          <span className="text-[11px] text-theme-text-muted font-medium">In Vault</span>
                        </div>
                        <div className={`p-3 rounded-xl border text-center ${
                          importPreview.duplicate_count > 0
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                        }`}>
                          <span className="text-xl font-bold block">
                            {importPreview.duplicate_count}
                          </span>
                          <span className="text-[11px] font-medium">Duplicates</span>
                        </div>
                      </div>

                      {/* Category Breakdown & Document Note */}
                      <div className="p-3 rounded-xl bg-theme-surface border border-theme-border space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-theme-text-muted">
                          <span>Categories in File</span>
                          {importPreview.documents_count > 0 && (
                            <span className="text-purple-400 flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" />
                              {importPreview.documents_count} Documents included
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(importPreview.categories_breakdown).map(([cat, count]) => (
                            <span
                              key={cat}
                              className="text-xs bg-theme-bg border border-theme-border px-2 py-0.5 rounded-lg text-theme-text"
                            >
                              {cat}: <strong>{count}</strong>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Conflict / Duplicate Handling */}
                      {importPreview.duplicate_count > 0 ? (
                        <div className="space-y-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-300">
                              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                              <span>{importPreview.duplicate_count} Duplicate Items Detected</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowDuplicatesList(!showDuplicatesList)}
                              className="text-[11px] text-amber-600 dark:text-amber-300 underline font-medium cursor-pointer flex items-center gap-1"
                            >
                              <span>{showDuplicatesList ? 'Hide details' : 'View details'}</span>
                              {showDuplicatesList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </div>

                          {showDuplicatesList && (
                            <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1 pr-1 border-t border-amber-500/20 text-xs">
                              {importPreview.duplicates.map((dup, idx) => (
                                <div
                                  key={idx}
                                  className="p-2 rounded-lg bg-theme-bg/60 border border-theme-border flex items-center justify-between text-xs"
                                >
                                  <div className="min-w-0 pr-2">
                                    <span className="font-semibold text-theme-text truncate block">
                                      {dup.imported_title}
                                    </span>
                                    <span className="text-[10px] text-theme-text-muted block">
                                      Category: {dup.category} &bull; Matched: {dup.reason}
                                    </span>
                                  </div>
                                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold shrink-0">
                                    Conflict
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Duplicate Strategy Options */}
                          <div className="pt-2 border-t border-amber-500/20 space-y-1.5">
                            <label className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
                              Duplicate Resolution Strategy
                            </label>
                            <div className="grid grid-cols-3 gap-1.5 text-xs">
                              <button
                                type="button"
                                onClick={() => setDuplicateStrategy('keep_existing')}
                                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                                  duplicateStrategy === 'keep_existing'
                                    ? 'bg-amber-500 text-white font-bold border-amber-600 shadow-sm'
                                    : 'bg-theme-surface/80 border-theme-border text-theme-text hover:bg-theme-surface'
                                }`}
                              >
                                <span className="block text-xs font-semibold leading-tight">Keep Existing</span>
                                <span className="text-[10px] opacity-80 block mt-0.5 leading-tight">Skip duplicates</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setDuplicateStrategy('import_both')}
                                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                                  duplicateStrategy === 'import_both'
                                    ? 'bg-amber-500 text-white font-bold border-amber-600 shadow-sm'
                                    : 'bg-theme-surface/80 border-theme-border text-theme-text hover:bg-theme-surface'
                                }`}
                              >
                                <span className="block text-xs font-semibold leading-tight">Import Both</span>
                                <span className="text-[10px] opacity-80 block mt-0.5 leading-tight">Add as copies</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setDuplicateStrategy('replace_existing')}
                                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                                  duplicateStrategy === 'replace_existing'
                                    ? 'bg-amber-500 text-white font-bold border-amber-600 shadow-sm'
                                    : 'bg-theme-surface/80 border-theme-border text-theme-text hover:bg-theme-surface'
                                }`}
                              >
                                <span className="block text-xs font-semibold leading-tight">Replace Existing</span>
                                <span className="text-[10px] opacity-80 block mt-0.5 leading-tight">Update matching</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-600 dark:text-emerald-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>No duplicates found. All items will be cleanly imported into your vault.</span>
                        </div>
                      )}

                      {/* Primary Choice: Add to Existing Vault vs Replace Existing Vault */}
                      <div className="pt-2 space-y-2.5">
                        <button
                          type="button"
                          onClick={() => handleCommit('add')}
                          disabled={isProcessing}
                          className="w-full py-3.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <Layers className="w-4 h-4" />
                          <span>{isProcessing ? 'Importing...' : 'Add to Existing Vault (Safe Merge)'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setImportStep('confirm_replace')}
                          disabled={isProcessing}
                          className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Replace Existing Vault (Wipe & Restore)</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: EXPLICIT CONFIRMATION FOR REPLACE */}
                  {importStep === 'confirm_replace' && importPreview && (
                    <div className="space-y-4 py-2 animate-scale-up">
                      <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                          <ShieldAlert className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-rose-600 dark:text-rose-300">
                          Confirm Vault Replacement
                        </h3>
                        <p className="text-xs text-rose-700 dark:text-rose-200/90 leading-relaxed max-w-sm mx-auto">
                          This will permanently remove the existing vault entries after import. Continue?
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border text-xs space-y-2 text-theme-text-muted">
                        <div className="flex items-center justify-between">
                          <span>Current vault entries to be removed:</span>
                          <span className="font-bold text-rose-500">{importPreview.existing_count} items</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Imported entries to be written:</span>
                          <span className="font-bold text-purple-400">{importPreview.total_imported} items</span>
                        </div>
                        {importPreview.documents_count > 0 && (
                          <div className="flex items-center justify-between">
                            <span>Imported documents:</span>
                            <span className="font-bold text-emerald-500">{importPreview.documents_count} docs</span>
                          </div>
                        )}
                        <p className="pt-2 border-t border-theme-border text-[11px] text-theme-text-muted italic">
                          A local safety snapshot will be kept momentarily during the database transaction to prevent data corruption.
                        </p>
                      </div>

                      <div className="pt-2 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setImportStep('preview')}
                          disabled={isProcessing}
                          className="py-3 px-4 rounded-xl bg-theme-surface hover:bg-theme-bg border border-theme-border text-theme-text text-sm font-semibold transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCommit('replace')}
                          disabled={isProcessing}
                          className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-sm font-semibold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          {isProcessing ? 'Replacing...' : 'Confirm & Replace'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: RESULT SUMMARY */}
                  {importStep === 'summary' && importSummary && (
                    <div className="space-y-4 py-2 animate-scale-up">
                      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3.5">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                        <div className="space-y-1 min-w-0">
                          <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-300">
                            Import Complete!
                          </h3>
                          <p className="text-xs text-emerald-700 dark:text-emerald-200/80 leading-relaxed">
                            Your credentials and documents have been processed and encrypted into your vault.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-3 rounded-xl bg-theme-surface border border-theme-border">
                          <span className="text-[11px] text-theme-text-muted block">Added Entries</span>
                          <span className="text-lg font-bold text-emerald-500">{importSummary.added}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-theme-surface border border-theme-border">
                          <span className="text-[11px] text-theme-text-muted block">Skipped (Kept Existing)</span>
                          <span className="text-lg font-bold text-theme-text">{importSummary.skipped}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-theme-surface border border-theme-border">
                          <span className="text-[11px] text-theme-text-muted block">Replaced Existing</span>
                          <span className="text-lg font-bold text-purple-400">{importSummary.replaced}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-theme-surface border border-theme-border">
                          <span className="text-[11px] text-theme-text-muted block">Duplicates Handled</span>
                          <span className="text-lg font-bold text-amber-500">{importSummary.duplicates}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-theme-surface border border-theme-border">
                          <span className="text-[11px] text-theme-text-muted block">Documents Restored</span>
                          <span className="text-lg font-bold text-emerald-500">{importSummary.documents_imported}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-theme-surface border border-theme-border">
                          <span className="text-[11px] text-theme-text-muted block">Failed / Corrupt</span>
                          <span className="text-lg font-bold text-rose-500">{importSummary.failed}</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleClose}
                          className="w-full py-3.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
