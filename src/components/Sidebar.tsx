import React, { useState } from 'react';
import {
  Key,
  Star,
  FileText,
  Clock,
  Shield,
  Settings,
  Lock,
  HardDriveDownload,
  CreditCard,
  Layers,
  Server,
  Scroll,
  Terminal,
  FolderLock,
  X,
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  Check,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { CategoryType, LoginFolder } from '../types';
import logoImg from '../assets/logo.png';

export const Sidebar: React.FC = () => {
  const {
    entries,
    documents,
    activeCategory,
    setActiveCategory,
    lockVault,
    setIsSettingsOpen,
    setIsImportExportOpen,
    fetchHealthReport,
    healthReport,
    isMobileNavOpen,
    setIsMobileNavOpen,
    folders,
    selectedFolderId,
    setSelectedFolderId,
    createFolder,
    renameFolder,
    deleteFolder,
  } = useVault();

  const [isLoginsExpanded, setIsLoginsExpanded] = useState<boolean>(true);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingFolderName, setRenamingFolderName] = useState<string>('');

  const [deletingFolder, setDeletingFolder] = useState<LoginFolder | null>(null);
  const [deleteContents, setDeleteContents] = useState<boolean>(false);

  const getCount = (cat: CategoryType) => {
    if (cat === 'all') return entries.length;
    if (cat === 'favorites') return entries.filter((e) => e.favorite).length;
    if (cat === 'totp') return entries.filter((e) => Boolean(e.totp_secret) || e.category === 'totp').length;
    if (cat === 'documents') return documents.length;
    return entries.filter((e) => e.category === cat).length;
  };

  // Minimal, consistent line-based monochrome icons with uniform stroke width
  const navItems: { id: CategoryType; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All Items', icon: <Layers className="w-4 h-4 stroke-[1.75]" /> },
    { id: 'favorites', label: 'Favorites', icon: <Star className="w-4 h-4 stroke-[1.75]" /> },
    { id: 'documents', label: 'Documents & Bills', icon: <FolderLock className="w-4 h-4 stroke-[1.75]" /> },
    { id: 'logins', label: 'Logins', icon: <Key className="w-4 h-4 stroke-[1.75]" /> },
    { id: 'secure_notes', label: 'Secure Notes', icon: <FileText className="w-4 h-4 stroke-[1.75]" /> },
    { id: 'totp', label: 'Authenticator (2FA)', icon: <Clock className="w-4 h-4 stroke-[1.75]" /> },
    { id: 'cards', label: 'Payment Cards', icon: <CreditCard className="w-4 h-4 stroke-[1.75]" /> },
    { id: 'licenses', label: 'Software Licenses', icon: <Scroll className="w-4 h-4 stroke-[1.75]" /> },
    { id: 'servers', label: 'Servers & SSH', icon: <Server className="w-4 h-4 stroke-[1.75]" /> },
    { id: 'api_credentials', label: 'API Credentials', icon: <Terminal className="w-4 h-4 stroke-[1.75]" /> },
    { id: 'health', label: 'Security Health', icon: <Shield className="w-4 h-4 stroke-[1.75]" /> },
  ];

  const handleNavClick = (id: CategoryType) => {
    setActiveCategory(id);
    setIsMobileNavOpen(false);
    if (id === 'health') {
      fetchHealthReport();
    }
  };

  const totalVulnerabilities = healthReport
    ? healthReport.weak_passwords + healthReport.reused_passwords
    : 0;

  const renderFolderTree = (parentId: string | null = null, depth = 0) => {
    const currentFolders = folders.filter((f) => (f.parent_id || null) === parentId);
    if (currentFolders.length === 0) return null;

    return (
      <div className="space-y-0.5 mt-0.5">
        {currentFolders.map((folder) => {
          const folderEntries = entries.filter((e) => e.category === 'logins' && e.folder_id === folder.id);
          const isSelected = activeCategory === 'logins' && selectedFolderId === folder.id;
          const isRenaming = renamingFolderId === folder.id;

          return (
            <div key={folder.id} className="group/folder">
              <div
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-950 dark:text-purple-200 font-semibold border border-purple-300 dark:border-purple-500/30'
                    : 'text-slate-700 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text hover:bg-slate-100 dark:hover:bg-theme-hover border border-transparent'
                }`}
                style={{ paddingLeft: `${16 + depth * 12}px` }}
                onClick={() => {
                  setActiveCategory('logins');
                  setSelectedFolderId(folder.id);
                }}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isSelected ? (
                    <FolderOpen className="w-3.5 h-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500 group-hover/folder:text-slate-700 dark:group-hover/folder:text-slate-300" />
                  )}
                  {isRenaming ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (renamingFolderName.trim()) {
                          renameFolder(folder.id, renamingFolderName.trim());
                        }
                        setRenamingFolderId(null);
                      }}
                      className="flex items-center gap-1 flex-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        autoFocus
                        value={renamingFolderName}
                        onChange={(e) => setRenamingFolderName(e.target.value)}
                        className="bg-white dark:bg-black/50 border border-purple-500 rounded px-1.5 py-0.5 text-xs text-theme-text w-full focus:outline-hidden"
                      />
                      <button type="submit" className="p-0.5 text-emerald-600 hover:text-emerald-700">
                        <Check className="w-3 h-3" />
                      </button>
                    </form>
                  ) : (
                    <span className="truncate">{folder.name}</span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {!isRenaming && (
                    <div className="opacity-0 group-hover/folder:opacity-100 flex items-center transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingFolderId(folder.id);
                          setRenamingFolderName(folder.name);
                        }}
                        title="Rename folder"
                        className="p-1 hover:text-purple-600 dark:hover:text-purple-400 rounded cursor-pointer"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingFolder(folder);
                          setDeleteContents(false);
                        }}
                        title="Delete folder"
                        className="p-1 hover:text-rose-600 rounded cursor-pointer"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                  <span className="text-[11px] px-1.5 py-0.2 rounded-full font-mono bg-slate-200/60 dark:bg-theme-border/60 text-slate-700 dark:text-slate-300 font-medium">
                    {folderEntries.length}
                  </span>
                </div>
              </div>

              {renderFolderTree(folder.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSidebarBody = (isMobile: boolean = false) => (
    <div className="flex flex-col h-full select-none text-theme-text">
      {/* Brand Header */}
      <div className="p-4 border-b border-theme-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center p-0.5 border border-theme-border bg-theme-surface shrink-0 shadow-sm">
            <img
              src={logoImg}
              alt="TotumVault"
              className="w-full h-full object-cover rounded-[10px]"
            />
          </div>
          <div>
            <h1 className="font-bold text-theme-text tracking-tight text-sm">TotumVault</h1>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              lockVault();
              if (isMobile) setIsMobileNavOpen(false);
            }}
            title="Lock Vault Now"
            className="p-2 rounded-xl bg-theme-surface hover:bg-theme-hover border border-theme-border text-theme-text-muted hover:text-theme-text transition-all cursor-pointer shadow-sm group"
          >
            <Lock className="w-3.5 h-3.5 stroke-[1.75] group-hover:scale-110 transition-transform" />
          </button>

          {isMobile && (
            <button
              onClick={() => setIsMobileNavOpen(false)}
              className="p-2 rounded-xl bg-theme-surface hover:bg-theme-hover border border-theme-border text-theme-text-muted hover:text-theme-text transition-all cursor-pointer shadow-sm"
              title="Close Menu"
            >
              <X className="w-3.5 h-3.5 stroke-[1.75]" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
        <span className="text-xs font-bold text-theme-text-muted uppercase tracking-wider px-3 mb-1.5 block">
          Categories
        </span>
        {navItems.map((item) => {
          const count = getCount(item.id);
          const isActive = activeCategory === item.id;
          const isLoginsItem = item.id === 'logins';
          const unfiledCount = entries.filter((e) => e.category === 'logins' && !e.folder_id).length;

          return (
            <div key={item.id} className="space-y-1">
              <div
                onClick={() => {
                  if (isLoginsItem && activeCategory === 'logins') {
                    setIsLoginsExpanded((prev) => !prev);
                  } else {
                    handleNavClick(item.id);
                    if (isLoginsItem) {
                      setSelectedFolderId(null);
                      setIsLoginsExpanded(true);
                    }
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer group min-h-[44px] ${
                  isActive && (item.id !== 'logins' || selectedFolderId === null)
                    ? 'bg-purple-100/90 dark:bg-purple-950/40 text-purple-950 dark:text-purple-200 shadow-xs border border-purple-300 dark:border-purple-500/40 font-semibold'
                    : 'text-slate-700 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text hover:bg-slate-100/90 dark:hover:bg-theme-hover border border-transparent hover:border-slate-200 dark:hover:border-[#252a33] font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`transition-colors shrink-0 ${
                      isActive
                        ? 'text-purple-700 dark:text-purple-400'
                        : 'text-slate-500 dark:text-theme-text-muted group-hover:text-slate-950 dark:group-hover:text-white'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span
                    className={`tracking-tight ${
                      isActive
                        ? 'text-purple-950 dark:text-purple-100 font-bold'
                        : 'text-slate-800 dark:text-theme-text group-hover:text-slate-950 dark:group-hover:text-white group-hover:font-semibold'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.id === 'health' ? (
                    totalVulnerabilities > 0 ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 font-bold shadow-2xs">
                        {totalVulnerabilities} alert{totalVulnerabilities > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 font-bold shadow-2xs">
                        Secure
                      </span>
                    )
                  ) : item.id === 'favorites' && count === 0 ? null : (
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-mono transition-all ${
                        isActive && (item.id !== 'logins' || selectedFolderId === null)
                          ? 'bg-purple-600 text-white font-bold shadow-xs dark:bg-purple-500/40 dark:text-purple-200 dark:border dark:border-purple-500/50'
                          : 'bg-white dark:bg-[#171a20] text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-[#252a33] font-bold group-hover:bg-slate-50 dark:group-hover:bg-[#1c2028] group-hover:text-slate-950 dark:group-hover:text-white group-hover:border-slate-300 dark:group-hover:border-[#303642] shadow-2xs'
                      }`}
                    >
                      {count}
                    </span>
                  )}

                  {isLoginsItem && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsLoginsExpanded((prev) => !prev);
                      }}
                      className="p-1 hover:text-purple-600 text-slate-400 dark:text-slate-500 transition-transform"
                      title={isLoginsExpanded ? 'Collapse Folders' : 'Expand Folders'}
                    >
                      {isLoginsExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Subfolders under Logins */}
              {isLoginsItem && isLoginsExpanded && (
                <div className="pl-3 pr-1 py-1 space-y-1 border-l-2 border-slate-200 dark:border-theme-border ml-5 mt-0.5 animate-fade-in">
                  {/* Unfiled Category Link if folders exist and there are unfiled logins */}
                  {folders.length > 0 && unfiledCount > 0 && (
                    <div
                      onClick={() => {
                        setActiveCategory('logins');
                        setSelectedFolderId('__unfiled__');
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                        activeCategory === 'logins' && selectedFolderId === '__unfiled__'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-950 dark:text-purple-200 font-semibold border border-purple-300 dark:border-purple-500/30'
                          : 'text-slate-600 dark:text-theme-text-muted hover:text-slate-900 dark:hover:text-theme-text hover:bg-slate-100 dark:hover:bg-theme-hover border border-transparent'
                      }`}
                    >
                      <span className="truncate">Unfiled Logins</span>
                      <span className="text-[11px] px-1.5 py-0.2 rounded-full font-mono bg-slate-200/60 dark:bg-theme-border/60 text-slate-700 dark:text-slate-300 font-medium">
                        {unfiledCount}
                      </span>
                    </div>
                  )}

                  {/* Render Folder Tree */}
                  {renderFolderTree(null, 0)}

                  {/* New Folder Form or Button */}
                  {isCreatingFolder ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (newFolderName.trim()) {
                          await createFolder(newFolderName.trim(), newFolderParentId);
                          setNewFolderName('');
                          setIsCreatingFolder(false);
                        }
                      }}
                      className="p-2 bg-slate-50 dark:bg-black/40 rounded-lg border border-purple-500/40 space-y-2 mt-1"
                    >
                      <input
                        type="text"
                        placeholder="Folder name..."
                        autoFocus
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        className="w-full bg-white dark:bg-theme-surface border border-theme-border rounded px-2 py-1 text-xs text-theme-text focus:outline-hidden"
                      />
                      {folders.length > 0 && (
                        <select
                          value={newFolderParentId || ''}
                          onChange={(e) => setNewFolderParentId(e.target.value || null)}
                          className="w-full bg-white dark:bg-theme-surface border border-theme-border rounded px-2 py-1 text-xs text-theme-text focus:outline-hidden"
                        >
                          <option value="">(Top-level folder)</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              Inside: {f.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingFolder(false);
                            setNewFolderName('');
                          }}
                          className="px-2 py-0.5 text-[11px] text-theme-text-muted hover:text-theme-text rounded cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!newFolderName.trim()}
                          className="px-2.5 py-0.5 text-[11px] bg-purple-600 text-white rounded font-medium disabled:opacity-50 cursor-pointer shadow-xs"
                        >
                          Create
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => {
                        setIsCreatingFolder(true);
                        setNewFolderParentId(selectedFolderId && selectedFolderId !== '__unfiled__' ? selectedFolderId : null);
                      }}
                      className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-slate-500 dark:text-theme-text-muted hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100/70 dark:hover:bg-theme-hover rounded-lg transition-colors cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>+ New Folder</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Status, Backup & Settings */}
      <div className="p-3 border-t border-theme-border space-y-1 bg-theme-surface/80 pb-safe">
        <button
          onClick={() => {
            setIsImportExportOpen(true);
            if (isMobile) setIsMobileNavOpen(false);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-700 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text hover:bg-slate-100/90 dark:hover:bg-theme-hover border border-transparent hover:border-slate-200 dark:hover:border-theme-border transition-all cursor-pointer min-h-[44px] group"
        >
          <HardDriveDownload className="w-4 h-4 stroke-[1.75] text-slate-500 dark:text-theme-text-muted group-hover:text-slate-900 dark:group-hover:text-theme-text" />
          <span className="font-medium">Backup & Restore</span>
        </button>

        <button
          onClick={() => {
            setIsSettingsOpen(true);
            if (isMobile) setIsMobileNavOpen(false);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-700 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text hover:bg-slate-100/90 dark:hover:bg-theme-hover border border-transparent hover:border-slate-200 dark:hover:border-theme-border transition-all cursor-pointer min-h-[44px] group"
        >
          <Settings className="w-4 h-4 stroke-[1.75] text-slate-500 dark:text-theme-text-muted group-hover:text-slate-900 dark:group-hover:text-theme-text" />
          <span className="font-medium">Preferences</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden md:flex w-64 bg-theme-surface/70 backdrop-blur-xl border-r border-theme-border flex-col h-full select-none shrink-0">
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile Off-Canvas Drawer */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            onClick={() => setIsMobileNavOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
          />
          <div className="relative w-72 max-w-[85vw] h-full bg-theme-surface border-r border-theme-border shadow-2xl flex flex-col z-10 animate-scale-up">
            {renderSidebarBody(true)}
          </div>
        </div>
      )}

      {/* Folder Deletion Confirmation Modal */}
      {deletingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-theme-surface border border-theme-border rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-scale-up">
            <h3 className="font-bold text-sm text-theme-text">Delete Folder &ldquo;{deletingFolder.name}&rdquo;</h3>
            <p className="text-xs text-theme-text-muted">
              What would you like to do with the logins inside this folder and its subfolders?
            </p>
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-xs text-theme-text cursor-pointer">
                <input
                  type="radio"
                  name="del_opt"
                  checked={!deleteContents}
                  onChange={() => setDeleteContents(false)}
                  className="accent-purple-600"
                />
                <span><strong>Keep Logins</strong> (Move to Unfiled)</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 cursor-pointer">
                <input
                  type="radio"
                  name="del_opt"
                  checked={deleteContents}
                  onChange={() => setDeleteContents(true)}
                  className="accent-rose-600"
                />
                <span><strong>Delete All Logins</strong> (Remove permanently)</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-theme-border">
              <button
                type="button"
                onClick={() => setDeletingFolder(null)}
                className="px-3 py-1.5 text-xs text-theme-text-muted hover:text-theme-text rounded-lg border border-theme-border cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteFolder(deletingFolder.id, deleteContents);
                  setDeletingFolder(null);
                }}
                className={`px-3 py-1.5 text-xs text-white rounded-lg font-medium shadow-xs cursor-pointer ${
                  deleteContents ? 'bg-rose-600 hover:bg-rose-700' : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
