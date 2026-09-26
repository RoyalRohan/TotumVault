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
  LoginFolder,
  PwGenConfig,
  SaveDocumentInput,
  SavePageInput,
  ScreenProtectionStatus,
  BiometricCapability,
  UpdateInfo,
  VaultHealthReport,
  VaultStatus,
} from '../types';
import {
  readText as tauriReadText,
} from '@tauri-apps/plugin-clipboard-manager';
import {
  isAndroidBiometricsAvailable,
  checkAndroidBiometricHardware,
  isAndroidBiometricEnrolled,
  androidEncryptSecret,
  androidDecryptSecret,
  androidClearEnrolledKey,
  setBiometricPromptActive,
} from '../utils/androidBiometrics';
import { checkAppUpdate } from '../utils/updater';

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

  // Login Folders
  folders: LoginFolder[];
  selectedFolderId: string | null;
  setSelectedFolderId: (id: string | null) => void;
  refreshFolders: () => Promise<void>;
  createFolder: (name: string, parentId?: string | null) => Promise<LoginFolder | null>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string, deleteContents: boolean) => Promise<void>;
  moveEntryToFolder: (entryId: string, folderId: string | null) => Promise<void>;

  // Biometrics
  isBiometricSupported: boolean;
  isBiometricEnabled: boolean;
  biometricFailedAttempts: number;
  isBiometricLockedOut: boolean;
  setupBiometric: (masterPassword: string) => Promise<boolean>;
  unlockWithBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;

  // Screen Protection
  screenProtection: ScreenProtectionStatus | null;
  setScreenProtection: (enabled: boolean) => Promise<void>;

  // Auto Updates
  updateInfo: UpdateInfo | null;
  isCheckingUpdate: boolean;
  checkForUpdates: (manual?: boolean) => Promise<UpdateInfo | null>;
  dismissUpdate: () => void;
  skipUpdateVersion: (version: string) => void;
  lastUpdateChecked: string;

  // Clipboard Settings & Actions
  clipboardClearSeconds: number;
  setClipboardClearSeconds: (secs: number) => void;
  clearClipboard: (notify?: boolean, force?: boolean) => Promise<boolean>;

  // Privacy Screen Shield Test
  isPrivacyShieldTest: boolean;
  triggerPrivacyShieldTest: () => void;
  dismissPrivacyShieldTest: () => void;

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

  // Login Folders State
  const [folders, setFolders] = useState<LoginFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Biometrics State
  const [isBiometricSupported, setIsBiometricSupported] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)) return true;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('totumvault_bio_token') !== null) return true;
    return false;
  });
  const [isBiometricEnabled, setIsBiometricEnabled] = useState<boolean>(false);
  const [biometricFailedAttempts, setBiometricFailedAttempts] = useState<number>(0);
  const isBiometricLockedOut = biometricFailedAttempts >= 3;

  // Screen Protection State
  const [screenProtection, setScreenProtectionState] = useState<ScreenProtectionStatus>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('totumvault_screen_protection') : null;
    const active = saved !== 'false';
    return {
      supported: true,
      platform: 'protected',
      active,
      description: active
        ? 'Privacy screen protection active. Window obscures on blur, screenshot key capture, and print attempts.'
        : 'Privacy screen protection disabled.',
    };
  });
  const [isPrivacyShieldTest, setIsPrivacyShieldTest] = useState<boolean>(false);
  const triggerPrivacyShieldTest = useCallback(() => {
    setIsPrivacyShieldTest(true);
    setTimeout(() => {
      setIsPrivacyShieldTest(false);
    }, 4500);
  }, []);
  const dismissPrivacyShieldTest = useCallback(() => {
    setIsPrivacyShieldTest(false);
  }, []);

  // Auto Updates State
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [lastUpdateChecked, setLastUpdateChecked] = useState<string>(() => {
    return localStorage.getItem('totumvault_last_update_check') || '';
  });

  const skipUpdateVersion = useCallback((version: string) => {
    localStorage.setItem('totumvault_skipped_version', version);
    setUpdateInfo(null);
  }, []);

  // Smart Clipboard Settings & State (default: 30s)
  const [clipboardClearSeconds, setClipboardClearSecondsState] = useState<number>(() => {
    const saved = localStorage.getItem('totumvault_clipboard_clear_seconds');
    return saved !== null ? parseInt(saved, 10) : 30;
  });
  const setClipboardClearSeconds = useCallback((secs: number) => {
    setClipboardClearSecondsState(secs);
    localStorage.setItem('totumvault_clipboard_clear_seconds', secs.toString());
  }, []);

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

  const refreshFolders = useCallback(async () => {
    try {
      const f = await invoke<LoginFolder[]>('get_login_folders');
      setFolders(f);
    } catch (err) {
      console.error('Failed to list folders:', err);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await invoke<VaultStatus>('get_vault_status');
      setStatus(res);
      if (res.unlocked) {
        const [fetchedEntries, fetchedDocs, fetchedFolders, bioEnabled] = await Promise.all([
          invoke<DecryptedEntry[]>('get_entries'),
          invoke<DocumentMetadata[]>('list_documents'),
          invoke<LoginFolder[]>('get_login_folders').catch(() => []),
          invoke<boolean>('is_biometric_enabled').catch(() => false),
        ]);
        setEntries(fetchedEntries);
        setDocuments(fetchedDocs);
        setFolders(fetchedFolders);
        setIsBiometricEnabled(bioEnabled);
      } else {
        setEntries([]);
        setDocuments([]);
        setFolders([]);
        setSelectedEntryId(null);
        setSelectedDocumentId(null);
        setSelectedFolderId(null);
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
        setBiometricFailedAttempts(0); // Reset biometric attempts
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
  const clipboardPendingFlushRef = useRef<boolean>(false);
  const lastCopiedTextRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const lastBackendTouchRef = useRef<number>(Date.now());

  const clearClipboard = useCallback(async (notify = false, force = false): Promise<boolean> => {
    // If not forced (e.g. timeout fired or vault locked), check if clipboard still contains TotumVault copied secret
    if (!force && lastCopiedTextRef.current !== null) {
      let currentClipboardText: string | null = null;
      try {
        currentClipboardText = await tauriReadText();
      } catch {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
          try {
            currentClipboardText = await navigator.clipboard.readText();
          } catch {
            // Unfocused or permission blocked in web
          }
        }
      }

      // If we read current clipboard and it does NOT match what TotumVault copied:
      // Another application or user copied something else meanwhile.
      // NEVER overwrite or clear that newer clipboard content!
      if (currentClipboardText !== null && currentClipboardText !== lastCopiedTextRef.current) {
        lastCopiedTextRef.current = null;
        clipboardClearTimeRef.current = null;
        clipboardPendingFlushRef.current = false;
        if (clipboardTimeoutRef.current) {
          clearTimeout(clipboardTimeoutRef.current);
          clipboardTimeoutRef.current = null;
        }
        return false;
      }
    }

    let success = false;

    // 1. Primary implementation: Native Tauri clipboard plugin
    try {
      if (lastCopiedTextRef.current !== null && !force) {
        const cleared = await invoke<boolean>('clear_clipboard_if_matches', {
          expected: lastCopiedTextRef.current,
        });
        if (cleared) {
          success = true;
        } else {
          // Rust backend detected clipboard content changed
          lastCopiedTextRef.current = null;
          clipboardClearTimeRef.current = null;
          clipboardPendingFlushRef.current = false;
          return false;
        }
      } else {
        await invoke('clear_clipboard');
        success = true;
      }
    } catch (e: any) {
      if (e && typeof e === 'string' && e.includes('Wayland focus')) {
        showToast('Clipboard cannot be cleared automatically in background on Wayland', 'warning');
      }
      // Ignored if outside Tauri
    }

    // 2. Clear via standard Web API
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText('');
        success = true;
      } catch {
        // May fail if unfocused in browser
      }
    }

    // 3. Fallback DOM execCommand with empty string (ensures clipboard is truly emptied, not replaced with a space)
    try {
      const textarea = document.createElement('textarea');
      textarea.value = '';
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      textarea.setAttribute('aria-hidden', 'true');
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) {
        success = true;
      }
    } catch {
      // ignore
    }

    if (success) {
      clipboardClearTimeRef.current = null;
      clipboardPendingFlushRef.current = false;
      lastCopiedTextRef.current = null;

      if (clipboardTimeoutRef.current) {
        clearTimeout(clipboardTimeoutRef.current);
        clipboardTimeoutRef.current = null;
      }

      if (notify) {
        showToast('Clipboard automatically cleared for security', 'info');
      }
      return true;
    } else {
      clipboardPendingFlushRef.current = true;
      return false;
    }
  }, [showToast]);

  const lockVault = useCallback(async () => {
    await clearClipboard(false, false);
    try {
      await invoke('lock_vault');
    } catch (err: any) {
      console.error('Lock vault failed:', err);
    }
    setStatus((prev) => ({ ...prev, unlocked: false }));
    setEntries([]);
    setDocuments([]);
    setFolders([]);
    setSelectedEntryId(null);
    setSelectedDocumentId(null);
    setSelectedFolderId(null);
    setEditingEntry(null);
    setHealthReport(null);
    showToast('Vault locked', 'info');
  }, [showToast, clearClipboard]);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    if (!text) return;
    try {
      let copied = false;

      // 1. Primary implementation: Secure native Tauri clipboard command
      try {
        await invoke('copy_secret', { text });
        copied = true;
      } catch (e) {
        console.error('Failed to copy secret securely via native rust:', e);
        // Fallback to web clipboard
      }

      // 2. Web Clipboard API fallback
      if (!copied && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch {
          // Fallback to execCommand below
        }
      }

      if (!copied) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      // Store in memory ONLY (never persisted to localStorage/sessionStorage/logs)
      lastCopiedTextRef.current = text;
      clipboardPendingFlushRef.current = false;

      // Reset existing timeout
      if (clipboardTimeoutRef.current) {
        clearTimeout(clipboardTimeoutRef.current);
        clipboardTimeoutRef.current = null;
      }

      // Set auto-clear timer
      if (clipboardClearSeconds > 0) {
        showToast(`${label} copied! Auto-clears in ${clipboardClearSeconds}s.`, 'success');
        clipboardClearTimeRef.current = Date.now() + clipboardClearSeconds * 1000;

        clipboardTimeoutRef.current = setTimeout(async () => {
          await clearClipboard(true, false);
        }, clipboardClearSeconds * 1000);
      } else {
        showToast(`${label} copied to clipboard`, 'success');
      }
    } catch {
      showToast('Failed to copy to clipboard', 'error');
    }
  }, [showToast, clipboardClearSeconds, clearClipboard]);

  // Folder Operations
  const createFolder = useCallback(async (name: string, parentId?: string | null): Promise<LoginFolder | null> => {
    try {
      const f = await invoke<LoginFolder>('create_login_folder', { name: name.trim(), parentId: parentId || null });
      await refreshFolders();
      showToast(`Folder "${f.name}" created`, 'success');
      return f;
    } catch (err: any) {
      showToast(err.toString(), 'error');
      return null;
    }
  }, [refreshFolders, showToast]);

  const renameFolder = useCallback(async (id: string, name: string) => {
    try {
      await invoke('rename_login_folder', { id, name: name.trim() });
      await refreshFolders();
      showToast('Folder renamed', 'info');
    } catch (err: any) {
      showToast(err.toString(), 'error');
    }
  }, [refreshFolders, showToast]);

  const deleteFolder = useCallback(async (id: string, deleteContents: boolean) => {
    try {
      await invoke('delete_login_folder', { id, deleteContents });
      if (selectedFolderId === id) {
        setSelectedFolderId(null);
      }
      await refreshFolders();
      await refreshStatus();
      showToast(deleteContents ? 'Folder and entries deleted' : 'Folder deleted (entries unfiled)', 'info');
    } catch (err: any) {
      showToast(err.toString(), 'error');
    }
  }, [selectedFolderId, refreshFolders, refreshStatus, showToast]);

  const moveEntryToFolder = useCallback(async (entryId: string, folderId: string | null) => {
    try {
      await invoke('move_entry_to_folder', { entryId, folderId });
      await refreshStatus();
      showToast('Entry moved', 'info');
    } catch (err: any) {
      showToast(err.toString(), 'error');
    }
  }, [refreshStatus, showToast]);

  // Biometrics
  const setupBiometric = useCallback(async (masterPassword: string): Promise<boolean> => {
    try {
      const token = await invoke<string>('setup_biometric_unlock', { masterPassword });

      if (isAndroidBiometricsAvailable()) {
        try {
          // Real native Android Keystore BIOMETRIC_STRONG encryption
          await androidEncryptSecret(token);
        } finally {
          setBiometricPromptActive(false);
          if (typeof window !== 'undefined') {
            window.__totumBioPromptActive = false;
            window.dispatchEvent(new Event('focus'));
            if (typeof window.__totumOnWindowFocus === 'function') {
              window.__totumOnWindowFocus(true);
            }
          }
        }
      } else {
        // Desktop / browser session-scoped storage (never persistent localStorage)
        sessionStorage.setItem('totumvault_bio_token', token);
      }

      setIsBiometricEnabled(true);
      setIsBiometricSupported(true);
      setBiometricFailedAttempts(0);
      showToast('Biometric unlock configured successfully', 'success');
      return true;
    } catch (err: any) {
      showToast(err?.message || err.toString(), 'error');
      return false;
    }
  }, [showToast]);

  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    if (isBiometricLockedOut) {
      showToast('Maximum biometric attempts exceeded (3/3). Please enter master password.', 'error');
      return false;
    }

    try {
      let token = '';

      if (isAndroidBiometricsAvailable()) {
        try {
          token = await androidDecryptSecret();
        } catch (bioErr: any) {
          const msg = bioErr?.message || bioErr?.toString() || '';
          if (msg === 'USER_CANCELED') {
            // User chose "Use Master Password" or canceled prompt - return without error toast
            return false;
          }
          if (msg === 'LOCKOUT') {
            setBiometricFailedAttempts(3);
            showToast('Biometric lockout (3 failed attempts). Master password required.', 'error');
            return false;
          }
          if (msg === 'INVALIDATED') {
            androidClearEnrolledKey();
            setIsBiometricEnabled(false);
            showToast('Biometrics changed in Android Settings. Unlock with master password to re-enroll.', 'error');
            return false;
          }
          const nextAttempts = biometricFailedAttempts + 1;
          setBiometricFailedAttempts(nextAttempts);
          if (nextAttempts >= 3) {
            showToast('Biometric lockout (3 failed attempts). Master password required.', 'error');
          } else {
            showToast(`Biometric verification failed (${nextAttempts}/3 attempts)`, 'warning');
          }
          return false;
        } finally {
          setBiometricPromptActive(false);
          if (typeof window !== 'undefined') {
            window.__totumBioPromptActive = false;
            window.dispatchEvent(new Event('focus'));
            if (typeof window.__totumOnWindowFocus === 'function') {
              window.__totumOnWindowFocus(true);
            }
          }
        }
      } else {
        token = sessionStorage.getItem('totumvault_bio_token') || '';
        if (!token) {
          showToast('Biometric unlock not available for this session. Please unlock with master password.', 'info');
          return false;
        }
      }

      if (!token) {
        showToast('Biometric authentication failed. Master password required.', 'error');
        return false;
      }

      const success = await invoke<boolean>('unlock_vault_biometric', { biometricToken: token });
      if (success) {
        setBiometricFailedAttempts(0);
        showToast('Vault unlocked with biometrics', 'success');
        await refreshStatus();
        return true;
      } else {
        const nextAttempts = biometricFailedAttempts + 1;
        setBiometricFailedAttempts(nextAttempts);
        if (nextAttempts >= 3) {
          showToast('Biometric lockout (3 failed attempts). Master password required.', 'error');
        } else {
          showToast(`Biometric verification failed (${nextAttempts}/3 attempts)`, 'warning');
        }
        return false;
      }
    } catch (err: any) {
      const nextAttempts = biometricFailedAttempts + 1;
      setBiometricFailedAttempts(nextAttempts);
      showToast(`Biometric error: ${err?.message || err}`, 'error');
      return false;
    } finally {
      setBiometricPromptActive(false);
      if (typeof window !== 'undefined') {
        window.__totumBioPromptActive = false;
        window.dispatchEvent(new Event('focus'));
        if (typeof window.__totumOnWindowFocus === 'function') {
          window.__totumOnWindowFocus(true);
        }
      }
    }
  }, [biometricFailedAttempts, isBiometricLockedOut, refreshStatus, showToast]);

  const disableBiometric = useCallback(async () => {
    try {
      if (isAndroidBiometricsAvailable()) {
        androidClearEnrolledKey();
      }
      await invoke('disable_biometric_unlock');
      sessionStorage.removeItem('totumvault_bio_token');
      localStorage.removeItem('totumvault_bio_token');
      setIsBiometricEnabled(false);
      setBiometricFailedAttempts(0);
      showToast('Biometric unlock disabled', 'info');
    } catch (err: any) {
      showToast(err.toString(), 'error');
    }
  }, [showToast]);

  // Screen Protection
  const setScreenProtection = useCallback(async (enabled: boolean) => {
    try {
      const st = await invoke<ScreenProtectionStatus>('set_screen_protection', { enabled });
      setScreenProtectionState(st);
      localStorage.setItem('totumvault_screen_protection', enabled ? 'true' : 'false');
      if (enabled) {
        showToast(st.description || 'Screen capture protection active', 'success');
      } else {
        showToast('Screen capture protection disabled', 'info');
      }
    } catch (err: any) {
      showToast(`Screen protection error: ${err}`, 'error');
    }
  }, [showToast]);

  // Auto Updates
  const checkForUpdates = useCallback(async (manual = false): Promise<UpdateInfo | null> => {
    setIsCheckingUpdate(true);
    try {
      const info = await checkAppUpdate();
      const nowStr = new Date().toLocaleString();
      setLastUpdateChecked(nowStr);
      localStorage.setItem('totumvault_last_update_check', nowStr);

      const skippedVersion = localStorage.getItem('totumvault_skipped_version');
      const dismissedSession = sessionStorage.getItem('totumvault_dismissed_update_session');

      if (info.hasUpdate) {
        if (!manual && info.latestVersion === skippedVersion) {
          setUpdateInfo(null);
          return info;
        }
        if (!manual && info.latestVersion === dismissedSession) {
          setUpdateInfo(null);
          return info;
        }
        setUpdateInfo(info);
        if (manual) {
          showToast(`Update available: TotumVault v${info.latestVersion}!`, 'info');
        }
      } else {
        setUpdateInfo(null);
        if (manual) {
          showToast(`TotumVault is up to date (v${info.currentVersion})`, 'success');
        }
      }
      return info;
    } catch (err: any) {
      if (manual) {
        showToast(err?.message || 'Unable to check for updates (offline / network error)', 'error');
      }
      return null;
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [showToast]);

  const dismissUpdate = useCallback(() => {
    setUpdateInfo(null);
  }, []);

  // Check hardware biometrics & restore screen protection & startup updates
  useEffect(() => {
    const checkBiometricHardwareAvailability = async () => {
      let isAvailable = false;

      // 1. Android native Keystore / BiometricManager bridge
      if (isAndroidBiometricsAvailable()) {
        const hwStatus = checkAndroidBiometricHardware();
        if (hwStatus === 'SUCCESS') {
          isAvailable = true;
        } else if (hwStatus === 'NONE_ENROLLED') {
          isAvailable = false;
        }
        if (isAndroidBiometricEnrolled()) {
          setIsBiometricEnabled(true);
          isAvailable = true;
        }
      } else {
        // 2. Query native backend capability on desktop / fallback
        try {
          const capability = await invoke<BiometricCapability>('check_biometric_capability');
          if (capability?.supported) {
            isAvailable = true;
          }
        } catch {
          // Fallback
        }

        // 3. Platform authenticator availability
        if (
          !isAvailable &&
          typeof window !== 'undefined' &&
          window.PublicKeyCredential &&
          typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
        ) {
          try {
            const webAuthnAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            if (webAuthnAvailable) {
              isAvailable = true;
            }
          } catch {
            // ignore
          }
        }
      }

      setIsBiometricSupported(isAvailable);
    };

    checkBiometricHardwareAvailability();

    const savedProtection = localStorage.getItem('totumvault_screen_protection');
    const shouldProtect = savedProtection !== 'false';
    invoke<ScreenProtectionStatus>('set_screen_protection', { enabled: shouldProtect })
      .then((st) => setScreenProtectionState(st))
      .catch(() => {});

    const checkStartup =
      localStorage.getItem('totumvault_auto_update_check') !== 'false' &&
      localStorage.getItem('totumvault_check_updates_on_startup') !== 'false';
    if (checkStartup) {
      checkForUpdates(false);
    }
  }, [checkForUpdates]);

  // Automatic biometric prompt on launch/resume when vault is locked and biometrics enabled
  const autoBioPromptTriggeredRef = useRef<boolean>(false);
  useEffect(() => {
    if (
      status.exists &&
      !status.unlocked &&
      isBiometricEnabled &&
      isBiometricSupported &&
      !isBiometricLockedOut &&
      !autoBioPromptTriggeredRef.current
    ) {
      autoBioPromptTriggeredRef.current = true;
      unlockWithBiometric().catch(() => {});
    }
  }, [status.exists, status.unlocked, isBiometricEnabled, isBiometricSupported, isBiometricLockedOut, unlockWithBiometric]);


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

  // Real-time clipboard auto-clear interval (every 1s)
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        clipboardPendingFlushRef.current ||
        (clipboardClearTimeRef.current && Date.now() >= clipboardClearTimeRef.current)
      ) {
        clearClipboard(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [clearClipboard]);

  // Track user activity to determine idle time & flush overdue clipboard upon window return
  useEffect(() => {
    const checkAndFlushOverdueClipboard = () => {
      if (
        clipboardPendingFlushRef.current ||
        (clipboardClearTimeRef.current && Date.now() >= clipboardClearTimeRef.current)
      ) {
        clearClipboard(true);
      }
    };

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      if (status.unlocked && Date.now() - lastBackendTouchRef.current > 25000) {
        lastBackendTouchRef.current = Date.now();
        invoke('touch_user_activity').catch(() => {});
      }
      checkAndFlushOverdueClipboard();
    };

    const handleFocus = () => {
      handleActivity();
      checkAndFlushOverdueClipboard();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndFlushOverdueClipboard();
      }
    };

    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('mousedown', handleActivity, { passive: true });
    window.addEventListener('pointerdown', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status.unlocked, clearClipboard]);

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
        folders,
        selectedFolderId,
        setSelectedFolderId,
        refreshFolders,
        createFolder,
        renameFolder,
        deleteFolder,
        moveEntryToFolder,
        isBiometricSupported,
        isBiometricEnabled,
        biometricFailedAttempts,
        isBiometricLockedOut,
        setupBiometric,
        unlockWithBiometric,
        disableBiometric,
        screenProtection,
        setScreenProtection,
        updateInfo,
        isCheckingUpdate,
        checkForUpdates,
        dismissUpdate,
        skipUpdateVersion,
        lastUpdateChecked,
        clipboardClearSeconds,
        setClipboardClearSeconds,
        clearClipboard,
        isPrivacyShieldTest,
        triggerPrivacyShieldTest,
        dismissPrivacyShieldTest,
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
