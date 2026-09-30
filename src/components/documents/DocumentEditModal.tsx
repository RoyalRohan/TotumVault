import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, Bell, Tag, FileText, ArrowLeft } from 'lucide-react';
import { useVault } from '../../context/VaultContext';
import { DocumentCategoryType, DocumentDetail } from '../../types';
import { DOCUMENT_CATEGORIES, getDocumentExpiryDisplay } from './documentUtils';
import { DualDatePicker } from '../common/DualDatePicker';
import {
  NotificationPermissionPrompt,
  useDocumentNotificationPermission,
} from './NotificationPermissionPrompt';

interface DocumentEditModalProps {
  documentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const DocumentEditModal: React.FC<DocumentEditModalProps> = ({
  documentId,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { getDocumentDetail, saveDocument, showToast } = useVault();
  const {
    isAndroid,
    notifAllowed,
    showConfirmModal,
    showSettingsModal,
    handleToggleReminder,
    requestPermission,
    onConfirmAllow,
    onCancelPrompt,
    onOpenSettings,
    onCloseSettingsPrompt,
  } = useDocumentNotificationPermission();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategoryType>('other');
  const [documentDate, setDocumentDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [description, setDescription] = useState('');
  const [favorite, setFavorite] = useState(false);

  // Load document when modal opens
  const loadData = useCallback(async () => {
    if (!documentId || !isOpen) return;
    setIsLoading(true);
    try {
      const detail: DocumentDetail = await getDocumentDetail(documentId);
      setTitle(detail.metadata.title || '');
      setCategory((detail.metadata.doc_type as DocumentCategoryType) || 'other');
      setDocumentDate(detail.metadata.document_date || '');
      setExpiryDate(detail.metadata.expiry_date || '');
      setReminderEnabled(detail.metadata.reminder_enabled ?? true);
      setTags(detail.metadata.tags || []);
      setTagInput('');
      setDescription(detail.metadata.description || '');
      setFavorite(detail.metadata.favorite || false);
    } catch {
      showToast("Couldn't open this document.", 'error');
      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [documentId, isOpen, getDocumentDetail, showToast, onClose]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keyboard Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleAddTag = () => {
    const val = tagInput.trim().toLowerCase();
    if (val && !tags.includes(val)) {
      setTags([...tags, val]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showToast('Document title is required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await saveDocument({
        id: documentId,
        title: trimmedTitle,
        doc_type: category,
        description: description.trim(),
        tags,
        document_date: documentDate || undefined,
        expiry_date: expiryDate || undefined,
        favorite,
        reminder_enabled: reminderEnabled,
        pages: [], // Preserves existing encrypted pages
      });

      showToast('Document saved', 'success');
      onSaved?.();
      onClose();
    } catch {
      showToast("Couldn't save changes.", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !documentId) return null;

  const expiryInfo = getDocumentExpiryDisplay(expiryDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md select-none animate-scale-up">
      <div className="w-full max-w-lg glass-panel rounded-2xl border border-theme-border bg-theme-bg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-theme-border bg-theme-surface/60 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 -ml-1 rounded-xl text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors sm:hidden cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-bold text-theme-text">Edit Document</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-theme-text-muted">
            <div className="w-7 h-7 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading document details...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-theme-text block mb-1">
                Document Title
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Passport, Electric Bill, Driver's License"
                  className="input-themed w-full rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm font-medium"
                  required
                />
                <FileText className="w-4 h-4 text-theme-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Document Type */}
            <div>
              <label className="text-xs font-semibold text-theme-text block mb-1.5">
                Document Type
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-1.5">
                {DOCUMENT_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`p-2 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 min-h-[38px] ${
                        isSelected
                          ? 'bg-purple-600 text-white font-semibold border-purple-600 shadow-xs'
                          : 'bg-theme-surface border-theme-border text-theme-text hover:bg-theme-hover'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`} />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Issue Date & Expiry Date (Large Dual Calendar) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-theme-text block mb-1">
                  Issue Date
                </label>
                <DualDatePicker
                  value={documentDate}
                  onChange={setDocumentDate}
                  placeholder="Select issue date"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-theme-text block mb-1">
                  Expiry Date
                </label>
                <DualDatePicker
                  value={expiryDate}
                  onChange={setExpiryDate}
                  placeholder="Select expiry date"
                />
                {/* Live Expiry Status beneath Expiry Date */}
                <div className="mt-1.5 px-2 py-1 rounded-lg bg-theme-surface/70 border border-theme-border flex items-center justify-between text-[11px]">
                  <span className="text-theme-text-muted">Status:</span>
                  <span className={expiryInfo.badgeClass}>{expiryInfo.label}</span>
                </div>
              </div>
            </div>

            {/* Renewal Reminders Toggle */}
            {expiryDate && (
              <div className="p-3 rounded-xl bg-theme-surface border border-theme-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-theme-text block">
                        Renewal Reminders
                      </span>
                      <span className="text-[11px] text-theme-text-muted block">
                        Reminders appear before and after expiry.
                      </span>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                    <input
                      type="checkbox"
                      checked={reminderEnabled}
                      onChange={(e) => handleToggleReminder(e.target.checked, setReminderEnabled)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {isAndroid && reminderEnabled && (
                  <div className="pt-2 border-t border-theme-border flex items-center justify-between text-xs">
                    <span className="text-theme-text-muted font-medium">Notifications</span>
                    {notifAllowed ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Allowed
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">Not allowed</span>
                        <button
                          type="button"
                          onClick={() => requestPermission(setReminderEnabled)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer transition-colors shadow-xs"
                        >
                          Allow Notifications
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="text-xs font-semibold text-theme-text block mb-1">
                Tags
              </label>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-medium border border-purple-500/20"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="hover:text-rose-500 cursor-pointer"
                        aria-label={`Remove tag ${t}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add tag and press Enter..."
                    className="input-themed w-full rounded-xl pl-9 pr-3 py-2 text-xs"
                  />
                  <Tag className="w-3.5 h-3.5 text-theme-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-2 rounded-xl bg-theme-surface hover:bg-theme-hover border border-theme-border text-theme-text text-xs font-semibold cursor-pointer shrink-0"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Description / Notes */}
            <div>
              <label className="text-xs font-semibold text-theme-text block mb-1">
                Description & Notes
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details, account number, or notes..."
                rows={2}
                className="input-themed w-full rounded-xl px-3.5 py-2.5 text-xs resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-theme-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-hover text-theme-text text-xs font-semibold cursor-pointer transition-colors min-h-[38px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors min-h-[38px] disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      <NotificationPermissionPrompt
        showConfirmModal={showConfirmModal}
        showSettingsModal={showSettingsModal}
        onConfirmAllow={onConfirmAllow}
        onCancelPrompt={onCancelPrompt}
        onOpenSettings={onOpenSettings}
        onCloseSettingsPrompt={onCloseSettingsPrompt}
      />
    </div>
  );
};
