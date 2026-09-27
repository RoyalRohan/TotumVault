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
  MoreVertical,
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
    promptDeleteFolder,
    promptRenameFolder,
    moveFolder,
    reorderFolders,
    moveEntryToFolder,
  } = useVault();

  const [isLoginsExpanded, setIsLoginsExpanded] = useState<boolean>(true);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingFolderName, setRenamingFolderName] = useState<string>('');
  const [mobileFolderMenuId, setMobileFolderMenuId] = useState<string | null>(null);

  // Expanded folders state with localStorage persistence
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('totumvault_expanded_folders');
      if (saved !== null) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {
      // ignore
    }
    return new Set<string>();
  });

  const isExpandedInitializedRef = React.useRef<boolean>(false);
  React.useEffect(() => {
    if (!isExpandedInitializedRef.current && folders.length > 0) {
      isExpandedInitializedRef.current = true;
      if (localStorage.getItem('totumvault_expanded_folders') === null) {
        // Expand all folders by default on initial view
        setExpandedFolderIds(new Set(folders.map((f) => f.id)));
      }
    }
  }, [folders]);

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      try {
        localStorage.setItem('totumvault_expanded_folders', JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Drag and drop state for folders
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'folder' | 'login' | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    folderId: string;
    position: 'before' | 'inside' | 'after';
    isValid: boolean;
  } | null>(null);
  const [isOverUnfiled, setIsOverUnfiled] = useState<boolean>(false);
  const [isOverRootDrop, setIsOverRootDrop] = useState<boolean>(false);
  const [isOverLoginsNav, setIsOverLoginsNav] = useState<boolean>(false);
  const hoverExpandTimerRef = React.useRef<{ folderId: string; timer: any } | null>(null);

  // Helper: check if candidate is descendant of ancestor (cycle prevention)
  const isDescendantFolder = (candidateChildId: string, ancestorId: string): boolean => {
    let currentId: string | null = candidateChildId;
    const visited = new Set<string>();
    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const f = folders.find((folder) => folder.id === currentId);
      if (!f || !f.parent_id) break;
      if (f.parent_id === ancestorId) return true;
      currentId = f.parent_id;
    }
    return false;
  };

  const canDropFolderInto = (draggedId: string, targetId: string): boolean => {
    if (draggedId === targetId) return false;
    if (isDescendantFolder(targetId, draggedId)) return false;
    return true;
  };

  const canDropFolderAdjacent = (draggedId: string, targetFolder: LoginFolder): boolean => {
    if (draggedId === targetFolder.id) return false;
    if (targetFolder.parent_id) {
      if (targetFolder.parent_id === draggedId) return false;
      if (isDescendantFolder(targetFolder.parent_id, draggedId)) return false;
    }
    return true;
  };

  const sortFolders = (a: LoginFolder, b: LoginFolder) => {
    const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  };

  const handleFolderDragStart = (e: React.DragEvent<HTMLDivElement>, folder: LoginFolder) => {
    const payload = JSON.stringify({ type: 'folder', id: folder.id });
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.setData('text/plain', payload);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedFolderId(folder.id);
    setDraggedItemType('folder');
  };

  const handleFolderDragEnd = () => {
    setDraggedFolderId(null);
    setDraggedItemType(null);
    setDropTarget(null);
    setIsOverUnfiled(false);
    setIsOverRootDrop(false);
    setIsOverLoginsNav(false);
    if (hoverExpandTimerRef.current?.timer) {
      clearTimeout(hoverExpandTimerRef.current.timer);
      hoverExpandTimerRef.current = null;
    }
  };

  const handleFolderDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    folder: LoginFolder,
    isMobile: boolean
  ) => {
    if (isMobile) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    if (draggedItemType === 'folder' || draggedFolderId) {
      const draggedId = draggedFolderId;
      if (!draggedId) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }

      let pos: 'before' | 'inside' | 'after';
      if (y < height * 0.25) {
        pos = 'before';
      } else if (y > height * 0.75) {
        pos = 'after';
      } else {
        pos = 'inside';
      }

      let isValid = false;
      if (pos === 'inside') {
        isValid = canDropFolderInto(draggedId, folder.id);
      } else {
        isValid = canDropFolderAdjacent(draggedId, folder);
      }

      if (!isValid) {
        e.dataTransfer.dropEffect = 'none';
        setDropTarget({ folderId: folder.id, position: pos, isValid: false });
        return;
      }

      e.dataTransfer.dropEffect = 'move';
      setDropTarget({ folderId: folder.id, position: pos, isValid: true });

      // Auto-expand on hover inside
      if (pos === 'inside' && !expandedFolderIds.has(folder.id)) {
        if (hoverExpandTimerRef.current?.folderId !== folder.id) {
          if (hoverExpandTimerRef.current?.timer) {
            clearTimeout(hoverExpandTimerRef.current.timer);
          }
          hoverExpandTimerRef.current = {
            folderId: folder.id,
            timer: setTimeout(() => {
              setExpandedFolderIds((prev) => new Set(prev).add(folder.id));
            }, 600),
          };
        }
      } else {
        if (hoverExpandTimerRef.current?.timer) {
          clearTimeout(hoverExpandTimerRef.current.timer);
          hoverExpandTimerRef.current = null;
        }
      }
    } else {
      // Login item being dragged over folder
      e.dataTransfer.dropEffect = 'move';
      setDropTarget({ folderId: folder.id, position: 'inside', isValid: true });

      if (!expandedFolderIds.has(folder.id)) {
        if (hoverExpandTimerRef.current?.folderId !== folder.id) {
          if (hoverExpandTimerRef.current?.timer) {
            clearTimeout(hoverExpandTimerRef.current.timer);
          }
          hoverExpandTimerRef.current = {
            folderId: folder.id,
            timer: setTimeout(() => {
              setExpandedFolderIds((prev) => new Set(prev).add(folder.id));
            }, 600),
          };
        }
      }
    }
  };

  const handleFolderDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    targetFolder: LoginFolder,
    isMobile: boolean
  ) => {
    if (isMobile) return;
    e.preventDefault();
    e.stopPropagation();

    if (hoverExpandTimerRef.current?.timer) {
      clearTimeout(hoverExpandTimerRef.current.timer);
      hoverExpandTimerRef.current = null;
    }

    const currentDrop = dropTarget;
    setDropTarget(null);
    setDraggedFolderId(null);
    setDraggedItemType(null);

    try {
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (!raw) return;
      const data = JSON.parse(raw);

      if (data.type === 'login' && data.id) {
        await moveEntryToFolder(data.id, targetFolder.id);
        setExpandedFolderIds((prev) => new Set(prev).add(targetFolder.id));
      } else if (data.type === 'folder' && data.id) {
        const draggedId = data.id;
        if (draggedId === targetFolder.id) return;

        const pos = currentDrop?.position || 'inside';

        if (pos === 'inside') {
          if (!canDropFolderInto(draggedId, targetFolder.id)) {
            return;
          }
          await moveFolder(draggedId, targetFolder.id);
          setExpandedFolderIds((prev) => new Set(prev).add(targetFolder.id));
        } else {
          if (!canDropFolderAdjacent(draggedId, targetFolder)) {
            return;
          }

          const targetParentId = targetFolder.parent_id || null;
          const draggedFolder = folders.find((f) => f.id === draggedId);
          if (!draggedFolder) return;

          if ((draggedFolder.parent_id || null) !== targetParentId) {
            await moveFolder(draggedId, targetParentId);
          }

          const siblings = folders
            .filter((f) => (f.parent_id || null) === targetParentId && f.id !== draggedId)
            .sort(sortFolders);

          const targetIdx = siblings.findIndex((f) => f.id === targetFolder.id);
          if (targetIdx === -1) {
            siblings.push(draggedFolder);
          } else if (pos === 'before') {
            siblings.splice(targetIdx, 0, draggedFolder);
          } else {
            siblings.splice(targetIdx + 1, 0, draggedFolder);
          }

          const orderedIds = siblings.map((f) => f.id);
          await reorderFolders(orderedIds);
        }
      }
    } catch (err) {
      console.error('Failed to handle folder drop:', err);
    }
  };

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

  const renderFolderTree = (parentId: string | null = null, depth = 0, isMobile: boolean = false) => {
    const currentFolders = folders.filter((f) => (f.parent_id || null) === parentId).sort(sortFolders);
    if (currentFolders.length === 0) return null;

    return (
      <div className="space-y-0.5 mt-0.5">
        {currentFolders.map((folder) => {
          const folderEntries = entries.filter((e) => e.category === 'logins' && e.folder_id === folder.id);
          const isSelected = activeCategory === 'logins' && selectedFolderId === folder.id;
          const isRenaming = renamingFolderId === folder.id;
          const hasChildren = folders.some((f) => f.parent_id === folder.id);
          const isExpanded = expandedFolderIds.has(folder.id);

          const isDropTarget = dropTarget?.folderId === folder.id;
          const dropPos = isDropTarget ? dropTarget.position : null;
          const isDropValid = isDropTarget ? dropTarget.isValid : true;

          return (
            <div key={folder.id} className="group/folder relative">
              {/* Top insertion line for sibling reordering */}
              {!isMobile && isDropTarget && dropPos === 'before' && isDropValid && (
                <div className="absolute -top-0.5 left-2 right-2 h-0.5 bg-purple-500 rounded-full z-20 pointer-events-none shadow-xs" />
              )}

              <div
                draggable={!isMobile && !isRenaming}
                onDragStart={(e) => handleFolderDragStart(e, folder)}
                onDragEnd={handleFolderDragEnd}
                onDragOver={(e) => handleFolderDragOver(e, folder, isMobile)}
                onDragLeave={() => {
                  if (dropTarget?.folderId === folder.id) {
                    setDropTarget(null);
                  }
                }}
                onDrop={(e) => handleFolderDrop(e, folder, isMobile)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer relative ${
                  !isMobile && isDropTarget && dropPos === 'inside'
                    ? isDropValid
                      ? 'bg-purple-100 dark:bg-purple-900/50 ring-2 ring-purple-500 font-semibold text-purple-950 dark:text-purple-200'
                      : 'bg-rose-100/60 dark:bg-rose-950/40 ring-2 ring-rose-500/70 cursor-not-allowed'
                    : isSelected
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-950 dark:text-purple-200 font-semibold border border-purple-300 dark:border-purple-500/30'
                    : 'text-slate-700 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text hover:bg-slate-100 dark:hover:bg-theme-hover border border-transparent'
                } ${!isMobile && draggedFolderId === folder.id ? 'opacity-40' : ''}`}
                style={{ paddingLeft: `${8 + depth * 12}px` }}
                onClick={() => {
                  setActiveCategory('logins');
                  setSelectedFolderId(folder.id);
                }}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {/* Expand/Collapse Chevron or alignment spacer */}
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFolderExpanded(folder.id);
                      }}
                      className="p-0.5 hover:text-purple-600 dark:hover:text-purple-400 text-slate-400 dark:text-slate-500 transition-colors rounded cursor-pointer shrink-0"
                      title={isExpanded ? 'Collapse folder' : 'Expand folder'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  ) : (
                    <span className="w-4 h-4 shrink-0" />
                  )}

                  {isSelected || isExpanded ? (
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
                      <button type="submit" className="p-0.5 text-emerald-600 hover:text-emerald-700 cursor-pointer">
                        <Check className="w-3 h-3" />
                      </button>
                    </form>
                  ) : (
                    <span className="truncate">{folder.name}</span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {isMobile ? (
                    <div className="relative flex items-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMobileFolderMenuId((prev) => (prev === folder.id ? null : folder.id));
                        }}
                        title="Folder options"
                        aria-label="Folder options"
                        className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-500 dark:text-theme-text-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-theme-surface cursor-pointer transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {mobileFolderMenuId === folder.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 z-30 bg-theme-surface border border-theme-border rounded-xl shadow-xl p-1 min-w-[140px] space-y-0.5 animate-scale-up"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMobileFolderMenuId(null);
                              promptRenameFolder(folder);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-theme-text hover:bg-theme-hover rounded-lg cursor-pointer transition-colors min-h-[36px]"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            <span>Rename</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMobileFolderMenuId(null);
                              promptDeleteFolder(folder);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg cursor-pointer transition-colors min-h-[36px]"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    !isRenaming && (
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
                            promptDeleteFolder(folder);
                          }}
                          title="Delete folder"
                          className="p-1 hover:text-rose-600 rounded cursor-pointer"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )
                  )}
                  <span className="text-[11px] px-1.5 py-0.2 rounded-full font-mono bg-slate-200/60 dark:bg-theme-border/60 text-slate-700 dark:text-slate-300 font-medium">
                    {folderEntries.length}
                  </span>
                </div>
              </div>

              {/* Bottom insertion line for sibling reordering */}
              {!isMobile && isDropTarget && dropPos === 'after' && isDropValid && (
                <div className="absolute -bottom-0.5 left-2 right-2 h-0.5 bg-purple-500 rounded-full z-20 pointer-events-none shadow-xs" />
              )}

              {/* Recursively render child folders only if expanded */}
              {hasChildren && isExpanded && renderFolderTree(folder.id, depth + 1, isMobile)}
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
                onDragOver={(e) => {
                  if (isMobile) return;
                  if (draggedFolderId || draggedItemType) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setIsOverLoginsNav(true);
                  }
                }}
                onDragLeave={() => setIsOverLoginsNav(false)}
                onDrop={async (e) => {
                  if (isMobile) return;
                  e.preventDefault();
                  setIsOverLoginsNav(false);
                  try {
                    const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
                    if (!raw) return;
                    const data = JSON.parse(raw);
                    if (data.type === 'login' && data.id) {
                      await moveEntryToFolder(data.id, null);
                    } else if (data.type === 'folder' && data.id) {
                      const f = folders.find((itemF) => itemF.id === data.id);
                      if (f && f.parent_id !== null) {
                        await moveFolder(data.id, null);
                      }
                    }
                  } catch (err) {
                    console.error('Drop to logins root nav failed:', err);
                  }
                }}
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
                  !isMobile && isLoginsItem && isOverLoginsNav
                    ? 'ring-2 ring-purple-500 bg-purple-100 dark:bg-purple-950/60 font-semibold'
                    : isActive && (item.id !== 'logins' || selectedFolderId === null)
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
                  {/* Unfiled Category Link if folders exist */}
                  {folders.length > 0 && (
                    <div
                      onDragOver={(e) => {
                        if (isMobile) return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        setIsOverUnfiled(true);
                      }}
                      onDragLeave={() => setIsOverUnfiled(false)}
                      onDrop={async (e) => {
                        if (isMobile) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setIsOverUnfiled(false);
                        try {
                          const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
                          if (!raw) return;
                          const data = JSON.parse(raw);
                          if (data.type === 'login' && data.id) {
                            await moveEntryToFolder(data.id, null);
                          } else if (data.type === 'folder' && data.id) {
                            const f = folders.find((itemF) => itemF.id === data.id);
                            if (f && f.parent_id !== null) {
                              await moveFolder(data.id, null);
                            }
                          }
                        } catch (err) {
                          console.error('Drop on unfiled failed:', err);
                        }
                      }}
                      onClick={() => {
                        setActiveCategory('logins');
                        setSelectedFolderId('__unfiled__');
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                        !isMobile && isOverUnfiled
                          ? 'ring-2 ring-purple-500 bg-purple-100 dark:bg-purple-950/60 font-semibold'
                          : activeCategory === 'logins' && selectedFolderId === '__unfiled__'
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
                  {renderFolderTree(null, 0, isMobile)}

                  {/* Root drop zone when dragging nested folder */}
                  {!isMobile && (draggedFolderId || draggedItemType) && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        setIsOverRootDrop(true);
                      }}
                      onDragLeave={() => setIsOverRootDrop(false)}
                      onDrop={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsOverRootDrop(false);
                        try {
                          const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
                          if (!raw) return;
                          const data = JSON.parse(raw);
                          if (data.type === 'folder' && data.id) {
                            const f = folders.find((itemF) => itemF.id === data.id);
                            if (f && f.parent_id !== null) {
                              await moveFolder(data.id, null);
                            }
                          } else if (data.type === 'login' && data.id) {
                            await moveEntryToFolder(data.id, null);
                          }
                        } catch (err) {
                          console.error('Drop to root failed:', err);
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border border-dashed text-[11px] text-center transition-all cursor-pointer ${
                        isOverRootDrop
                          ? 'border-purple-500 bg-purple-100 dark:bg-purple-950/50 text-purple-950 dark:text-purple-200 font-semibold'
                          : 'border-slate-300 dark:border-theme-border text-slate-500 dark:text-theme-text-muted hover:border-purple-400'
                      }`}
                    >
                      Drop here to move to Root
                    </div>
                  )}

                  {/* New Folder Form or Button */}
                  {isCreatingFolder ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (newFolderName.trim()) {
                          const created = await createFolder(newFolderName.trim(), newFolderParentId);
                          if (created && newFolderParentId) {
                            setExpandedFolderIds((prev) => new Set(prev).add(newFolderParentId));
                          }
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
    </>
  );
};
