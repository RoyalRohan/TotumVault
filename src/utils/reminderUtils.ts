/**
 * Local calendar countdown and reminder badge utilities for TotumVault
 */

export interface ReminderCountdownInfo {
  status: 'none' | 'upcoming' | 'due' | 'urgent' | 'today' | 'expired';
  daysRemaining: number | null;
  label: string;
  badgeClass: string;
}

export function calculateDaysRemaining(expiryDateStr?: string | null): number | null {
  if (!expiryDateStr || !expiryDateStr.trim()) return null;

  const parts = expiryDateStr.trim().split('-');
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const expiry = new Date(year, month, day, 0, 0, 0, 0);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

export function getReminderCountdownInfo(
  expiryDateStr?: string | null,
  reminderEnabled = true
): ReminderCountdownInfo {
  const days = calculateDaysRemaining(expiryDateStr);

  if (days === null || !reminderEnabled) {
    return {
      status: 'none',
      daysRemaining: days,
      label: '',
      badgeClass: '',
    };
  }

  if (days < 0) {
    return {
      status: 'expired',
      daysRemaining: days,
      label: 'Expired',
      badgeClass: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    };
  }

  if (days === 0) {
    return {
      status: 'today',
      daysRemaining: 0,
      label: 'Expires today',
      badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold animate-pulse',
    };
  }

  if (days === 1) {
    return {
      status: 'urgent',
      daysRemaining: 1,
      label: 'Expires tomorrow',
      badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium',
    };
  }

  if (days <= 5) {
    return {
      status: 'due',
      daysRemaining: days,
      label: `Expires in ${days} days`,
      badgeClass: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 font-medium',
    };
  }

  return {
    status: 'upcoming',
    daysRemaining: days,
    label: `Expires in ${days} days`,
    badgeClass: 'bg-zinc-500/10 text-zinc-400 border border-zinc-700/40',
  };
}
