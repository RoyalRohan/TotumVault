import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  Key,
  Edit3,
  CheckCircle2,
  RefreshCw,
  ChevronLeft,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { isWeakPassword, calculateEntropy } from '../utils/cryptoUtils';

export const SecurityHealthDashboard: React.FC = () => {
  const { entries, healthReport, fetchHealthReport, openEditor, setActiveCategory } = useVault();
  const [activeTab, setActiveTab] = useState<'all' | 'weak' | 'reused' | 'totp'>('all');

  useEffect(() => {
    fetchHealthReport();
  }, [entries, fetchHealthReport]);

  if (!healthReport) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mb-2" />
        <p className="text-xs font-semibold">Auditing local vault health...</p>
      </div>
    );
  }

  const weakEntries = entries.filter((e) => {
    const isLogin = e.category === 'logins' || !e.category;
    if (isLogin) {
      return !e.password || isWeakPassword(e.password);
    }
    return Boolean(e.password && isWeakPassword(e.password));
  });

  // Group passwords to find local duplicates
  const passCounts = new Map<string, number>();
  entries.forEach((e) => {
    if (e.password) {
      passCounts.set(e.password, (passCounts.get(e.password) || 0) + 1);
    }
  });
  const reusedEntries = entries.filter((e) => e.password && (passCounts.get(e.password) || 0) > 1);

  const missingTotpEntries = entries.filter((e) => {
    const isLogin = e.category === 'logins' || !e.category;
    return isLogin && !e.totp_secret;
  });

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6 select-none bg-theme-bg pb-safe text-theme-text">
      {/* Dashboard Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {/* Mobile Back Button */}
          <button
            onClick={() => setActiveCategory('all')}
            className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-bg border border-theme-border text-theme-text transition-colors cursor-pointer shrink-0 shadow-sm"
            title="Back to vault items"
          >
            <ChevronLeft className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold">Back</span>
          </button>

          <div>
            <h2 className="text-base sm:text-lg font-bold text-theme-text flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0" />
              <span>Vault Security Dashboard</span>
            </h2>
            <p className="text-xs text-theme-text-muted mt-0.5">
              Audit password strength, reuse, and two-factor authentication coverage
            </p>
          </div>
        </div>

        <button
          onClick={fetchHealthReport}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-theme-surface hover:bg-theme-bg border border-theme-border text-xs font-medium text-theme-text transition-colors cursor-pointer ml-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Re-audit</span>
        </button>
      </div>

      {/* Main Score & Metrics Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Score Ring Card */}
        <div className="bg-theme-surface border border-theme-border p-5 sm:p-6 rounded-2xl flex flex-col items-center justify-center text-center col-span-1 shadow-sm">
          <div className="relative w-20 h-20 flex items-center justify-center mb-3">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-200 dark:text-[#21262d]"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={`${
                  healthReport.total_score >= 80
                    ? 'text-emerald-500'
                    : healthReport.total_score >= 50
                    ? 'text-amber-500'
                    : 'text-rose-500'
                } transition-all duration-1000 ease-out`}
                strokeDasharray={`${healthReport.total_score}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-xl font-bold font-mono text-theme-text">
              {healthReport.total_score}
            </span>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-theme-text">
            {healthReport.total_score >= 80 ? 'Vault Healthy' : healthReport.total_score >= 50 ? 'Attention Needed' : 'Vulnerable Vault'}
          </span>
        </div>

        {/* Metrics Grid */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-theme-surface border border-theme-border p-4 sm:p-5 rounded-2xl flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-theme-text-muted">Weak Passwords</span>
              <AlertTriangle className="w-4.5 h-4.5 text-rose-500" />
            </div>
            <div className="mt-3 sm:mt-4">
              <span className="text-2xl font-bold font-mono text-theme-text">{healthReport.weak_passwords}</span>
              <span className="text-xs text-rose-500 dark:text-rose-400 block mt-1 font-medium">Low complexity</span>
            </div>
          </div>

          <div className="bg-theme-surface border border-theme-border p-4 sm:p-5 rounded-2xl flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-theme-text-muted">Reused Passwords</span>
              <Key className="w-4.5 h-4.5 text-amber-500" />
            </div>
            <div className="mt-3 sm:mt-4">
              <span className="text-2xl font-bold font-mono text-theme-text">{healthReport.reused_passwords}</span>
              <span className="text-xs text-amber-600 dark:text-amber-400 block mt-1 font-medium">Reused on multiple sites</span>
            </div>
          </div>

          <div className="bg-theme-surface border border-theme-border p-4 sm:p-5 rounded-2xl flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-theme-text-muted">Missing 2FA</span>
              <Clock className="w-4.5 h-4.5 text-teal-500" />
            </div>
            <div className="mt-3 sm:mt-4">
              <span className="text-2xl font-bold font-mono text-theme-text">{healthReport.missing_totp}</span>
              <span className="text-xs text-theme-text-muted block mt-1">Without TOTP keys</span>
            </div>
          </div>
        </div>
      </div>

      {/* Flagged Vulnerabilities with Category Tabs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">
            Flagged Vault Vulnerabilities
          </h3>

          {/* Interactive Filter Tabs */}
          <div className="flex items-center bg-theme-surface p-1.5 rounded-xl border border-theme-border text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-theme-text-muted hover:text-theme-text'
              }`}
            >
              <span>All</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                activeTab === 'all' ? 'bg-purple-700 text-white' : 'bg-theme-bg text-theme-text-muted'
              }`}>
                {weakEntries.length + reusedEntries.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('weak')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'weak'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-theme-text-muted hover:text-rose-500'
              }`}
            >
              <span>Weak</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                activeTab === 'weak' ? 'bg-rose-600 text-white' : 'bg-theme-bg text-theme-text-muted'
              }`}>
                {weakEntries.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('reused')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'reused'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-theme-text-muted hover:text-amber-500'
              }`}
            >
              <span>Reused</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                activeTab === 'reused' ? 'bg-amber-600 text-white' : 'bg-theme-bg text-theme-text-muted'
              }`}>
                {reusedEntries.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('totp')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'totp'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-theme-text-muted hover:text-theme-text'
              }`}
            >
              <span>Missing 2FA</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                activeTab === 'totp' ? 'bg-purple-700 text-white' : 'bg-theme-bg text-theme-text-muted'
              }`}>
                {missingTotpEntries.length}
              </span>
            </button>
          </div>
        </div>

        {/* Tab Content Display */}
        {activeTab === 'all' && weakEntries.length === 0 && reusedEntries.length === 0 && (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-600 dark:text-emerald-300 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>No weak or reused passwords detected! Your credentials meet high strength standards.</span>
          </div>
        )}

        {activeTab === 'weak' && weakEntries.length === 0 && (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-600 dark:text-emerald-300 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>All vault passwords meet complexity and entropy standards.</span>
          </div>
        )}

        {activeTab === 'reused' && reusedEntries.length === 0 && (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-600 dark:text-emerald-300 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>No duplicated passwords found across your stored accounts.</span>
          </div>
        )}

        {activeTab === 'totp' && missingTotpEntries.length === 0 && (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-600 dark:text-emerald-300 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>All login credentials have two-factor authenticator keys configured.</span>
          </div>
        )}

        <div className="space-y-2.5">
          {(activeTab === 'all' || activeTab === 'weak') &&
            weakEntries.map((item) => {
              const entropy = calculateEntropy(item.password || '');
              return (
                <div
                  key={'weak-' + item.id}
                  className="p-4 rounded-xl bg-theme-surface border border-theme-border flex items-center justify-between shadow-sm animate-scale-up"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
                    <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 shrink-0">
                      <AlertTriangle className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-theme-text truncate">{item.title}</h4>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-rose-500 font-medium">Weak Password</span>
                        <span className="text-xs font-mono text-theme-text-muted">
                          {entropy.bits} bits • Crack time: {entropy.crackTimeDisplay}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => openEditor(item)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-theme-bg hover:bg-theme-surface text-xs font-semibold text-theme-text border border-theme-border transition-colors cursor-pointer shrink-0"
                  >
                    <Edit3 className="w-4 h-4 text-purple-400" />
                    <span>Fix</span>
                  </button>
                </div>
              );
            })}

          {(activeTab === 'all' || activeTab === 'reused') &&
            reusedEntries.map((item) => {
              const timesReused = passCounts.get(item.password) || 2;
              return (
                <div
                  key={'reused-' + item.id}
                  className="p-4 rounded-xl bg-theme-surface border border-theme-border flex items-center justify-between shadow-sm animate-scale-up"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                      <Key className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-theme-text truncate">{item.title}</h4>
                      <span className="text-xs text-amber-600 dark:text-amber-400 block mt-0.5 font-medium">
                        Reused Password (Shared across {timesReused} accounts)
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => openEditor(item)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-theme-bg hover:bg-theme-surface text-xs font-semibold text-theme-text border border-theme-border transition-colors cursor-pointer shrink-0"
                  >
                    <Edit3 className="w-4 h-4 text-amber-500" />
                    <span>Fix</span>
                  </button>
                </div>
              );
            })}

          {activeTab === 'totp' &&
            missingTotpEntries.map((item) => (
              <div
                key={'totp-' + item.id}
                className="p-4 rounded-xl bg-theme-surface border border-theme-border flex items-center justify-between shadow-sm animate-scale-up"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
                  <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shrink-0">
                    <Clock className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-theme-text truncate">{item.title}</h4>
                    <span className="text-xs text-teal-600 dark:text-teal-400 block mt-0.5 font-medium">
                      Missing 2FA Authenticator TOTP Key
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => openEditor(item)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-theme-bg hover:bg-theme-surface text-xs font-semibold text-theme-text border border-theme-border transition-colors cursor-pointer shrink-0"
                >
                  <Edit3 className="w-4 h-4 text-teal-500" />
                  <span>Add 2FA</span>
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
