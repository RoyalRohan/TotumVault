import React, { useState, useEffect } from 'react';
import { AlertTriangle, Bell, Calendar, Check, Clock } from 'lucide-react';
import { useVault } from '../../../context/VaultContext';
import { getTodayDual } from '../../../utils/nepaliCalendar';
import {
  isAndroidNotificationAvailable,
  isAndroidNotificationGranted,
  requestAndroidNotificationPermission,
  openAndroidNotificationSettings,
  sendAndroidTestNotification,
} from '../../../utils/androidNotification';

export const DocumentSettings: React.FC = () => {
  const {
    documentRemindersEnabled,
    setDocumentRemindersEnabled,
    syncDocumentReminders,
    calendarPreference,
    setCalendarPreference,
    numeralPreference,
    setNumeralPreference,
  } = useVault();

  const [isSyncingReminders, setIsSyncingReminders] = useState(false);
  const [isSendingTestNotif, setIsSendingTestNotif] = useState(false);
  const [reminderSyncMsg, setReminderSyncMsg] = useState('');
  const [isAndroid, setIsAndroid] = useState(false);
  const [notifGranted, setNotifGranted] = useState(true);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

  useEffect(() => {
    const available = isAndroidNotificationAvailable();
    setIsAndroid(available);
    if (available) {
      setNotifGranted(isAndroidNotificationGranted());
    }

    const handleFocus = () => {
      if (isAndroidNotificationAvailable()) {
        setNotifGranted(isAndroidNotificationGranted());
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const handleToggleReminders = async (enabled: boolean) => {
    if (enabled && isAndroid && !isAndroidNotificationGranted()) {
      setShowPermissionPrompt(true);
      return;
    }
    await setDocumentRemindersEnabled(enabled);
  };

  const handleSendTestNotification = async () => {
    setIsSendingTestNotif(true);
    setReminderSyncMsg('');
    const ok = await sendAndroidTestNotification();
    setReminderSyncMsg(ok ? 'Test notification sent' : 'Failed to send test notification');
    setIsSendingTestNotif(false);
    setTimeout(() => setReminderSyncMsg(''), 4000);
  };

  const todayInfo = (() => {
    try {
      return getTodayDual(numeralPreference === 'ne');
    } catch {
      return null;
    }
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Permission Rationale Modal */}
      {showPermissionPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Enable Document Reminders
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Permission required
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
              TotumVault needs notification access to alert you at 09:00 before documents expire.
            </p>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-700/60 text-[11px] text-slate-500 dark:text-zinc-400">
              All alerts are calculated 100% locally and work offline with Air-Gap security.
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowPermissionPrompt(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const granted = await requestAndroidNotificationPermission();
                  setNotifGranted(granted);
                  await setDocumentRemindersEnabled(true);
                  setShowPermissionPrompt(false);
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer transition-colors"
              >
                Allow Notifications
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subsection 1: Renewal & Expiry Reminders */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Bell className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-theme-text">
              Renewal & Expiry Reminders
            </h4>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={documentRemindersEnabled}
              onChange={(e) => handleToggleReminders(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {/* Android Notification Status Banner */}
        {isAndroid && documentRemindersEnabled && !notifGranted && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Notifications are blocked in system settings. Allow notifications to receive alerts.</span>
            </div>
            <button
              type="button"
              onClick={() => openAndroidNotificationSettings()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer transition-colors shrink-0"
            >
              Allow Notifications
            </button>
          </div>
        )}

        {documentRemindersEnabled && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-theme-surface/70 border border-slate-200/80 dark:border-theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-theme-text-muted space-y-1">
              <div className="flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Next notification: </span>
                <span className="font-semibold text-slate-900 dark:text-theme-text">09:00 local time</span>
              </div>
              {isAndroid && notifGranted && (
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  <span>Notifications allowed</span>
                </div>
              )}
              {reminderSyncMsg && (
                <span className="block text-[11px] text-purple-600 dark:text-purple-400 font-medium pt-0.5">
                  {reminderSyncMsg}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isSyncingReminders}
                onClick={async () => {
                  setIsSyncingReminders(true);
                  setReminderSyncMsg('');
                  const sent = await syncDocumentReminders();
                  setReminderSyncMsg(sent > 0 ? `Sent ${sent} notification(s)` : 'All reminders up to date');
                  setIsSyncingReminders(false);
                  setTimeout(() => setReminderSyncMsg(''), 4000);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-theme-border hover:bg-slate-100 dark:hover:bg-theme-hover text-slate-700 dark:text-theme-text cursor-pointer transition-colors shrink-0 min-h-[36px]"
              >
                {isSyncingReminders ? 'Checking...' : 'Check Now'}
              </button>

              {isAndroid && (
                <button
                  type="button"
                  disabled={isSendingTestNotif || !notifGranted}
                  onClick={handleSendTestNotification}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-theme-border hover:bg-slate-100 dark:hover:bg-theme-hover text-slate-700 dark:text-theme-text cursor-pointer transition-colors shrink-0 min-h-[36px] disabled:opacity-50"
                >
                  {isSendingTestNotif ? 'Sending...' : 'Send Test Notification'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Subsection 2: Calendar & Localization */}
      <div className="space-y-4 pt-5 border-t border-slate-200/80 dark:border-theme-border">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-theme-text">
            Calendar & Localization
          </h4>
        </div>

        {/* Calendar Mode Selector */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-900 dark:text-theme-text block">
            Calendar
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setCalendarPreference('dual')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between min-h-[48px] ${
                calendarPreference === 'dual'
                  ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-950/30 text-slate-900 dark:text-theme-text ring-1 ring-purple-500/30'
                  : 'border-slate-200/90 dark:border-theme-border bg-white dark:bg-theme-surface hover:bg-slate-50 dark:hover:bg-theme-hover text-slate-700 dark:text-theme-text-muted'
              }`}
            >
              <span className="text-xs font-bold">Dual (AD + BS)</span>
              {calendarPreference === 'dual' && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 stroke-[2.5]" />}
            </button>

            <button
              type="button"
              onClick={() => setCalendarPreference('bs')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between min-h-[48px] ${
                calendarPreference === 'bs'
                  ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-950/30 text-slate-900 dark:text-theme-text ring-1 ring-purple-500/30'
                  : 'border-slate-200/90 dark:border-theme-border bg-white dark:bg-theme-surface hover:bg-slate-50 dark:hover:bg-theme-hover text-slate-700 dark:text-theme-text-muted'
              }`}
            >
              <span className="text-xs font-bold">BS Only (नेपाली)</span>
              {calendarPreference === 'bs' && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 stroke-[2.5]" />}
            </button>

            <button
              type="button"
              onClick={() => setCalendarPreference('ad')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between min-h-[48px] ${
                calendarPreference === 'ad'
                  ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-950/30 text-slate-900 dark:text-theme-text ring-1 ring-purple-500/30'
                  : 'border-slate-200/90 dark:border-theme-border bg-white dark:bg-theme-surface hover:bg-slate-50 dark:hover:bg-theme-hover text-slate-700 dark:text-theme-text-muted'
              }`}
            >
              <span className="text-xs font-bold">AD Only</span>
              {calendarPreference === 'ad' && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 stroke-[2.5]" />}
            </button>
          </div>
        </div>

        {/* Numeral System Selector */}
        <div className="space-y-2 pt-1">
          <span className="text-xs font-semibold text-slate-900 dark:text-theme-text block">
            Numerals
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setNumeralPreference('en')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between min-h-[48px] ${
                numeralPreference === 'en'
                  ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-950/30 text-slate-900 dark:text-theme-text ring-1 ring-purple-500/30'
                  : 'border-slate-200/90 dark:border-theme-border bg-white dark:bg-theme-surface hover:bg-slate-50 dark:hover:bg-theme-hover text-slate-700 dark:text-theme-text-muted'
              }`}
            >
              <span className="text-xs font-bold">English Digits</span>
              {numeralPreference === 'en' && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 stroke-[2.5]" />}
            </button>

            <button
              type="button"
              onClick={() => setNumeralPreference('ne')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between min-h-[48px] ${
                numeralPreference === 'ne'
                  ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-950/30 text-slate-900 dark:text-theme-text ring-1 ring-purple-500/30'
                  : 'border-slate-200/90 dark:border-theme-border bg-white dark:bg-theme-surface hover:bg-slate-50 dark:hover:bg-theme-hover text-slate-700 dark:text-theme-text-muted'
              }`}
            >
              <span className="text-xs font-bold">Nepali Numerals (नेपाली अंक)</span>
              {numeralPreference === 'ne' && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 stroke-[2.5]" />}
            </button>
          </div>
        </div>

        {/* Live Today Preview */}
        {todayInfo && (
          <div className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-500/20 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-theme-text-muted text-xs font-semibold">
              Today:
            </span>
            <span className="font-semibold text-purple-700 dark:text-purple-300 text-xs">
              {calendarPreference === 'dual'
                ? todayInfo.formattedDual
                : calendarPreference === 'bs'
                ? todayInfo.formattedBs
                : todayInfo.formattedAd}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
