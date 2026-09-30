import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Clock,
} from "lucide-react";
import {
  adToBs,
  bsToAd,
  getBsMonthDays,
  getDualDateInfo,
  toNepaliNumerals,
  BS_MONTH_NAMES_EN,
  BS_MONTH_NAMES_SHORT_EN,
  BS_MONTH_NAMES_NE,
  AD_MONTH_NAMES_EN,
  AD_MONTH_NAMES_SHORT_EN,
  WEEKDAY_NAMES_SHORT_EN,
  WEEKDAY_NAMES_SHORT_NE,
  START_BS_YEAR,
  END_BS_YEAR,
  getStoredCalendarPreference,
  getStoredNumeralPreference,
  NumeralSystem,
} from "../../utils/nepaliCalendar";

export interface DualDatePickerProps {
  value?: string; // Canonical AD date YYYY-MM-DD or empty
  onChange: (canonicalAdDateStr: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showDualBadge?: boolean;
  align?: "left" | "right";
}

export interface PopoverPosition {
  isMobile: boolean;
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight?: number;
}

/**
 * Calculates collision-aware position for popover or decides mobile sheet presentation.
 */
export function calculatePopoverPosition(
  triggerRect: { top: number; bottom: number; left: number; right: number },
  windowWidth: number,
  windowHeight: number,
  align: "left" | "right" = "left"
): PopoverPosition {
  // Mobile / compact sheet breakpoint:
  // Narrow phones (< 640px) or short-height viewports (< 520px)
  if (windowWidth < 640 || windowHeight < 520) {
    return {
      isMobile: true,
      left: 0,
      width: 0,
    };
  }

  const viewportMargin = 12;
  const gap = 6;
  const calendarWidth = Math.min(380, windowWidth - viewportMargin * 2);
  const estimatedHeight = 470;

  // Horizontal clamping
  let idealLeft = triggerRect.left;
  if (align === "right") {
    idealLeft = triggerRect.right - calendarWidth;
  }
  const maxLeft = windowWidth - calendarWidth - viewportMargin;
  const left = Math.max(viewportMargin, Math.min(idealLeft, maxLeft));

  // Vertical placement with flip and height clamping
  const spaceBelow = windowHeight - triggerRect.bottom - gap;
  const spaceAbove = triggerRect.top - gap;

  let top: number | undefined;
  let bottom: number | undefined;
  let maxHeight: number | undefined;

  if (spaceBelow >= estimatedHeight || spaceBelow >= spaceAbove) {
    top = triggerRect.bottom + gap;
    maxHeight = Math.min(estimatedHeight, windowHeight - top - viewportMargin);
  } else {
    bottom = windowHeight - triggerRect.top + gap;
    maxHeight = Math.min(estimatedHeight, triggerRect.top - gap - viewportMargin);
  }

  return {
    isMobile: false,
    top,
    bottom,
    left,
    width: calendarWidth,
    maxHeight,
  };
}

export const DualDatePicker: React.FC<DualDatePickerProps> = ({
  value = "",
  onChange,
  label,
  placeholder = "Select date (AD / BS)",
  disabled = false,
  className = "",
  showDualBadge = true,
  align = "left",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<PopoverPosition | null>(null);

  // Preference for initial tab: BS if stored is "bs", else AD
  const defaultTab: "ad" | "bs" = useMemo(() => {
    const pref = getStoredCalendarPreference();
    return pref === "bs" ? "bs" : "ad";
  }, []);

  const [activeTab, setActiveTab] = useState<"ad" | "bs">(defaultTab);
  const [numeralSystem] = useState<NumeralSystem>(getStoredNumeralPreference());

  // Current local date (strictly device calendar date, no timezone offset)
  const now = useMemo(() => new Date(), []);
  const todayAdYear = now.getFullYear();
  const todayAdMonth = now.getMonth() + 1;
  const todayAdDay = now.getDate();
  const todayBs = useMemo(() => {
    try {
      return adToBs(todayAdYear, todayAdMonth, todayAdDay);
    } catch {
      return { year: 2083, month: 6, day: 13, weekday: 2 };
    }
  }, [todayAdYear, todayAdMonth, todayAdDay]);

  // Selected date components
  const selectedInfo = useMemo(() => {
    if (!value || !value.trim()) return null;
    return getDualDateInfo(value.trim(), numeralSystem === "ne");
  }, [value, numeralSystem]);

  // Calendar browsing state (viewYear and viewMonth)
  const [adViewYear, setAdViewYear] = useState<number>(() => {
    if (selectedInfo) return selectedInfo.ad.year;
    return todayAdYear;
  });
  const [adViewMonth, setAdViewMonth] = useState<number>(() => {
    if (selectedInfo) return selectedInfo.ad.month;
    return todayAdMonth;
  });

  const [bsViewYear, setBsViewYear] = useState<number>(() => {
    if (selectedInfo) return selectedInfo.bs.year;
    return todayBs.year;
  });
  const [bsViewMonth, setBsViewMonth] = useState<number>(() => {
    if (selectedInfo) return selectedInfo.bs.month;
    return todayBs.month;
  });

  // Sync view state when selected date changes externally or modal reopens
  useEffect(() => {
    if (selectedInfo) {
      setAdViewYear(selectedInfo.ad.year);
      setAdViewMonth(selectedInfo.ad.month);
      setBsViewYear(selectedInfo.bs.year);
      setBsViewMonth(selectedInfo.bs.month);
    }
  }, [value, selectedInfo]);

  // Recalculate position
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const pos = calculatePopoverPosition(
      rect,
      window.innerWidth,
      window.innerHeight,
      align
    );
    setCoords(pos);
  }, [align]);

