import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  CategoryType,
  DecryptedEntry,
  DocumentDetail,
  DocumentMetadata,
  ImportCommitOptions,
  ImportPreview,
  ImportResultSummary,
  PwGenConfig,
  SaveDocumentInput,
  SavePageInput,
  VaultHealthReport,
  VaultStatus,
} from '../types';

export interface ExportResult {
  path: string;
  content: string;
}

interface VaultContextType {
  status: VaultStatus;
  entries: DecryptedEntry[];
  documents: DocumentMetadata[];
  selectedEntryId: string | null;
  selectedDocumentId: string | null;
  activeCategory: CategoryType;
  searchQuery: string;
  isGeneratorOpen: boolean;
  isSettingsOpen: boolean;
  isEditorOpen: boolean;
  editingEntry: DecryptedEntry | null;
  isImportExportOpen: boolean;
  healthReport: VaultHealthReport | null;
  toast: { message: string; type?: 'info' | 'success' | 'warning' | 'error' } | null;
  isMobileNavOpen: boolean;
  setIsMobileNavOpen: (open: boolean) => void;

  // Actions
  refreshStatus: () => Promise<void>;
  createVault: (password: string) => Promise<void>;
  unlockVault: (password: string) => Promise<boolean>;
  lockVault: () => Promise<void>;
  saveEntry: (entry: DecryptedEntry, isFavoriteToggle?: boolean) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  setSelectedEntryId: (id: string | null) => void;
  setSelectedDocumentId: (id: string | null) => void;
  setActiveCategory: (cat: CategoryType) => void;
  setSearchQuery: (q: string) => void;
  openEditor: (entry?: DecryptedEntry, category?: CategoryType) => void;
  closeEditor: () => void;
  initialEditorCategory: CategoryType | null;

