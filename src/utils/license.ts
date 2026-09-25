export type LicenseStatus = 'active' | 'expired' | 'no_expiry';

export interface LicenseStatusInfo {
  status: LicenseStatus;
  label: string;
  badgeClass: string;
  dotClass: string;
}

/**
 * Evaluates license expiration status:
 * 
 * 1. Calendar Date (YYYY-MM-DD):
 *    - Evaluated in the user's LOCAL calendar timezone.
 *    - Remains Active through 23:59:59.999 local time on that date.
 *    - Prevents false expiration when local time has not yet reached midnight,
 *      regardless of UTC date/time offsets.
 * 
 * 2. True Timestamp (ISO 8601 with time/offset or timezone):
 *    - Preserves the exact instant in time (epoch timestamp).
 *    - Active if current instant <= timestamp instant; Expired if current instant > timestamp instant.
 * 
 * 3. Empty / Unspecified / Invalid:
 *    - Evaluates to 'no_expiry' (e.g. perpetual licenses).
 * 
 * @param expiresAt Expiration string (e.g. "2026-09-25", "2026-09-25T18:00:00Z")
 * @param nowMs Optional reference timestamp in ms (defaults to Date.now())
 */
export function getLicenseStatus(
  expiresAt?: string | null,
  nowMs: number = Date.now()
): LicenseStatus {
  if (!expiresAt || !expiresAt.trim()) {
    return 'no_expiry';
  }

  const trimmed = expiresAt.trim();

  // 1. Pure calendar date: YYYY-MM-DD
  const calendarDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (calendarDateMatch) {
    const year = parseInt(calendarDateMatch[1], 10);
    const month = parseInt(calendarDateMatch[2], 10) - 1; // 0-indexed in JS Date
    const day = parseInt(calendarDateMatch[3], 10);

    // Validate date components (e.g. reject Feb 30)
    const localEndOfDay = new Date(year, month, day, 23, 59, 59, 999);
    if (
      localEndOfDay.getFullYear() !== year ||
      localEndOfDay.getMonth() !== month ||
      localEndOfDay.getDate() !== day
    ) {
      return 'no_expiry';
    }

    return nowMs > localEndOfDay.getTime() ? 'expired' : 'active';
  }

  // 2. Timestamp with time / timezone / offset
  const parsed = new Date(trimmed);
  const time = parsed.getTime();
  if (isNaN(time)) {
    return 'no_expiry';
  }

  // Check if string contains an explicit time component (e.g., T12:00:00, 14:30, etc.)
  const hasTimeComponent = /[\sT]\d{1,2}:\d{2}/.test(trimmed);

  if (hasTimeComponent) {
    // Preserve the exact instant in time
    return nowMs > time ? 'expired' : 'active';
  }

  // Non-ISO calendar date format (e.g. "2026/09/25" or "September 25, 2026")
  // Evaluated as local calendar date through 23:59:59.999
  const localEndOfDay = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    23,
    59,
    59,
    999
  );
  return nowMs > localEndOfDay.getTime() ? 'expired' : 'active';
}

/**
 * Returns UI metadata for rendering status badges and indicators.
 */
export function getLicenseStatusInfo(
  expiresAt?: string | null,
  nowMs: number = Date.now()
): LicenseStatusInfo {
  const status = getLicenseStatus(expiresAt, nowMs);

  switch (status) {
    case 'active':
      return {
        status: 'active',
        label: 'Active',
        badgeClass:
          'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40',
        dotClass: 'bg-emerald-500',
      };
    case 'expired':
      return {
        status: 'expired',
        label: 'Expired',
        badgeClass:
          'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40',
        dotClass: 'bg-rose-500',
      };
    case 'no_expiry':
    default:
      return {
        status: 'no_expiry',
        label: 'No Expiry',
        badgeClass:
          'bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-800/50',
        dotClass: 'bg-slate-400',
      };
  }
}
