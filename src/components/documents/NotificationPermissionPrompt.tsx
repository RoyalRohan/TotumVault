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
      {/* 1. Android 13+ In-App Confirmation Popup before System Dialog */}
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

      {/* 2. Permanent Denial / Settings Fallback Prompt */}
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const pendingReminderSetterRef = React.useRef<((val: boolean) => void) | null>(null);
  const { showToast } = useVault();

  const checkStatus = useCallback(() => {
    const available = isAndroidNotificationAvailable();
    setIsAndroid(available);
    if (available) {
      const granted = isAndroidNotificationGranted();
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

  const handleToggleReminder = useCallback(
    async (checked: boolean, setReminderState: (val: boolean) => void) => {
      pendingReminderSetterRef.current = setReminderState;

      if (!checked) {
        setReminderState(false);
        return;
      }

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

      // Notification not granted
      setReminderState(false);

      if (!isAndroid13OrHigher()) {
        // Below Android 13: no runtime POST_NOTIFICATIONS dialog; notifications disabled in settings
        setShowSettingsModal(true);
        return;
      }

      // Android 13+
      const canRequest = canRequestAndroidNotificationPermission();
      if (!canRequest) {
        // Permanently denied
        setShowSettingsModal(true);
        return;
      }

      // Show in-app confirmation popup BEFORE requesting Android system dialog
      setShowConfirmModal(true);
    },
    []
  );

  const requestPermission = useCallback(
    async (setReminderState?: (val: boolean) => void) => {
      if (setReminderState) {
        pendingReminderSetterRef.current = setReminderState;
      }

      if (!isAndroidNotificationAvailable()) {
        setReminderState?.(true);
        return true;
      }

      const granted = isAndroidNotificationGranted();
      setNotifAllowed(granted);
      if (granted) {
        setReminderState?.(true);
        return true;
      }

      if (!isAndroid13OrHigher() || !canRequestAndroidNotificationPermission()) {
        setShowSettingsModal(true);
        return false;
      }

      setShowConfirmModal(true);
      return false;
    },
    []
  );

  const onConfirmAllow = useCallback(
    async (overrideSetter?: (val: boolean) => void) => {
      setShowConfirmModal(false);
      const setter = overrideSetter || pendingReminderSetterRef.current;

      const result = await requestAndroidNotificationPermission();
      const granted = result === 'GRANTED';
      setNotifAllowed(granted);

      if (granted) {
        setter?.(true);
        await reconcileAndroidReminders();
        showToast('Notifications allowed', 'success');
      } else {
        setter?.(false);
        showToast('Notifications are off. You can enable them later.', 'info');
      }
    },
    [showToast]
  );

  const onCancelPrompt = useCallback((overrideSetter?: (val: boolean) => void) => {
    setShowConfirmModal(false);
    const setter = overrideSetter || pendingReminderSetterRef.current;
    setter?.(false);
  }, []);

  const onOpenSettings = useCallback(() => {
    setShowSettingsModal(false);
    openAndroidNotificationSettings();
  }, []);

  const onCloseSettingsPrompt = useCallback((overrideSetter?: (val: boolean) => void) => {
    setShowSettingsModal(false);
    const setter = overrideSetter || pendingReminderSetterRef.current;
    setter?.(false);
  }, []);

  return {
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
  };
}