  // Document Vault Scanner State & Actions
  isScannerOpen: boolean;
  setIsScannerOpen: (open: boolean) => void;
  scannerInitialMode: 'camera' | 'upload';
  setScannerInitialMode: (mode: 'camera' | 'upload') => void;
  scannerTargetDocId?: string;
  setScannerTargetDocId: (id?: string) => void;
  openScanner: (mode?: 'camera' | 'upload', targetDocId?: string) => void;
  closeScanner: () => void;
  setIsGeneratorOpen: (open: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setIsImportExportOpen: (open: boolean) => void;
  copyToClipboard: (text: string, label: string) => Promise<void>;
  generatePassword: (config: PwGenConfig) => Promise<string>;
  setAutoLockTimer: (minutes: number) => Promise<void>;
  fetchHealthReport: () => Promise<void>;
  exportBackup: (path?: string) => Promise<ExportResult>;
  importBackup: (path: string, password: string) => Promise<void>;
  changeMasterPassword: (oldP: string, newP: string) => Promise<void>;
  exportCsv: (path?: string) => Promise<ExportResult>;
  importCsv: (path: string) => Promise<number>;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;

  // Document Vault Actions
  refreshDocuments: () => Promise<void>;
  saveDocument: (doc: SaveDocumentInput) => Promise<string>;
  addDocumentPage: (documentId: string, page: SavePageInput) => Promise<string>;
  deleteDocument: (id: string) => Promise<void>;
  deleteDocumentPage: (pageId: string) => Promise<void>;
  reorderDocumentPages: (documentId: string, pageIds: string[]) => Promise<void>;
  toggleDocumentFavorite: (id: string) => Promise<void>;
  getDocumentDetail: (id: string) => Promise<DocumentDetail>;
  getDocumentPageData: (pageId: string) => Promise<string>;

  // Safe Import Actions
  analyzeImport: (srcPathOrContent: string, password?: string) => Promise<ImportPreview>;
  commitImport: (options: ImportCommitOptions) => Promise<ImportResultSummary>;
}


const VaultContext = createContext<VaultContextType | null>(null);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<VaultStatus>({
    exists: false,
    unlocked: false,
    auto_lock_minutes: 5,
    entry_count: 0,
  });
  const [entries, setEntries] = useState<DecryptedEntry[]>([]);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DecryptedEntry | null>(null);
  const [initialEditorCategory, setInitialEditorCategory] = useState<CategoryType | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerInitialMode, setScannerInitialMode] = useState<'camera' | 'upload'>('camera');
  const [scannerTargetDocId, setScannerTargetDocId] = useState<string | undefined>(undefined);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [healthReport, setHealthReport] = useState<VaultHealthReport | null>(null);
  const [toast, setToast] = useState<{ message: string; type?: 'info' | 'success' | 'warning' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setToast({ message, type });
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const refreshDocuments = useCallback(async () => {
    try {
      const docs = await invoke<DocumentMetadata[]>('list_documents');
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to list documents:', err);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await invoke<VaultStatus>('get_vault_status');
      setStatus(res);
      if (res.unlocked) {
        const [fetchedEntries, fetchedDocs] = await Promise.all([
          invoke<DecryptedEntry[]>('get_entries'),
          invoke<DocumentMetadata[]>('list_documents'),
        ]);
        setEntries(fetchedEntries);
        setDocuments(fetchedDocs);
      } else {
        setEntries([]);
        setDocuments([]);
        setSelectedEntryId(null);
        setSelectedDocumentId(null);
      }
    } catch (err) {
      console.error('Tauri IPC call failed:', err);
    }
  }, []);

  const createVault = useCallback(async (password: string) => {
    if (!password || password.trim().length < 8) {
      showToast('Master password must be at least 8 characters long.', 'error');
      throw new Error('Master password too short');
    }

    try {
      const res = await invoke<VaultStatus>('create_vault', { masterPassword: password });
      setStatus(res);
      showToast('Vault created successfully!', 'success');
      await refreshStatus();
    } catch (err: any) {
      showToast(err.toString(), 'error');
      throw err;
    }
  }, [showToast, refreshStatus]);

  const unlockVault = useCallback(async (password: string): Promise<boolean> => {
    if (!password) {
      showToast('Master password is required.', 'error');
      return false;
    }

    try {
      const success = await invoke<boolean>('unlock_vault', { masterPassword: password });
      if (success) {
        showToast('Vault unlocked', 'success');
        await refreshStatus();
        return true;
      } else {
        showToast('Incorrect master password', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(err.toString(), 'error');
      return false;
    }
  }, [showToast, refreshStatus]);

  const clipboardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipboardClearTimeRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const lastBackendTouchRef = useRef<number>(Date.now());

  const lockVault = useCallback(async () => {
    if (clipboardTimeoutRef.current) {
      clearTimeout(clipboardTimeoutRef.current);
      clipboardTimeoutRef.current = null;
    }
    clipboardClearTimeRef.current = null;
    try {
      await invoke('lock_vault');
    } catch (err: any) {
      console.error('Lock vault failed:', err);
    }
    try {
      await navigator.clipboard.writeText('');
    } catch {
      // ignore when window does not have clipboard focus
    }
    setStatus((prev) => ({ ...prev, unlocked: false }));
    setEntries([]);
    setDocuments([]);
    setSelectedEntryId(null);
    setSelectedDocumentId(null);
    setEditingEntry(null);
    setHealthReport(null);
    showToast('Vault locked', 'info');
  }, [showToast]);


  const saveEntry = useCallback(async (entry: DecryptedEntry, isFavoriteToggle = false) => {
    try {
      const id = await invoke<string>('save_entry', { entry });
      if (isFavoriteToggle) {
        showToast(entry.favorite ? 'Added to favorites' : 'Removed from favorites', 'info');
      } else {
        showToast('Entry saved securely', 'success');
        setIsEditorOpen(false);
      }
      await refreshStatus();
      setSelectedEntryId(id);
    } catch (err: any) {
      showToast(err.toString(), 'error');
    }
  }, [showToast, refreshStatus]);

  const deleteEntry = useCallback(async (id: string) => {
    try {
      await invoke('delete_entry', { id });
      showToast('Entry deleted', 'info');
      setSelectedEntryId((prev) => (prev === id ? null : prev));
      await refreshStatus();
    } catch (err: any) {
      showToast(err.toString(), 'error');
    }
  }, [showToast, refreshStatus]);

  const openEditor = useCallback((entry?: DecryptedEntry, category?: CategoryType) => {
    setEditingEntry(entry || null);
    setInitialEditorCategory(category || null);
    setIsEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditingEntry(null);
    setInitialEditorCategory(null);
    setIsEditorOpen(false);
  }, []);

  const openScanner = useCallback((mode: 'camera' | 'upload' = 'camera', targetDocId?: string) => {
    setScannerInitialMode(mode);
    setScannerTargetDocId(targetDocId);
    setIsScannerOpen(true);
  }, []);

  const closeScanner = useCallback(() => {
    setIsScannerOpen(false);
    setScannerTargetDocId(undefined);
  }, []);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied! Will auto-clear in 30s.`, 'success');
      clipboardClearTimeRef.current = Date.now() + 30000;

      if (clipboardTimeoutRef.current) {
        clearTimeout(clipboardTimeoutRef.current);
      }
      clipboardTimeoutRef.current = setTimeout(async () => {
        try {
          await navigator.clipboard.writeText('');
        } catch {
          // ignore focus errors
        }
        clipboardClearTimeRef.current = null;
      }, 30000);
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  }, [showToast]);

  const generatePassword = useCallback(async (config: PwGenConfig): Promise<string> => {
    try {
      return await invoke<string>('generate_password', { config });
    } catch (err: any) {
      showToast(err.toString(), 'error');
      return '';
    }
  }, [showToast]);

  const setAutoLockTimer = useCallback(async (minutes: number) => {
    try {
      await invoke('set_auto_lock_timer', { minutes });
      setStatus((prev) => ({ ...prev, auto_lock_minutes: minutes }));
      showToast(`Auto-lock set to ${minutes === 0 ? 'Never' : minutes + ' minute(s)'}`, 'info');
    } catch (err: any) {
      showToast(err.toString(), 'error');
    }
  }, [showToast]);

  const fetchHealthReport = useCallback(async () => {
    try {
      const report = await invoke<VaultHealthReport>('get_vault_health');
      setHealthReport(report);
    } catch (err: any) {
      console.error('Fetch health report failed:', err);
    }
  }, []);

  const exportBackup = useCallback(async (path?: string): Promise<ExportResult> => {
    try {
      const res = await invoke<ExportResult>('export_vault_backup', { destPath: path || null });
      showToast('Encrypted vault backup exported successfully!', 'success');
      return res;
    } catch (err: any) {
      showToast(err.toString(), 'error');
      throw err;
    }
  }, [showToast]);

  const importBackup = useCallback(async (path: string, password: string) => {
    try {
      await invoke('import_vault_backup', { srcPath: path, masterPassword: password });
      showToast('Backup restored successfully!', 'success');
      await refreshStatus();
    } catch (err: any) {
      showToast(err.toString(), 'error');
      throw err;
    }
  }, [showToast, refreshStatus]);

  const changeMasterPassword = useCallback(async (oldP: string, newP: string) => {
    if (!newP || newP.trim().length < 8) {
      showToast('New master password must be at least 8 characters long.', 'error');
      throw new Error('New master password too short');
    }

    try {
      await invoke('change_master_password', { oldPassword: oldP, newPassword: newP });
      showToast('Master password updated!', 'success');
    } catch (err: any) {
      showToast(err.toString(), 'error');
      throw err;
    }
  }, [showToast]);

  const exportCsv = useCallback(async (path?: string): Promise<ExportResult> => {
    try {
      const res = await invoke<ExportResult>('export_plaintext_csv', { destPath: path || null });
      showToast('CSV exported. WARNING: File contains plaintext passwords!', 'warning');
      return res;
    } catch (err: any) {
      showToast(err.toString(), 'error');
      throw err;
    }
  }, [showToast]);

  const importCsv = useCallback(async (path: string): Promise<number> => {
    try {
      const count = await invoke<number>('import_plaintext_csv', { srcPath: path });
      showToast(`Imported ${count} credentials from CSV`, 'success');
      await refreshStatus();
      return count;
    } catch (err: any) {
      showToast(err.toString(), 'error');
      return 0;
    }
  }, [showToast, refreshStatus]);

  // Document Vault Actions
  const saveDocument = useCallback(async (doc: SaveDocumentInput): Promise<string> => {
    try {
      const docId = await invoke<string>('save_document', { document: doc });
      showToast('Document saved securely', 'success');
      await refreshDocuments();
      setSelectedDocumentId(docId);
      return docId;
    } catch (err: any) {
      showToast(err.toString(), 'error');
      throw err;
    }
  }, [showToast, refreshDocuments]);

  const addDocumentPage = useCallback(async (documentId: string, page: SavePageInput): Promise<string> => {
    try {
      const pageId = await invoke<string>('add_document_page', { documentId, page });
      showToast('Page added securely', 'success');
      await refreshDocuments();
      return pageId;
    } catch (err: any) {
      showToast(err.toString(), 'error');
      throw err;
    }
  }, [showToast, refreshDocuments]);

  const deleteDocument = useCallback(async (id: string): Promise<void> => {
    try {
      await invoke('delete_document', { id });
      showToast('Document deleted', 'info');
      setSelectedDocumentId((prev) => (prev === id ? null : prev));
      await refreshDocuments();
    } catch (err: any) {
      showToast(err.toString(), 'error');
      throw err;
    }
  }, [showToast, refreshDocuments]);

  const deleteDocumentPage = useCallback(async (pageId: string): Promise<void> => {
    try {
      await invoke('delete_document_page', { pageId });
      showToast('Page deleted', 'info');
      await refreshDocuments();
    } catch (err: any) {
      showToast(err.toString(), 'error');
      throw err;
    }
  }, [showToast, refreshDocuments]);

  const reorderDocumentPages = useCallback(async (documentId: string, pageIds: string[]): Promise<void> => {
    try {
      await invoke('reorder_document_pages', { documentId, pageIds });
      await refreshDocuments();
    } catch (err: any) {
      showToast(err.toString(), 'error');
      throw err;
    }
  }, [showToast, refreshDocuments]);

  const toggleDocumentFavorite = useCallback(async (id: string): Promise<void> => {
    try {
      const isFav = await invoke<boolean>('toggle_document_favorite', { id });
      showToast(isFav ? 'Added to favorites' : 'Removed from favorites', 'info');
      await refreshDocuments();
    } catch (err: any) {
      showToast(err.toString(), 'error');
    }
  }, [showToast, refreshDocuments]);

  const getDocumentDetail = useCallback(async (id: string): Promise<DocumentDetail> => {
    return await invoke<DocumentDetail>('get_document', { id });
  }, []);

  const getDocumentPageData = useCallback(async (pageId: string): Promise<string> => {
    return await invoke<string>('get_document_page_data', { pageId });
  }, []);

  // Safe Import Actions
  const analyzeImport = useCallback(async (srcPathOrContent: string, password?: string): Promise<ImportPreview> => {
    try {
      return await invoke<ImportPreview>('analyze_import', {
        srcPath: srcPathOrContent,
        masterPassword: password || null,
      });
    } catch (err: any) {
      showToast(err.toString(), 'error');
      throw err;
    }
  }, [showToast]);

  const commitImport = useCallback(async (options: ImportCommitOptions): Promise<ImportResultSummary> => {
    try {
      const summary = await invoke<ImportResultSummary>('commit_import', { options });
      showToast(`Import completed: ${summary.added} added, ${summary.replaced} replaced`, 'success');
      await refreshStatus();
      return summary;
    } catch (err: any) {
      showToast(err.toString(), 'error');
      throw err;
    }
  }, [showToast, refreshStatus]);

  // Initial Sync
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Safe category selector that deselects entry if it does not belong to new category
  const handleSetActiveCategory = useCallback((cat: CategoryType) => {
    setActiveCategory(cat);
    setIsMobileNavOpen(false);
    if (cat === 'documents') {
      setSelectedEntryId(null);
    }
    if (selectedEntryId) {
      const selected = entries.find((e) => e.id === selectedEntryId);
      if (selected) {
        if (cat === 'favorites' && !selected.favorite) setSelectedEntryId(null);
        else if (cat === 'totp' && !selected.totp_secret) setSelectedEntryId(null);
        else if (cat !== 'all' && cat !== 'favorites' && cat !== 'totp' && cat !== 'health' && cat !== 'documents' && selected.category !== cat) {
          setSelectedEntryId(null);
        }
      }
    }
  }, [selectedEntryId, entries]);

  // Track user activity to determine idle time & sync with Rust backend
  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      if (status.unlocked && Date.now() - lastBackendTouchRef.current > 25000) {
        lastBackendTouchRef.current = Date.now();
        invoke('touch_user_activity').catch(() => {});
      }
    };

    const handleFocus = () => {
      handleActivity();
      if (clipboardClearTimeRef.current && Date.now() >= clipboardClearTimeRef.current) {
        navigator.clipboard.writeText('').catch(() => {});
        clipboardClearTimeRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('mousedown', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('focus', handleFocus);
    };
  }, [status.unlocked]);

  // Periodic heartbeat to enforce auto-lock
  useEffect(() => {
    if (!status.unlocked) return;

    const interval = setInterval(async () => {
      const idleMs = Date.now() - lastActivityRef.current;
      const autoLockMs = status.auto_lock_minutes * 60 * 1000;

      if (status.auto_lock_minutes > 0 && idleMs >= autoLockMs) {
        await lockVault();
      } else {
        try {
          const res = await invoke<VaultStatus>('get_vault_status');
          if (!res.unlocked) {
            setStatus(res);
            setEntries([]);
            setDocuments([]);
            setSelectedEntryId(null);
            setSelectedDocumentId(null);
            setEditingEntry(null);
          }
        } catch {
          // ignore transient poll error
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [status.unlocked, status.auto_lock_minutes, lockVault]);

  // Keyboard Shortcuts Setup (Ctrl/Cmd + K, Ctrl/Cmd + N, Ctrl/Cmd + L, Ctrl/Cmd + G)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const desktopInput = document.getElementById('vault-search-input');
        const mobileInput = document.getElementById('vault-search-input-mobile');
        if (desktopInput && desktopInput.offsetParent !== null) {
          desktopInput.focus();
        } else if (mobileInput) {
          mobileInput.focus();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        openEditor();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        lockVault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setIsGeneratorOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openEditor, lockVault]);

  return (
    <VaultContext.Provider
      value={{
        status,
        entries,
        documents,
        selectedEntryId,
        selectedDocumentId,
        activeCategory,
        searchQuery,
        isGeneratorOpen,
        isSettingsOpen,
        isEditorOpen,
        editingEntry,
        isImportExportOpen,
        isMobileNavOpen,
        setIsMobileNavOpen,
        healthReport,
        toast,
        refreshStatus,
        createVault,
        unlockVault,
        lockVault,
        saveEntry,
        deleteEntry,
        setSelectedEntryId,
        setSelectedDocumentId,
        setActiveCategory: handleSetActiveCategory,
        setSearchQuery,
        openEditor,
        closeEditor,
        initialEditorCategory,
        isScannerOpen,
        setIsScannerOpen,
        scannerInitialMode,
        setScannerInitialMode,
        scannerTargetDocId,
        setScannerTargetDocId,
        openScanner,
        closeScanner,
        setIsGeneratorOpen,
        setIsSettingsOpen,
        setIsImportExportOpen,
        copyToClipboard,
        generatePassword,
        setAutoLockTimer,
        fetchHealthReport,
        exportBackup,
        importBackup,
        changeMasterPassword,
        exportCsv,
        importCsv,
        showToast,
        refreshDocuments,
        saveDocument,
        addDocumentPage,
        deleteDocument,
        deleteDocumentPage,
        reorderDocumentPages,
        toggleDocumentFavorite,
        getDocumentDetail,
        getDocumentPageData,
        analyzeImport,
        commitImport,
      }}
    >
      {children}
    </VaultContext.Provider>
  );

};

export const useVault = () => {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used within VaultProvider');
  return ctx;
};
