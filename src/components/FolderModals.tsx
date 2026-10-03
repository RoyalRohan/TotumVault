import React, { useState, useEffect } from 'react';
import { useVault } from '../context/VaultContext';
import { Folder, Trash2, Edit2 } from 'lucide-react';

export const FolderModals: React.FC = () => {
  const {
    deletingFolder,
    cancelDeleteFolder,
    confirmDeleteFolder,
    renamingFolder,
    cancelRenameFolder,
    confirmRenameFolder,
  } = useVault();

  const [deleteContents, setDeleteContents] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    if (deletingFolder) {
      setDeleteContents(false);
      setIsDeleting(false);
    }
  }, [deletingFolder]);

  useEffect(() => {
    if (renamingFolder) {
      setRenameInput(renamingFolder.name);
      setIsRenaming(false);
    }
  }, [renamingFolder]);

  return (
    <>
      {deletingFolder && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in select-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-folder-modal-title"
        >
          <div
            className="fixed inset-0"
            onClick={() => {
              if (!isDeleting) cancelDeleteFolder();
            }}
          />
          <div className="relative bg-theme-surface border border-theme-border rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-scale-up z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <h3 id="delete-folder-modal-title" className="font-bold text-sm text-theme-text truncate">
                Delete Folder &ldquo;{deletingFolder.name}&rdquo;
              </h3>
            </div>

            <p className="text-xs text-theme-text-muted">
              What would you like to do with the logins inside this folder and its subfolders?
            </p>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2.5 text-xs text-theme-text cursor-pointer select-none p-2 rounded-xl border border-transparent hover:bg-theme-hover transition-colors">
                <input
                  type="radio"
                  name="del_opt"
                  checked={!deleteContents}
                  onChange={() => setDeleteContents(false)}
                  disabled={isDeleting}
                  className="accent-purple-600 cursor-pointer w-4 h-4"
                />
                <span className="leading-tight">
                  <strong className="block text-theme-text">Keep Logins</strong>
                  <span className="text-[11px] text-theme-text-muted">Move all logins inside to Unfiled</span>
                </span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-rose-600 dark:text-rose-400 cursor-pointer select-none p-2 rounded-xl border border-transparent hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-colors">
                <input
                  type="radio"
                  name="del_opt"
                  checked={deleteContents}
                  onChange={() => setDeleteContents(true)}
                  disabled={isDeleting}
                  className="accent-rose-600 cursor-pointer w-4 h-4"
                />
                <span className="leading-tight">
                  <strong className="block text-rose-700 dark:text-rose-300">Delete All Logins</strong>
                  <span className="text-[11px] text-rose-600/80 dark:text-rose-400/80">Permanently delete logins in this folder</span>
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-theme-border">
              <button
                type="button"
                onClick={cancelDeleteFolder}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs text-theme-text-muted hover:text-theme-text rounded-xl border border-theme-border hover:bg-theme-hover cursor-pointer transition-colors disabled:opacity-50 min-h-[34px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await confirmDeleteFolder(deleteContents);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className={`px-3.5 py-1.5 text-xs text-white rounded-xl font-medium shadow-xs cursor-pointer transition-colors min-h-[34px] flex items-center gap-1.5 ${
                  deleteContents ? 'bg-rose-600 hover:bg-rose-700' : 'bg-purple-600 hover:bg-purple-700'
                } disabled:opacity-50`}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {renamingFolder && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in select-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-folder-modal-title"
        >
          <div
            className="fixed inset-0"
            onClick={() => {
              if (!isRenaming) cancelRenameFolder();
            }}
          />
          <div className="relative bg-theme-surface border border-theme-border rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-scale-up z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                <Edit2 className="w-4 h-4" />
              </div>
              <h3 id="rename-folder-modal-title" className="font-bold text-sm text-theme-text truncate">
                Rename Folder
              </h3>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!renameInput.trim() || isRenaming) return;
                setIsRenaming(true);
                try {
                  await confirmRenameFolder(renameInput);
                } finally {
                  setIsRenaming(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-theme-text-muted block mb-1.5">
                  Folder Name
                </label>
                <div className="relative">
                  <Folder className="w-4 h-4 text-theme-text-dim absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    placeholder="Enter folder name..."
                    autoFocus
                    className="w-full input-themed rounded-xl pl-9 pr-3 py-2 text-xs placeholder:text-theme-text-dim focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-theme-border">
                <button
                  type="button"
                  onClick={cancelRenameFolder}
                  disabled={isRenaming}
                  className="px-3.5 py-1.5 text-xs text-theme-text-muted hover:text-theme-text rounded-xl border border-theme-border hover:bg-theme-hover cursor-pointer transition-colors disabled:opacity-50 min-h-[34px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameInput.trim() || isRenaming}
                  className="px-3.5 py-1.5 text-xs text-white rounded-xl font-medium bg-purple-600 hover:bg-purple-700 shadow-xs cursor-pointer transition-colors disabled:opacity-50 min-h-[34px]"
                >
                  {isRenaming ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
