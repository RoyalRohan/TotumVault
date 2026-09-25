import React, { useState } from 'react';
import { VaultProvider, useVault } from './context/VaultContext';
import { ThemeProvider } from './context/ThemeContext';
import { LockScreen } from './components/LockScreen';
import { SetupVaultModal } from './components/SetupVaultModal';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { EntryList } from './components/EntryList';
import { EntryDetail } from './components/EntryDetail';
import { SecurityHealthDashboard } from './components/SecurityHealthDashboard';
import { MobileBottomBar } from './components/MobileBottomBar';
import { EntryEditorModal } from './components/EntryEditorModal';
import { PasswordGeneratorModal } from './components/PasswordGeneratorModal';
import { SettingsModal } from './components/SettingsModal';
import { ImportExportModal } from './components/ImportExportModal';
import { Toast } from './components/Toast';
import { DocumentLibrary } from './components/documents/DocumentLibrary';
import { DocumentScannerModal } from './components/documents/DocumentScannerModal';
import { DocumentViewerModal } from './components/documents/DocumentViewerModal';
import { PrivacyShieldOverlay } from './components/PrivacyShieldOverlay';

const MainAppContent: React.FC = () => {
  const {
    status,
    activeCategory,
    selectedEntryId,
    selectedDocumentId,
    setSelectedDocumentId,
    isScannerOpen,
    scannerInitialMode,
    scannerTargetDocId,
    openScanner,
    closeScanner,
    updateInfo,
    dismissUpdate,
  } = useVault();
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  if (!status.exists || !status.unlocked) {
    return (
      <>
        {updateInfo?.hasUpdate && (
          <div className="fixed top-0 left-0 right-0 bg-purple-600 dark:bg-purple-900/95 text-white text-xs px-4 py-2.5 flex items-center justify-between gap-3 z-50 shadow-md border-b border-purple-500/30">
            <div className="flex items-center gap-2 truncate">
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-200 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span className="font-semibold truncate">
                TotumVault v{updateInfo.latestVersion} is available!
              </span>
              {updateInfo.assetName && (
                <span className="hidden sm:inline text-purple-200 truncate">
                  ({updateInfo.assetName})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={updateInfo.assetDownloadUrl || updateInfo.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 bg-white text-purple-900 font-semibold rounded-lg hover:bg-purple-50 transition-colors shadow-2xs"
              >
                Update Now
              </a>
              <button
                type="button"
                onClick={dismissUpdate}
                className="p-1 hover:bg-purple-700/50 rounded text-purple-200 hover:text-white transition-colors cursor-pointer"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <LockScreen onOpenSetup={() => setIsSetupOpen(true)} />
        <SetupVaultModal isOpen={isSetupOpen} onClose={() => setIsSetupOpen(false)} />
        <Toast />
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-theme-bg text-theme-text overflow-hidden font-sans select-none flex-col md:flex-row transition-colors duration-150">
      {/* Navigation Sidebar (Desktop Permanent + Mobile Drawer) */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden min-w-0">
        {updateInfo?.hasUpdate && (
          <div className="bg-purple-600 dark:bg-purple-900/95 text-white text-xs px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 shadow-sm border-b border-purple-500/30 z-20">
            <div className="flex items-center gap-2 truncate">
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-200 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span className="font-semibold truncate">
                TotumVault v{updateInfo.latestVersion} is available!
              </span>
              {updateInfo.assetName && (
                <span className="hidden sm:inline text-purple-200 truncate">
                  ({updateInfo.assetName})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={updateInfo.assetDownloadUrl || updateInfo.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 bg-white text-purple-900 font-semibold rounded-lg hover:bg-purple-50 transition-colors shadow-2xs"
              >
                Update Now
              </a>
              <button
                type="button"
                onClick={dismissUpdate}
                className="p-1 hover:bg-purple-700/50 rounded text-purple-200 hover:text-white transition-colors cursor-pointer"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <Header />

        <div className="flex-1 flex overflow-hidden relative min-w-0 min-h-0 h-full">
          {activeCategory === 'health' ? (
            <SecurityHealthDashboard />
          ) : activeCategory === 'documents' ? (
            <DocumentLibrary
              onOpenScanner={(mode) => openScanner(mode)}
              onSelectDocument={(docId) => setSelectedDocumentId(docId)}
            />
          ) : (
            <>
              {/* On Desktop: Side-by-side (EntryList + EntryDetail) */}
              {/* On Mobile: EntryList if !selectedEntryId, EntryDetail if selectedEntryId */}
              <div
                className={`h-full flex flex-col min-w-0 ${
                  selectedEntryId ? 'hidden md:flex md:w-72 lg:w-80 shrink-0' : 'w-full md:w-72 lg:w-80 shrink-0'
                }`}
              >
                <EntryList />
              </div>

              <div
                className={`h-full flex-1 flex flex-col min-w-0 ${
                  !selectedEntryId ? 'hidden md:flex' : 'w-full flex-1'
                }`}
              >
                <EntryDetail />
              </div>
            </>
          )}
        </div>

        {/* Mobile Bottom Navigation Bar (Hidden when viewing an entry detail or document viewer on mobile) */}
        {!selectedEntryId && (!selectedDocumentId || activeCategory !== 'documents') && <MobileBottomBar />}
      </div>

      {/* Application Modals */}
      <EntryEditorModal />
      <PasswordGeneratorModal />
      <SettingsModal />
      <ImportExportModal />

      {/* Secure Document Vault Modals */}
      <DocumentScannerModal
        isOpen={isScannerOpen}
        onClose={closeScanner}
        initialMode={scannerInitialMode}
        targetDocumentId={scannerTargetDocId}
      />

      <DocumentViewerModal
        documentId={selectedDocumentId}
        onClose={() => setSelectedDocumentId(null)}
        onAddPage={(docId) => {
          openScanner('camera', docId);
        }}
      />

      <PrivacyShieldOverlay />
      <Toast />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <VaultProvider>
        <MainAppContent />
      </VaultProvider>
    </ThemeProvider>
  );
}
