import { START_BS_YEAR, END_BS_YEAR, BS_MONTH_DAYS } from "./dataset";

export interface NepaliDate {
  year: number;
  month: number; // 1 to 12
  day: number; // 1 to 32
  weekday: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
}

export interface GregorianDate {
  year: number;
  month: number; // 1 to 12
  day: number; // 1 to 31
  weekday: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
}

export interface DualDateInfo {
  ad: GregorianDate;
  bs: NepaliDate;
  canonicalAdStr: string; // YYYY-MM-DD
  canonicalBsStr: string; // YYYY-MM-DD
  formattedAd: string;
  formattedBs: string;
  formattedDual: string;
}

export type CalendarMode = "ad" | "bs" | "dual";
export type NumeralSystem = "en" | "ne";

export const BS_MONTH_NAMES_EN = [
  "Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
] as const;

export const BS_MONTH_NAMES_SHORT_EN = [
  "Bai", "Jes", "Asar", "Shra", "Bhad", "Asoj",
  "Kar", "Mang", "Pou", "Magh", "Fal", "Chai"
] as const;

export const BS_MONTH_NAMES_NE = [
  "बैशाख", "जेठ", "असार", "श्रावण", "भाद्र", "असोज",
  "कार्तिक", "मंसिर", "पौष", "माघ", "फाल्गुण", "चैत्र"
] as const;

export const AD_MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
] as const;

export const AD_MONTH_NAMES_SHORT_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
] as const;

export const WEEKDAY_NAMES_EN = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
] as const;

export const WEEKDAY_NAMES_SHORT_EN = [
  "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"
] as const;

export const WEEKDAY_NAMES_NE = [
  "आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहिबार", "शुक्रबार", "शनिबार"
] as const;

export const WEEKDAY_NAMES_SHORT_NE = [
  "आइत", "सोम", "मंगल", "बुध", "बिहि", "शुक्र", "शनि"
] as const;

const NEPALI_NUMERALS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"] as const;

export function toNepaliNumerals(input: string | number): string {
  const str = input.toString();
  return str.replace(/[0-9]/g, (digit) => NEPALI_NUMERALS[parseInt(digit, 10)] || digit);
}

export function toEnglishDigits(input: string): string {
  return input.replace(/[०-९]/g, (char) => {
    const idx = NEPALI_NUMERALS.indexOf(char as any);
    return idx !== -1 ? idx.toString() : char;
  });
}

/**
 * Epoch AD start date: April 13, 1918 (corresponds to Baishakh 1, 1975 BS).
 */
const EPOCH_AD_TIME = Date.UTC(1918, 3, 13);
const MS_PER_DAY = 86400000;

export function getBsMonthDays(year: number, month: number): number {
  if (year < START_BS_YEAR || year > END_BS_YEAR) {
    throw new Error(`BS year ${year} is outside supported range (${START_BS_YEAR}-${END_BS_YEAR})`);
  }
  if (month < 1 || month > 12) {
    throw new Error(`BS month must be between 1 and 12 (got ${month})`);
  }
  return BS_MONTH_DAYS[year - START_BS_YEAR][month - 1];
}

export function isValidBsDate(year: number, month: number, day: number): boolean {
  try {
    const maxDays = getBsMonthDays(year, month);
    return day >= 1 && day <= maxDays;
  } catch {
    return false;
  }
}

export function isValidAdDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/**
 * Converts Bikram Sambat (BS) date to Gregorian (AD).
 */
export function bsToAd(year: number, month: number, day: number): GregorianDate {
  if (!isValidBsDate(year, month, day)) {
    throw new Error(`Invalid BS date: ${year}-${month}-${day}`);
  }

  let totalDays = 0;
  for (let y = START_BS_YEAR; y < year; y++) {
    const yIdx = y - START_BS_YEAR;
    for (let m = 0; m < 12; m++) {
      totalDays += BS_MONTH_DAYS[yIdx][m];
    }
  }

  const currYearIdx = year - START_BS_YEAR;
  for (let m = 1; m < month; m++) {
    totalDays += BS_MONTH_DAYS[currYearIdx][m - 1];
  }

  totalDays += (day - 1);

  const adDate = new Date(EPOCH_AD_TIME + totalDays * MS_PER_DAY);
  return {
    year: adDate.getUTCFullYear(),
    month: adDate.getUTCMonth() + 1,
    day: adDate.getUTCDate(),
    weekday: adDate.getUTCDay()
  };
}

/**
 * Converts Gregorian (AD) date to Bikram Sambat (BS).
 */
export function adToBs(year: number, month: number, day: number): NepaliDate {
  if (!isValidAdDate(year, month, day)) {
    throw new Error(`Invalid AD date: ${year}-${month}-${day}`);
  }

  const targetTime = Date.UTC(year, month - 1, day);
  let remainingDays = Math.round((targetTime - EPOCH_AD_TIME) / MS_PER_DAY);

  if (remainingDays < 0) {
    throw new Error(`Date ${year}-${month}-${day} precedes supported BS epoch (1975-01-01 BS / 1918-04-13 AD)`);
  }

  let bsYear = START_BS_YEAR;
  while (bsYear <= END_BS_YEAR) {
    const yIdx = bsYear - START_BS_YEAR;
    let yearDays = 0;
    for (let m = 0; m < 12; m++) {
      yearDays += BS_MONTH_DAYS[yIdx][m];
    }
    if (remainingDays < yearDays) {
      break;
    }
    remainingDays -= yearDays;
    bsYear++;
  }

  if (bsYear > END_BS_YEAR) {
    throw new Error(`Date exceeds maximum supported BS year (${END_BS_YEAR})`);
  }

  const yIdx = bsYear - START_BS_YEAR;
  let bsMonth = 1;
  while (bsMonth <= 12) {
    const mDays = BS_MONTH_DAYS[yIdx][bsMonth - 1];
    if (remainingDays < mDays) {
      break;
    }
    remainingDays -= mDays;
    bsMonth++;
  }

  const bsDay = remainingDays + 1;
  const weekday = new Date(targetTime).getUTCDay();

  return {
    year: bsYear,
    month: bsMonth,
    day: bsDay,
    weekday
  };
}

