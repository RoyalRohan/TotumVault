import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import {
  isAndroidNotificationAvailable,
  isAndroidNotificationGranted,
  canRequestAndroidNotificationPermission,
  requestAndroidNotificationPermission,
  openAndroidNotificationSettings,
  reconcileAndroidReminders,
  isAndroid13OrHigher,
} from '../../utils/androidNotification';
import { useVault } from '../../context/VaultContext';

export interface NotificationPermissionPromptProps {
  showConfirmModal: boolean;
  showSettingsModal: boolean;
  onConfirmAllow: () => void;
  onCancelPrompt: () => void;
  onOpenSettings: () => void;
  onCloseSettingsPrompt: () => void;
}

export const NotificationPermissionPrompt: React.FC<NotificationPermissionPromptProps> = ({
  showConfirmModal,
  showSettingsModal,
  onConfirmAllow,
  onCancelPrompt,
  onOpenSettings,
  onCloseSettingsPrompt,
}) => {
  if (typeof document === 'undefined') return null;

  return (
    <>
      {showConfirmModal &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
            <div
              className="fixed inset-0"
              onClick={onCancelPrompt}
              aria-hidden="true"
            />
            <div
              className="relative z-10 w-full max-w-sm rounded-2xl bg-white dark:bg-theme-surface border border-slate-200 dark:border-theme-border p-5 shadow-2xl text-slate-900 dark:text-theme-text animate-scale-up space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-theme-text">
                    Allow Notifications
                  </h3>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-slate-600 dark:text-theme-text-muted">
                TotumVault uses notifications to remind you before documents expire.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCancelPrompt}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-theme-text-muted hover:bg-slate-100 dark:hover:bg-theme-hover cursor-pointer transition-colors"
                >
                  Not Now
                </button>
                <button
                  type="button"
                  onClick={onConfirmAllow}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer transition-colors shadow-xs"
                >
                  Allow Notifications
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showSettingsModal &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
            <div
              className="fixed inset-0"
              onClick={onCloseSettingsPrompt}
              aria-hidden="true"
            />
            <div
              className="relative z-10 w-full max-w-sm rounded-2xl bg-white dark:bg-theme-surface border border-slate-200 dark:border-theme-border p-5 shadow-2xl text-slate-900 dark:text-theme-text animate-scale-up space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-theme-text">
                    Allow Notifications
                  </h3>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-slate-600 dark:text-theme-text-muted">
                Notifications are turned off in system settings. Open Android Settings to allow notifications for TotumVault.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCloseSettingsPrompt}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-theme-text-muted hover:bg-slate-100 dark:hover:bg-theme-hover cursor-pointer transition-colors"
                >
                  Not Now
                </button>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer transition-colors shadow-xs"
                >
                  Open Settings
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

/**
 * Reusable hook for document reminder flows.
 * Handles checking permission, showing confirmation before system dialog,
 * gracefully handling permanent denials, and auto-reconciling when permission is enabled later.
 */
export function useDocumentNotificationPermission() {
  const [isAndroid, setIsAndroid] = useState(false);
  const [notifAllowed, setNotifAllowed] = useState(true);
  const [canRequest, setCanRequest] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const pendingReminderSetterRef = React.useRef<((val: boolean) => void) | null>(null);
  const pendingSaveActionRef = React.useRef<((effectiveReminderEnabled: boolean) => Promise<void> | void) | null>(null);
  const { showToast } = useVault();

  const checkStatus = useCallback(() => {
    const available = isAndroidNotificationAvailable();
    setIsAndroid(available);
    if (available) {
      const granted = isAndroidNotificationGranted();
      const canReq = canRequestAndroidNotificationPermission();
      setCanRequest(canReq);
      setNotifAllowed((prev) => {
        if (!prev && granted) {
          // Permission was enabled later (e.g. in settings) -> automatically reconcile reminders
          reconcileAndroidReminders().catch(() => {});
          if (pendingReminderSetterRef.current) {
            pendingReminderSetterRef.current(true);
          }
        }
        return granted;
      });
    } else {
      setNotifAllowed(true);
      setCanRequest(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();

    const handleResume = () => {
      checkStatus();
    };

    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);

    return () => {
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, [checkStatus]);

  const checkAndPromptOnActivation = useCallback(
    (setReminderState: (val: boolean) => void) => {
      pendingReminderSetterRef.current = setReminderState;

      if (!isAndroidNotificationAvailable()) {
        setReminderState(true);
        return;
      }

      const granted = isAndroidNotificationGranted();
      setNotifAllowed(granted);

      if (granted) {
        setReminderState(true);
        reconcileAndroidReminders().catch(() => {});
        return;
      }

      // Android notification permission is missing: prompt immediately!
      const canReq = canRequestAndroidNotificationPermission();
      setCanRequest(canReq);

      if (!isAndroid13OrHigher() || !canReq) {
        setShowSettingsModal(true);
      } else {
        setShowConfirmModal(true);
      }
    },
    []
  );

  const getEffectiveReminderEnabled = useCallback(
    (hasExpiryDate: boolean, isReminderEnabled: boolean): boolean => {
      if (!hasExpiryDate || !isReminderEnabled) return false;
      if (isAndroidNotificationAvailable() && !isAndroidNotificationGranted()) return false;
      return true;
    },
    []
  );

  const handleToggleReminder = useCallback(
    async (checked: boolean, setReminderState: (val: boolean) => void) => {
      if (!checked) {
        setReminderState(false);
        return;
      }
      checkAndPromptOnActivation(setReminderState);
    },
    [checkAndPromptOnActivation]
  );

  const requestPermission = useCallback(
    async (setReminderState?: (val: boolean) => void) => {
      if (setReminderState) {
        checkAndPromptOnActivation(setReminderState);
        return isAndroidNotificationGranted();
      }

      if (!isAndroidNotificationAvailable()) {
        return true;
      }

      const granted = isAndroidNotificationGranted();
      setNotifAllowed(granted);
      if (granted) return true;

      const canReq = canRequestAndroidNotificationPermission();
      setCanRequest(canReq);

      if (!isAndroid13OrHigher() || !canReq) {
        setShowSettingsModal(true);
        return false;
      }

      setShowConfirmModal(true);
      return false;
    },
    [checkAndPromptOnActivation]
  );

  const promptBeforeSave = useCallback(
    async ({
      hasExpiryDate,
      reminderEnabled,
      onProceed,
    }: {
      hasExpiryDate: boolean;
      reminderEnabled: boolean;
      onProceed: (effectiveReminderEnabled: boolean) => Promise<void> | void;
    }) => {
      // If not on Android or document has no expiry date or reminder is toggled off:
      if (!isAndroidNotificationAvailable() || !hasExpiryDate || !reminderEnabled) {
        await onProceed(reminderEnabled);
        return;
      }

      // Check current permission
      const granted = isAndroidNotificationGranted();
      setNotifAllowed(granted);

      if (granted) {
        await onProceed(true);
        reconcileAndroidReminders().catch(() => {});
        return;
      }

      // Permission needed before activating reminders:
      // Store the save callback so document data is NEVER lost regardless of user decision
      pendingSaveActionRef.current = onProceed;

      if (!isAndroid13OrHigher() || !canRequestAndroidNotificationPermission()) {
        setShowSettingsModal(true);
      } else {
        setShowConfirmModal(true);
      }
    },
    []
  );

  const onConfirmAllow = useCallback(
    async (overrideSetter?: (val: boolean) => void) => {
      setShowConfirmModal(false);
      const saveAction = pendingSaveActionRef.current;
      pendingSaveActionRef.current = null;
      const setter = overrideSetter || pendingReminderSetterRef.current;

      const result = await requestAndroidNotificationPermission();
      const granted = result === 'GRANTED';
      setNotifAllowed(granted);
      setCanRequest(canRequestAndroidNotificationPermission());

      if (granted) {
        setter?.(true);
        showToast('Document reminders are enabled.', 'success');
        if (saveAction) {
          await saveAction(true);
        }
        await reconcileAndroidReminders().catch(() => {});
      } else {
        setter?.(false);
        showToast(
          result === 'PERMANENTLY_DENIED'
            ? 'Notifications are disabled for TotumVault. You can enable them later in Android Settings.'
            : 'Notifications are off. You can enable them later in Documents settings.',
          'info'
        );
        if (saveAction) {
          await saveAction(false);
        }
      }
    },
    [showToast]
  );

  const onCancelPrompt = useCallback(
    async (overrideSetter?: (val: boolean) => void) => {
      setShowConfirmModal(false);
      const saveAction = pendingSaveActionRef.current;
      pendingSaveActionRef.current = null;
      const setter = overrideSetter || pendingReminderSetterRef.current;
      setter?.(false);

      if (saveAction) {
        showToast('Notifications are off. You can enable them later in Documents settings.', 'info');
        await saveAction(false);
      }
    },
    [showToast]
  );

  const onOpenSettings = useCallback(
    async () => {
      setShowSettingsModal(false);
      const saveAction = pendingSaveActionRef.current;
      pendingSaveActionRef.current = null;
      const setter = pendingReminderSetterRef.current;
      setter?.(false);

      openAndroidNotificationSettings();

      if (saveAction) {
        showToast('Notifications are off. You can enable them later in Android Settings.', 'info');
        await saveAction(false);
      }
    },
    [showToast]
  );

  const onCloseSettingsPrompt = useCallback(
    async (overrideSetter?: (val: boolean) => void) => {
      setShowSettingsModal(false);
      const saveAction = pendingSaveActionRef.current;
      pendingSaveActionRef.current = null;
      const setter = overrideSetter || pendingReminderSetterRef.current;
      setter?.(false);

      if (saveAction) {
        showToast('Notifications are off. You can enable them later in Documents settings.', 'info');
        await saveAction(false);
      }
    },
    [showToast]
  );

  return {
    isAndroid,
    notifAllowed,
    canRequest,
    showConfirmModal,
    showSettingsModal,
    handleToggleReminder,
    checkAndPromptOnActivation,
    getEffectiveReminderEnabled,
    requestPermission,
    promptBeforeSave,
    onConfirmAllow,
    onCancelPrompt,
    onOpenSettings,
    onCloseSettingsPrompt,
  };
}
