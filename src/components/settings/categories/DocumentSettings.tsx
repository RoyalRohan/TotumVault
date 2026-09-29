import React, { useState } from 'react';
import { Bell, Calendar, Check, Clock } from 'lucide-react';
import { useVault } from '../../../context/VaultContext';
import { getTodayDual } from '../../../utils/nepaliCalendar';

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
  const [reminderSyncMsg, setReminderSyncMsg] = useState('');

  const todayInfo = (() => {
    try {
      return getTodayDual(numeralPreference === 'ne');
    } catch {
      return null;
    }
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Category Header */}
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-theme-text">Documents</h3>
        <p className="text-xs text-slate-500 dark:text-theme-text-muted mt-0.5">
          Configure document renewal alerts, expiration milestones, and dual calendar localization.
        </p>
      </div>

      {/* Subsection 1: Renewal & Expiry Reminders */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-theme-text-muted">
                Renewal & Expiry Reminders
              </h4>
              <p className="text-xs text-slate-600 dark:text-theme-text-muted">
                Local operating system notifications for document and bill expirations.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={documentRemindersEnabled}
              onChange={(e) => setDocumentRemindersEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {documentRemindersEnabled && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-theme-surface/70 border border-slate-200/80 dark:border-theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-theme-text-muted space-y-0.5">
              <div className="flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Scheduled Delivery: </span>
                <span className="font-semibold text-slate-900 dark:text-theme-text">09:00 local time daily</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-theme-text-muted">
                Milestones: 5 days prior, daily until expiry, and once post-expiry.
              </p>
              {reminderSyncMsg && (
                <span className="block text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                  {reminderSyncMsg}
                </span>
              )}
            </div>

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
              {isSyncingReminders ? 'Checking...' : 'Check Reminders Now'}
            </button>
          </div>
        )}
      </div>

      {/* Subsection 2: Calendar & Localization */}
      <div className="space-y-4 pt-5 border-t border-slate-200/80 dark:border-theme-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-theme-text-muted">
              Calendar & Localization
            </h4>
          </div>
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30">
            Gregorian (AD) + Bikram Sambat (BS)
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-theme-text-muted">
          Configure how dates are displayed across documents, bills, and expiration tracking. All data is securely stored in standard canonical format and operates 100% offline.
        </p>

        {/* Calendar Mode Selector */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-900 dark:text-theme-text block">
            Calendar Display Mode
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setCalendarPreference('dual')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[64px] ${
                calendarPreference === 'dual'
                  ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-950/30 text-slate-900 dark:text-theme-text ring-1 ring-purple-500/30'
                  : 'border-slate-200/90 dark:border-theme-border bg-white dark:bg-theme-surface hover:bg-slate-50 dark:hover:bg-theme-hover text-slate-700 dark:text-theme-text-muted'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold">Dual (AD + BS)</span>
                {calendarPreference === 'dual' && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 stroke-[2.5]" />}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-theme-text-muted block leading-tight">
                Show both calendars together (recommended)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCalendarPreference('bs')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[64px] ${
                calendarPreference === 'bs'
                  ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-950/30 text-slate-900 dark:text-theme-text ring-1 ring-purple-500/30'
                  : 'border-slate-200/90 dark:border-theme-border bg-white dark:bg-theme-surface hover:bg-slate-50 dark:hover:bg-theme-hover text-slate-700 dark:text-theme-text-muted'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold">BS Only (नेपाली)</span>
                {calendarPreference === 'bs' && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 stroke-[2.5]" />}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-theme-text-muted block leading-tight">
                Nepali Bikram Sambat calendar
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCalendarPreference('ad')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[64px] ${
                calendarPreference === 'ad'
                  ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-950/30 text-slate-900 dark:text-theme-text ring-1 ring-purple-500/30'
                  : 'border-slate-200/90 dark:border-theme-border bg-white dark:bg-theme-surface hover:bg-slate-50 dark:hover:bg-theme-hover text-slate-700 dark:text-theme-text-muted'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold">AD Only</span>
                {calendarPreference === 'ad' && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 stroke-[2.5]" />}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-theme-text-muted block leading-tight">
                Gregorian international calendar
              </span>
            </button>
          </div>
        </div>

        {/* Numeral System Selector */}
        <div className="space-y-2 pt-1">
          <span className="text-xs font-semibold text-slate-900 dark:text-theme-text block">
            Bikram Sambat Numeral System
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
              <div>
                <span className="text-xs font-bold block">English Digits</span>
                <span className="text-[10px] text-slate-500 dark:text-theme-text-muted">1, 2, 3, 2083</span>
              </div>
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
              <div>
                <span className="text-xs font-bold block">Nepali Numerals (नेपाली अंक)</span>
                <span className="text-[10px] text-slate-500 dark:text-theme-text-muted">१, २, ३, २०८३</span>
              </div>
              {numeralPreference === 'ne' && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 stroke-[2.5]" />}
            </button>
          </div>
        </div>

        {/* Live Today Preview */}
        {todayInfo && (
          <div className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
            <div>
              <span className="text-slate-500 dark:text-theme-text-muted text-[10px] uppercase font-bold block">
                Live Preview (Today):
              </span>
              <span className="font-semibold text-purple-700 dark:text-purple-300 text-xs">
                {calendarPreference === 'dual'
                  ? todayInfo.formattedDual
                  : calendarPreference === 'bs'
                  ? todayInfo.formattedBs
                  : todayInfo.formattedAd}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-theme-text-muted font-mono">
              Coverage: 1975 – 2099 BS (Offline)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