  const handleOpen = () => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Manage repositioning and keyboard dismiss
  useLayoutEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    const handleReposition = () => {
      updatePosition();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("orientationchange", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("orientationchange", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, updatePosition]);

  // Handle switching tabs: synchronize viewing month/year to same period
  const handleTabSwitch = (newTab: "ad" | "bs") => {
    setActiveTab(newTab);
    if (newTab === "bs") {
      try {
        const converted = adToBs(adViewYear, adViewMonth, 15);
        setBsViewYear(converted.year);
        setBsViewMonth(converted.month);
      } catch {
        // keep existing
      }
    } else {
      try {
        const converted = bsToAd(bsViewYear, bsViewMonth, 15);
        setAdViewYear(converted.year);
        setAdViewMonth(converted.month);
      } catch {
        // keep existing
      }
    }
  };

  // AD Navigation
  const prevAdMonth = () => {
    if (adViewMonth === 1) {
      setAdViewYear((y) => y - 1);
      setAdViewMonth(12);
    } else {
      setAdViewMonth((m) => m - 1);
    }
  };

  const nextAdMonth = () => {
    if (adViewMonth === 12) {
      setAdViewYear((y) => y + 1);
      setAdViewMonth(1);
    } else {
      setAdViewMonth((m) => m + 1);
    }
  };

  // BS Navigation
  const prevBsMonth = () => {
    if (bsViewMonth === 1) {
      if (bsViewYear > START_BS_YEAR) {
        setBsViewYear((y) => y - 1);
        setBsViewMonth(12);
      }
    } else {
      setBsViewMonth((m) => m - 1);
    }
  };

  const nextBsMonth = () => {
    if (bsViewMonth === 12) {
      if (bsViewYear < END_BS_YEAR) {
        setBsViewYear((y) => y + 1);
        setBsViewMonth(1);
      }
    } else {
      setBsViewMonth((m) => m + 1);
    }
  };

  // Select AD date
  const handleSelectAdDate = (day: number) => {
    const formatted = `${adViewYear}-${adViewMonth.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    onChange(formatted);
  };

  // Select BS date
  const handleSelectBsDate = (day: number) => {
    try {
      const ad = bsToAd(bsViewYear, bsViewMonth, day);
      const formatted = `${ad.year}-${ad.month.toString().padStart(2, "0")}-${ad.day.toString().padStart(2, "0")}`;
      onChange(formatted);
    } catch (e) {
      console.error("Failed to convert selected BS date to AD:", e);
    }
  };

  // Select Today (local device date only)
  const handleSelectToday = () => {
    const formatted = `${todayAdYear}-${todayAdMonth.toString().padStart(2, "0")}-${todayAdDay.toString().padStart(2, "0")}`;
    onChange(formatted);
    setAdViewYear(todayAdYear);
    setAdViewMonth(todayAdMonth);
    setBsViewYear(todayBs.year);
    setBsViewMonth(todayBs.month);
  };

  // Clear date
  const handleClear = () => {
    onChange("");
  };

  // Grid calculations for AD
  const adDaysGrid = useMemo(() => {
    const firstDay = new Date(Date.UTC(adViewYear, adViewMonth - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(adViewYear, adViewMonth, 0)).getUTCDate();
    const prevDaysInMonth = new Date(Date.UTC(adViewYear, adViewMonth - 1, 0)).getUTCDate();

    const days: Array<{
      day: number;
      isCurrentMonth: boolean;
      subDay?: number;
      isSelected: boolean;
      isToday: boolean;
      ariaLabel: string;
    }> = [];

    // Prev month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: prevDaysInMonth - i,
        isCurrentMonth: false,
        isSelected: false,
        isToday: false,
        ariaLabel: "",
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      let bsSubDay: number | undefined;
      try {
        const bs = adToBs(adViewYear, adViewMonth, d);
        bsSubDay = bs.day;
      } catch {
        // ignore out of range
      }

      const isSelected = Boolean(
        selectedInfo &&
          selectedInfo.ad.year === adViewYear &&
          selectedInfo.ad.month === adViewMonth &&
          selectedInfo.ad.day === d
      );

      const isToday =
        todayAdYear === adViewYear &&
        todayAdMonth === adViewMonth &&
        todayAdDay === d;

      const monthName = AD_MONTH_NAMES_EN[adViewMonth - 1];
      const ariaLabel = `${d} ${monthName} ${adViewYear}${bsSubDay ? ` (${bsSubDay} BS)` : ""}`;

      days.push({
        day: d,
        isCurrentMonth: true,
        subDay: bsSubDay,
        isSelected,
        isToday,
        ariaLabel,
      });
    }

    // Next month padding to fill complete weeks
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        isSelected: false,
        isToday: false,
        ariaLabel: "",
      });
    }

    return days;
  }, [adViewYear, adViewMonth, selectedInfo, todayAdYear, todayAdMonth, todayAdDay]);

  // Grid calculations for BS (using dynamic previous-month BS length)
  const bsDaysGrid = useMemo(() => {
    let daysInMonth = 30;
    try {
      daysInMonth = getBsMonthDays(bsViewYear, bsViewMonth);
    } catch {
      daysInMonth = 30;
    }

    let firstDayWeekday = 0;
    try {
      const adFirst = bsToAd(bsViewYear, bsViewMonth, 1);
      firstDayWeekday = adFirst.weekday;
    } catch {
      firstDayWeekday = 0;
    }

    // Determine actual previous BS month length
    let prevBsMonth = bsViewMonth - 1;
    let prevBsYear = bsViewYear;
    if (prevBsMonth < 1) {
      prevBsMonth = 12;
      prevBsYear = bsViewYear - 1;
    }
    let prevBsMonthDays = 30;
    try {
      prevBsMonthDays = getBsMonthDays(prevBsYear, prevBsMonth);
    } catch {
      prevBsMonthDays = 30;
    }

    const days: Array<{
      day: number;
      isCurrentMonth: boolean;
      subDay?: number;
      isSelected: boolean;
      isToday: boolean;
      ariaLabel: string;
    }> = [];

    // Prev month padding using actual previous BS month days
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      days.push({
        day: prevBsMonthDays - i,
        isCurrentMonth: false,
        isSelected: false,
        isToday: false,
        ariaLabel: "",
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      let adSubDay: number | undefined;
      try {
        const ad = bsToAd(bsViewYear, bsViewMonth, d);
        adSubDay = ad.day;
      } catch {
        // ignore
      }

      const isSelected = Boolean(
        selectedInfo &&
          selectedInfo.bs.year === bsViewYear &&
          selectedInfo.bs.month === bsViewMonth &&
          selectedInfo.bs.day === d
      );

      const isToday =
        todayBs.year === bsViewYear &&
        todayBs.month === bsViewMonth &&
        todayBs.day === d;

      const bsMonthName = BS_MONTH_NAMES_EN[bsViewMonth - 1];
      const ariaLabel = `${d} ${bsMonthName} ${bsViewYear} BS${adSubDay ? ` (${adSubDay} AD)` : ""}`;

      days.push({
        day: d,
        isCurrentMonth: true,
        subDay: adSubDay,
        isSelected,
        isToday,
        ariaLabel,
      });
    }

    // Next month padding to fill complete weeks
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        isSelected: false,
        isToday: false,
        ariaLabel: "",
      });
    }

    return days;
  }, [bsViewYear, bsViewMonth, selectedInfo, todayBs]);

  // Subtitle equivalent range info
  const adEquivalentSubtitle = useMemo(() => {
    try {
      const adStart = bsToAd(bsViewYear, bsViewMonth, 1);
      const days = getBsMonthDays(bsViewYear, bsViewMonth);
      const adEnd = bsToAd(bsViewYear, bsViewMonth, days);
      const startM = AD_MONTH_NAMES_SHORT_EN[adStart.month - 1];
      const endM = AD_MONTH_NAMES_SHORT_EN[adEnd.month - 1];
      if (startM === endM) {
        return `AD: ${startM} ${adStart.year}`;
      }
      return `AD: ${startM} - ${endM} ${adEnd.year}`;
    } catch {
      return "";
    }
  }, [bsViewYear, bsViewMonth]);

  const bsEquivalentSubtitle = useMemo(() => {
    try {
      const bsStart = adToBs(adViewYear, adViewMonth, 1);
      const daysInMonth = new Date(Date.UTC(adViewYear, adViewMonth, 0)).getUTCDate();
      const bsEnd = adToBs(adViewYear, adViewMonth, daysInMonth);
      const startM = BS_MONTH_NAMES_SHORT_EN[bsStart.month - 1];
      const endM = BS_MONTH_NAMES_SHORT_EN[bsEnd.month - 1];
      if (startM === endM) {
        return `BS: ${startM} ${bsStart.year}`;
      }
      return `BS: ${startM} - ${endM} ${bsEnd.year}`;
    } catch {
      return "";
    }
  }, [adViewYear, adViewMonth]);

  // Shared Calendar Body Component
  const renderCalendarContent = () => (
    <div className="w-full flex flex-col select-none shrink-0">
      {/* 1. Header with Tab Switcher & Close button */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80 dark:border-theme-border shrink-0 gap-2">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-theme-bg/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-theme-border shrink-0">
          <button
            type="button"
            onClick={() => handleTabSwitch("ad")}
            style={{ minHeight: "40px" }}
            className={`min-h-[40px] sm:min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
              activeTab === "ad"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 dark:text-theme-text-muted hover:text-slate-900 dark:hover:text-theme-text"
            }`}
          >
            AD (Gregorian)
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch("bs")}
            style={{ minHeight: "40px" }}
            className={`min-h-[40px] sm:min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
              activeTab === "bs"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 dark:text-theme-text-muted hover:text-slate-900 dark:hover:text-theme-text"
            }`}
          >
            BS (नेपाली पात्रो)
          </button>
        </div>

        <button
          type="button"
          onClick={handleClose}
          style={{ minWidth: "40px", minHeight: "40px" }}
          className="w-10 h-10 sm:w-11 sm:h-11 min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-theme-text hover:bg-slate-100 dark:hover:bg-theme-hover transition-colors cursor-pointer shrink-0"
          title="Close calendar"
          aria-label="Close calendar"
        >
          <X className="w-4 h-4 stroke-[2]" />
        </button>
      </div>

      {/* 2. Month / Year Navigation */}
      <div className="py-1.5 shrink-0">
        <div className="flex items-center justify-between gap-1 w-full">
          <button
            type="button"
            onClick={activeTab === "ad" ? prevAdMonth : prevBsMonth}
            style={{ minWidth: "40px", minHeight: "40px", width: "40px", height: "40px" }}
            className="w-10 h-10 sm:w-11 sm:h-11 min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-theme-hover text-slate-600 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text transition-colors cursor-pointer shrink-0"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Flexible Month & Year Selectors (Guaranteed to not push buttons off-screen) */}
          <div className="flex items-center justify-center gap-1.5 min-w-0 flex-1 px-1">
            {activeTab === "ad" ? (
              <>
                <select
                  value={adViewMonth}
                  onChange={(e) => setAdViewMonth(parseInt(e.target.value, 10))}
                  style={{ minHeight: "40px" }}
                  className="min-w-0 max-w-[130px] min-h-[40px] sm:min-h-[44px] h-10 sm:h-11 bg-white dark:bg-theme-bg border border-slate-200 dark:border-theme-border rounded-xl px-2.5 py-1.5 font-semibold text-xs sm:text-sm cursor-pointer focus:outline-hidden focus:border-purple-500 text-slate-900 dark:text-theme-text truncate"
                  aria-label="Select month"
                >
                  {AD_MONTH_NAMES_EN.map((m, idx) => (
                    <option key={m} value={idx + 1} className="bg-white dark:bg-theme-surface text-slate-900 dark:text-theme-text">
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  value={adViewYear}
                  onChange={(e) => setAdViewYear(parseInt(e.target.value, 10))}
                  style={{ minHeight: "40px" }}
                  className="min-w-0 max-w-[84px] min-h-[40px] sm:min-h-[44px] h-10 sm:h-11 bg-white dark:bg-theme-bg border border-slate-200 dark:border-theme-border rounded-xl px-2 py-1.5 font-semibold text-xs sm:text-sm cursor-pointer focus:outline-hidden focus:border-purple-500 text-slate-900 dark:text-theme-text"
                  aria-label="Select year"
                >
                  {Array.from({ length: 2050 - 1920 + 1 }, (_, i) => 1920 + i).map((y) => (
                    <option key={y} value={y} className="bg-white dark:bg-theme-surface text-slate-900 dark:text-theme-text">
                      {y}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <select
                  value={bsViewMonth}
                  onChange={(e) => setBsViewMonth(parseInt(e.target.value, 10))}
                  style={{ minHeight: "40px" }}
                  className="min-w-0 max-w-[130px] min-h-[40px] sm:min-h-[44px] h-10 sm:h-11 bg-white dark:bg-theme-bg border border-slate-200 dark:border-theme-border rounded-xl px-2.5 py-1.5 font-semibold text-xs sm:text-sm cursor-pointer focus:outline-hidden focus:border-purple-500 text-slate-900 dark:text-theme-text truncate"
                  aria-label="Select month"
                >
                  {BS_MONTH_NAMES_EN.map((m, idx) => (
                    <option key={m} value={idx + 1} className="bg-white dark:bg-theme-surface text-slate-900 dark:text-theme-text">
                      {BS_MONTH_NAMES_SHORT_EN[idx]} ({BS_MONTH_NAMES_NE[idx]})
                    </option>
                  ))}
                </select>

                <select
                  value={bsViewYear}
                  onChange={(e) => setBsViewYear(parseInt(e.target.value, 10))}
                  style={{ minHeight: "40px" }}
                  className="min-w-0 max-w-[84px] min-h-[40px] sm:min-h-[44px] h-10 sm:h-11 bg-white dark:bg-theme-bg border border-slate-200 dark:border-theme-border rounded-xl px-2 py-1.5 font-semibold text-xs sm:text-sm cursor-pointer focus:outline-hidden focus:border-purple-500 text-slate-900 dark:text-theme-text"
                  aria-label="Select year"
                >
                  {Array.from(
                    { length: END_BS_YEAR - START_BS_YEAR + 1 },
                    (_, i) => START_BS_YEAR + i
                  ).map((y) => (
                    <option key={y} value={y} className="bg-white dark:bg-theme-surface text-slate-900 dark:text-theme-text">
                      {numeralSystem === "ne" ? toNepaliNumerals(y) : y}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={activeTab === "ad" ? nextAdMonth : nextBsMonth}
            style={{ minWidth: "40px", minHeight: "40px", width: "40px", height: "40px" }}
            className="w-10 h-10 sm:w-11 sm:h-11 min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-theme-hover text-slate-600 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text transition-colors cursor-pointer shrink-0"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        <div className="text-center text-[11px] font-medium text-purple-600 dark:text-purple-400 pt-1 shrink-0 truncate">
          {activeTab === "ad" ? bsEquivalentSubtitle : adEquivalentSubtitle}
        </div>
      </div>

      {/* 3. Weekday Names Header */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-theme-text-muted py-1 border-b border-slate-200/80 dark:border-theme-border shrink-0">
        {activeTab === "ad"
          ? WEEKDAY_NAMES_SHORT_EN.map((d) => <span key={d}>{d}</span>)
          : WEEKDAY_NAMES_SHORT_NE.map((d) => <span key={d}>{d}</span>)}
      </div>

      {/* 4. Calendar Day Grid (True responsive 7-column layout) */}
      <div
        className="grid grid-cols-7 gap-1 text-xs w-full py-1.5 shrink-0"
        style={{ gridAutoRows: "minmax(44px, auto)" }}
        role="grid"
        aria-label="Calendar days"
      >
        {(activeTab === "ad" ? adDaysGrid : bsDaysGrid).map((item, idx) => {
          if (!item.isCurrentMonth) {
            return (
              <div
                key={idx}
                style={{ minHeight: "44px", height: "44px" }}
                className="w-full min-h-[44px] h-11 sm:h-12 rounded-xl flex items-center justify-center text-slate-300 dark:text-zinc-600 text-xs select-none shrink-0"
                aria-hidden="true"
              >
                {item.day}
              </div>
            );
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => (activeTab === "ad" ? handleSelectAdDate(item.day) : handleSelectBsDate(item.day))}
              role="gridcell"
              aria-label={item.ariaLabel}
              aria-selected={item.isSelected}
              aria-current={item.isToday ? "date" : undefined}
              style={{ minHeight: "44px", height: "44px" }}
              className={`w-full min-h-[44px] h-11 sm:h-12 rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer select-none p-0.5 shrink-0 focus:outline-hidden focus:ring-2 focus:ring-purple-500/50 ${
                item.isSelected
                  ? "bg-purple-600 text-white font-bold shadow-md"
                  : item.isToday
                  ? "border-2 border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-500/20"
                  : "hover:bg-slate-100 dark:hover:bg-theme-hover text-slate-800 dark:text-theme-text font-medium"
              }`}
            >
              <span className="text-xs sm:text-sm leading-none">
                {activeTab === "bs" && numeralSystem === "ne" ? toNepaliNumerals(item.day) : item.day}
              </span>
              {item.subDay && (
                <span
                  className={`text-[9px] sm:text-[10px] leading-tight font-mono opacity-75 mt-0.5 ${
                    item.isSelected ? "text-purple-100" : "text-purple-600 dark:text-purple-400"
                  }`}
                >
                  {item.subDay}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 5. Bottom Info & Action Bar */}
      <div className="mt-1 pt-2 border-t border-slate-200/80 dark:border-theme-border flex flex-col gap-2 shrink-0">
        {selectedInfo && (
          <div className="p-2 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-500/20 flex items-center justify-between text-xs shrink-0">
            <span className="text-slate-500 dark:text-theme-text-muted text-[10px] font-medium">Selected:</span>
            <span className="font-semibold text-purple-700 dark:text-purple-300 text-xs truncate ml-2">
              {selectedInfo.formattedDual}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSelectToday}
              style={{ minHeight: "44px" }}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-theme-border hover:bg-slate-100 dark:hover:bg-theme-hover text-xs font-semibold text-slate-700 dark:text-theme-text transition-colors flex items-center gap-1.5 min-h-[44px] h-11 cursor-pointer"
              aria-label="Go to today"
            >
              <Clock className="w-4 h-4 stroke-[2]" />
              <span>Today</span>
            </button>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                style={{ minHeight: "44px" }}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-theme-border hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/30 text-xs font-semibold text-slate-500 dark:text-theme-text-muted transition-colors min-h-[44px] h-11 cursor-pointer"
                aria-label="Clear date"
              >
                Clear
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleClose}
            style={{ minHeight: "44px" }}
            className="px-4.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer min-h-[44px] h-11"
            aria-label="Confirm date and close"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={triggerRef}>
      {label && (
        <label className="block text-xs font-semibold text-theme-text mb-1 flex items-center justify-between">
          <span>{label}</span>
          {showDualBadge && selectedInfo && (
            <span className="text-[10px] font-mono font-medium text-purple-600 dark:text-purple-400">
              {activeTab === "bs" ? selectedInfo.formattedBs : selectedInfo.formattedAd}
            </span>
          )}
        </label>
      )}

      {/* Trigger Button */}
      <div
        onClick={handleOpen}
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            if (isOpen) handleClose();
            else handleOpen();
          }
        }}
        style={{ minHeight: "44px" }}
        className={`w-full min-h-[44px] flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm cursor-pointer transition-all select-none ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-theme-surface/50 border-slate-200 dark:border-theme-border"
            : isOpen
            ? "border-purple-500 ring-2 ring-purple-500/20 bg-white dark:bg-theme-surface shadow-sm"
            : "bg-white dark:bg-theme-surface hover:bg-slate-50 dark:hover:bg-theme-hover border-slate-200 dark:border-theme-border text-slate-900 dark:text-theme-text"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarIcon className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 stroke-[2]" />
          {selectedInfo ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-900 dark:text-theme-text truncate text-xs sm:text-sm">
                {selectedInfo.formattedAd}
              </span>
              <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-medium shrink-0">
                {selectedInfo.formattedBs}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 dark:text-theme-text-muted text-xs sm:text-sm">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {value && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-1 rounded-md text-slate-400 dark:text-theme-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
              title="Clear date"
              aria-label="Clear date"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Portaled Calendar Popup / Sheet */}
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          coords?.isMobile ? (
            // Mobile: Centered / Bottom-sheet modal overlay (escapes all container overflow)
            <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-1.5 sm:p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
              <div
                className="fixed inset-0"
                onClick={handleClose}
                aria-hidden="true"
              />
              <div
                ref={popoverRef}
                className="relative z-10 w-full max-w-[390px] bg-white dark:bg-theme-surface border border-slate-200 dark:border-theme-border rounded-2xl shadow-2xl p-2.5 sm:p-3.5 text-slate-900 dark:text-theme-text animate-in fade-in duration-150 max-h-[96dvh] flex flex-col overflow-y-auto"
                role="dialog"
                aria-modal="true"
                aria-label={label || "Date picker"}
                onClick={(e) => e.stopPropagation()}
              >
                {renderCalendarContent()}
              </div>
            </div>
          ) : (
            // Desktop: Anchored floating popup with boundary clamping & collision flipping
            <div className="fixed inset-0 z-[70] pointer-events-none select-none">
              <div
                className="fixed inset-0 pointer-events-auto"
                onClick={handleClose}
                aria-hidden="true"
              />
              <div
                ref={popoverRef}
                style={{
                  top: coords?.top !== undefined ? `${coords.top}px` : undefined,
                  bottom: coords?.bottom !== undefined ? `${coords.bottom}px` : undefined,
                  left: coords?.left !== undefined ? `${coords.left}px` : "12px",
                  width: coords?.width ? `${coords.width}px` : "380px",
                  maxHeight: coords?.maxHeight ? `${coords.maxHeight}px` : undefined,
                }}
                className="pointer-events-auto absolute rounded-2xl border border-slate-200 dark:border-theme-border bg-white dark:bg-theme-surface shadow-2xl p-4 text-slate-900 dark:text-theme-text flex flex-col overflow-y-auto animate-in fade-in duration-150"
                role="dialog"
                aria-modal="true"
                aria-label={label || "Date picker"}
                onClick={(e) => e.stopPropagation()}
              >
                {renderCalendarContent()}
              </div>
            </div>
          ),
          document.body
        )}
    </div>
  );
};