export function parseDateString(str: string): { year: number; month: number; day: number } | null {
  if (!str) return null;
  const clean = toEnglishDigits(str.trim());
  const match = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  return { year, month, day };
}

export function adStrToBs(adStr: string): NepaliDate | null {
  const parsed = parseDateString(adStr);
  if (!parsed) return null;
  try {
    return adToBs(parsed.year, parsed.month, parsed.day);
  } catch {
    return null;
  }
}

export function bsStrToAd(bsStr: string): GregorianDate | null {
  const parsed = parseDateString(bsStr);
  if (!parsed) return null;
  try {
    return bsToAd(parsed.year, parsed.month, parsed.day);
  } catch {
    return null;
  }
}

export function formatAdDate(ad: GregorianDate, short = false): string {
  const mName = short ? AD_MONTH_NAMES_SHORT_EN[ad.month - 1] : AD_MONTH_NAMES_EN[ad.month - 1];
  const dStr = ad.day.toString().padStart(2, "0");
  return short ? `${mName} ${ad.day}, ${ad.year}` : `${dStr} ${mName} ${ad.year}`;
}

export function formatBsDate(bs: NepaliDate, inNepali = false, short = true): string {
  if (inNepali) {
    const mName = BS_MONTH_NAMES_NE[bs.month - 1];
    const dStr = toNepaliNumerals(bs.day);
    const yStr = toNepaliNumerals(bs.year);
    return `${dStr} ${mName} ${yStr}`;
  } else {
    const mName = short ? BS_MONTH_NAMES_SHORT_EN[bs.month - 1] : BS_MONTH_NAMES_EN[bs.month - 1];
    const dStr = bs.day.toString().padStart(2, "0");
    return `${dStr} ${mName} ${bs.year}`;
  }
}

/**
 * Returns complete dual date metadata from a canonical AD string YYYY-MM-DD.
 */
export function getDualDateInfo(adStr: string, inNepali = false): DualDateInfo | null {
  const parsed = parseDateString(adStr);
  if (!parsed) return null;
  try {
    const bs = adToBs(parsed.year, parsed.month, parsed.day);
    const ad: GregorianDate = {
      year: parsed.year,
      month: parsed.month,
      day: parsed.day,
      weekday: bs.weekday
    };

    const canonicalAdStr = `${ad.year}-${ad.month.toString().padStart(2, "0")}-${ad.day.toString().padStart(2, "0")}`;
    const canonicalBsStr = `${bs.year}-${bs.month.toString().padStart(2, "0")}-${bs.day.toString().padStart(2, "0")}`;

    const formattedAd = formatAdDate(ad);
    const formattedBs = formatBsDate(bs, inNepali);
    const formattedDual = inNepali
      ? `${formattedAd} / ${formattedBs}`
      : `${formattedAd} • ${formattedBs}`;

    return {
      ad,
      bs,
      canonicalAdStr,
      canonicalBsStr,
      formattedAd,
      formattedBs,
      formattedDual
    };
  } catch {
    return null;
  }
}

/**
 * Returns today\x27s date in both AD and BS.
 */
export function getTodayDual(inNepali = false): DualDateInfo {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const adStr = `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
  const info = getDualDateInfo(adStr, inNepali);
  if (!info) {
    throw new Error("Failed to compute today dual date");
  }
  return info;
}

/**
 * Persisted user calendar mode preference.
 */
export function getStoredCalendarPreference(): CalendarMode {
  if (typeof window === "undefined") return "dual";
  const stored = localStorage.getItem("totumvault_calendar_preference");
  if (stored === "ad" || stored === "bs" || stored === "dual") {
    return stored;
  }
  return "dual"; // Default is dual mode
}

export function setStoredCalendarPreference(pref: CalendarMode): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("totumvault_calendar_preference", pref);
  }
}

export function getStoredNumeralPreference(): NumeralSystem {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem("totumvault_calendar_numeral");
  if (stored === "ne") return "ne";
  return "en";
}

export function setStoredNumeralPreference(num: NumeralSystem): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("totumvault_calendar_numeral", num);
  }
}

/**
 * Formats a canonical AD date (YYYY-MM-DD) according to the specified calendar mode and numeral system.
 */
export function formatDisplayDate(
  adStr: string | null | undefined,
  mode: CalendarMode = "dual",
  numeral: NumeralSystem = "en"
): string {
  if (!adStr) return "";
  const info = getDualDateInfo(adStr, numeral === "ne");
  if (!info) return adStr;
  if (mode === "ad") return info.formattedAd;
  if (mode === "bs") return info.formattedBs;
  return info.formattedDual;
}
