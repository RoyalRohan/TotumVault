import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Clock, Copy, Check } from 'lucide-react';
import { TotpResult } from '../types';

interface TotpViewerProps {
  secret: string;
  digits?: number;
  period?: number;
  onCopy: (text: string, label: string) => void;
}

export const TotpViewer: React.FC<TotpViewerProps> = ({ secret, digits, period, onCopy }) => {
  const [totp, setTotp] = useState<TotpResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const stepPeriod = period || 30;

  useEffect(() => {
    let mounted = true;

    const fetchCode = async () => {
      if (!secret) return;
      try {
        const res = await invoke<TotpResult>('generate_totp_code', {
          secret,
          digits: digits || null,
          period: period || null,
        });
        if (mounted) {
          setTotp(res);
          setError(false);
        }
      } catch {
        if (mounted) setError(true);
      }
    };

    fetchCode();
    const interval = setInterval(fetchCode, 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [secret, digits, period]);

  if (error || !secret) {
    return (
      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-400 font-medium">
        Invalid or corrupt TOTP secret format.
      </div>
    );
  }

  if (!totp) {
    return (
      <div className="p-4 rounded-xl bg-theme-surface border border-theme-border flex items-center gap-2.5 text-xs text-theme-text-muted">
        <Clock className="w-4 h-4 animate-spin text-teal-600 dark:text-teal-400" />
        <span>Calculating TOTP code...</span>
      </div>
    );
  }

  const handleCopyCode = () => {
    onCopy(totp.code, 'TOTP 2FA Code');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progressPercent = (totp.time_remaining / stepPeriod) * 100;

  const splitCode = (code: string) => {
    if (code.length === 8) {
      return `${code.slice(0, 4)} ${code.slice(4)}`;
    }
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  };

  return (
    <div className="p-4 rounded-2xl bg-theme-surface border border-theme-border shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Countdown Ring */}
        <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-theme-border"
              strokeWidth="3"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-teal-600 dark:text-teal-400 transition-all duration-1000 ease-linear"
              strokeDasharray={`${progressPercent}, 100`}
              strokeWidth="3"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="absolute text-[9px] font-mono font-bold text-teal-700 dark:text-teal-300">
            {totp.time_remaining}s
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted block mb-0.5">
            2FA Code
          </span>
          <span className="text-lg font-mono font-bold tracking-widest text-theme-text">
            {splitCode(totp.code)}
          </span>
        </div>
      </div>

      <button
        onClick={handleCopyCode}
        className="p-2 rounded-xl bg-theme-elevated hover:bg-theme-hover text-theme-text border border-theme-border transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-theme-text-muted" />}
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  );
};
