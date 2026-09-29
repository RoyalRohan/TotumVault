import React, { useState, useEffect, useRef, useMemo } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Preference for initial tab: BS if stored is "bs", else AD
  const defaultTab: "ad" | "bs" = useMemo(() => {
    const pref = getStoredCalendarPreference();
    return pref === "bs" ? "bs" : "ad";
  }, []);

  const [activeTab, setActiveTab] = useState<"ad" | "bs">(defaultTab);
  const [numeralSystem] = useState<NumeralSystem>(getStoredNumeralPreference());

  // Current calendar view state
  const today = useMemo(() => new Date(), []);
  const todayAdYear = today.getFullYear();
  const todayAdMonth = today.getMonth() + 1;
  const todayAdDay = today.getDate();
  const todayBs = useMemo(() => {
    try {
      return adToBs(todayAdYear, todayAdMonth, todayAdDay);
    } catch {
      return { year: 2083, month: 6, day: 13, weekday: 2 };
    }
  }, [todayAdYear, todayAdMonth, todayAdDay]);

  // Selected date components
  const selectedInfo = useMemo(() => {
    if (!value) return null;
    return getDualDateInfo(value, numeralSystem === "ne");
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

  // Sync view state when selected date changes externally
  useEffect(() => {
    if (selectedInfo) {
      setAdViewYear(selectedInfo.ad.year);
      setAdViewMonth(selectedInfo.ad.month);
      setBsViewYear(selectedInfo.bs.year);
      setBsViewMonth(selectedInfo.bs.month);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Handle switching tabs: automatically align viewing month/year
  const handleTabSwitch = (newTab: "ad" | "bs") => {
    setActiveTab(newTab);
    if (newTab === "bs") {
      try {
        const converted = adToBs(adViewYear, adViewMonth, 15);
        setBsViewYear(converted.year);
        setBsViewMonth(converted.month);
      } catch {
        // Fallback
      }
    } else {
      try {
        const converted = bsToAd(bsViewYear, bsViewMonth, 15);
        setAdViewYear(converted.year);
        setAdViewMonth(converted.month);
      } catch {
        // Fallback
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

  // Select Today
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
      bsSubDay?: number;
      isSelected: boolean;
      isToday: boolean;
    }> = [];

    // Prev month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: prevDaysInMonth - i,
        isCurrentMonth: false,
        isSelected: false,
        isToday: false,
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

      days.push({
        day: d,
        isCurrentMonth: true,
        bsSubDay,
        isSelected,
        isToday,
      });
    }

    // Next month padding to fill grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        isSelected: false,
        isToday: false,
      });
    }

    return days;
  }, [adViewYear, adViewMonth, selectedInfo, todayAdYear, todayAdMonth, todayAdDay]);

  // Grid calculations for BS
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

    const days: Array<{
      day: number;
      isCurrentMonth: boolean;
      adSubDay?: number;
      isSelected: boolean;
      isToday: boolean;
    }> = [];

    // Prev month padding
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      days.push({
        day: 30 - i,
        isCurrentMonth: false,
        isSelected: false,
        isToday: false,
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

      days.push({
        day: d,
        isCurrentMonth: true,
        adSubDay,
        isSelected,
        isToday,
      });
    }

    // Next month padding
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        isSelected: false,
        isToday: false,
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

  return (
    <div className={`relative ${className}`} ref={containerRef}>
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
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm cursor-pointer transition-all ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-theme-surface/50 border-theme-border"
            : isOpen
            ? "border-purple-500 ring-2 ring-purple-500/20 bg-theme-surface shadow-sm"
            : "bg-theme-surface hover:bg-theme-hover border-theme-border text-theme-text"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarIcon className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 stroke-[2]" />
          {selectedInfo ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-theme-text truncate text-xs sm:text-sm">
                {selectedInfo.formattedAd}
              </span>
              <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-medium shrink-0">
                {selectedInfo.formattedBs}
              </span>
            </div>
          ) : (
            <span className="text-theme-text-muted text-xs sm:text-sm">{placeholder}</span>
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
              className="p-1 rounded-md text-theme-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
              title="Clear date"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Calendar Popup Dropdown / Modal */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-2 w-[340px] sm:w-[380px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-theme-border bg-theme-surface shadow-2xl p-3.5 sm:p-4 animate-scale-up text-theme-text ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Header with AD / BS Tab Switcher */}
          <div className="flex items-center justify-between pb-3 border-b border-theme-border">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-theme-bg/80 p-0.5 rounded-xl border border-theme-border">
              <button
                type="button"
                onClick={() => handleTabSwitch("ad")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "ad"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-theme-text-muted hover:text-theme-text"
                }`}
              >
                AD (Gregorian)
              </button>
              <button
                type="button"
                onClick={() => handleTabSwitch("bs")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "bs"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-theme-text-muted hover:text-theme-text"
                }`}
              >
                BS (नेपाली पात्रो)
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-xl text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4 stroke-[2]" />
            </button>
          </div>

          {/* Month / Year Navigation */}
          {activeTab === "ad" ? (
            <div className="py-3">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <button
                  type="button"
                  onClick={prevAdMonth}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-theme-hover text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
                  aria-label="Previous Month"
                >
                  <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                </button>

                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-theme-text">
                  <select
                    value={adViewMonth}
                    onChange={(e) => setAdViewMonth(parseInt(e.target.value, 10))}
                    className="bg-transparent border border-theme-border rounded-xl px-2.5 py-1.5 font-semibold text-xs sm:text-sm cursor-pointer focus:outline-none focus:border-purple-500"
                  >
                    {AD_MONTH_NAMES_EN.map((m, idx) => (
                      <option key={m} value={idx + 1} className="bg-theme-surface text-theme-text">
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={adViewYear}
                    onChange={(e) => setAdViewYear(parseInt(e.target.value, 10))}
                    className="bg-transparent border border-theme-border rounded-xl px-2.5 py-1.5 font-semibold text-xs sm:text-sm cursor-pointer focus:outline-none focus:border-purple-500"
                  >
                    {Array.from({ length: 61 }, (_, i) => 1990 + i).map((y) => (
                      <option key={y} value={y} className="bg-theme-surface text-theme-text">
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={nextAdMonth}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-theme-hover text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
                  aria-label="Next Month"
                >
                  <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>

              {/* Subtitle with BS equivalent */}
              <div className="text-center text-xs font-medium text-purple-600 dark:text-purple-400">
                {bsEquivalentSubtitle}
              </div>
            </div>
          ) : (
            <div className="py-3">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <button
                  type="button"
                  onClick={prevBsMonth}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-theme-hover text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
                  aria-label="Previous Month"
                >
                  <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                </button>

                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-theme-text">
                  <select
                    value={bsViewMonth}
                    onChange={(e) => setBsViewMonth(parseInt(e.target.value, 10))}
                    className="bg-transparent border border-theme-border rounded-xl px-2.5 py-1.5 font-semibold text-xs sm:text-sm cursor-pointer focus:outline-none focus:border-purple-500"
                  >
                    {BS_MONTH_NAMES_EN.map((m, idx) => (
                      <option key={m} value={idx + 1} className="bg-theme-surface text-theme-text">
                        {BS_MONTH_NAMES_SHORT_EN[idx]} ({BS_MONTH_NAMES_NE[idx]})
                      </option>
                    ))}
                  </select>

                  <select
                    value={bsViewYear}
                    onChange={(e) => setBsViewYear(parseInt(e.target.value, 10))}
                    className="bg-transparent border border-theme-border rounded-xl px-2.5 py-1.5 font-semibold text-xs sm:text-sm cursor-pointer focus:outline-none focus:border-purple-500"
                  >
                    {Array.from(
                      { length: END_BS_YEAR - START_BS_YEAR + 1 },
                      (_, i) => START_BS_YEAR + i
                    ).map((y) => (
                      <option key={y} value={y} className="bg-theme-surface text-theme-text">
                        {y} ({toNepaliNumerals(y)})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={nextBsMonth}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-theme-hover text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
                  aria-label="Next Month"
                >
                  <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>

              {/* Subtitle with AD equivalent */}
              <div className="text-center text-xs font-medium text-purple-600 dark:text-purple-400">
                {adEquivalentSubtitle}
              </div>
            </div>
          )}

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-theme-text-muted py-1.5 border-b border-theme-border mb-1.5">
            {activeTab === "ad"
              ? WEEKDAY_NAMES_SHORT_EN.map((d) => <span key={d}>{d}</span>)
              : WEEKDAY_NAMES_SHORT_NE.map((d) => <span key={d}>{d}</span>)}
          </div>

          {/* Calendar Day Grid (Touch-friendly 44px+ cells) */}
          <div className="grid grid-cols-7 gap-1 text-xs">
            {activeTab === "ad"
              ? adDaysGrid.map((item, idx) => {
                  if (!item.isCurrentMonth) {
                    return (
                      <div
                        key={idx}
                        className="min-h-[44px] h-11 sm:h-12 rounded-xl flex items-center justify-center text-theme-text-muted/30 text-xs"
                      >
                        {item.day}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectAdDate(item.day)}
                      className={`min-h-[44px] h-11 sm:h-12 rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer select-none ${
                        item.isSelected
                          ? "bg-purple-600 text-white font-bold shadow-sm"
                          : item.isToday
                          ? "border-2 border-purple-500/60 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold hover:bg-purple-500/20"
                          : "hover:bg-theme-hover text-theme-text font-medium"
                      }`}
                    >
                      <span className="text-xs sm:text-sm leading-none">{item.day}</span>
                      {item.bsSubDay && (
                        <span
                          className={`text-[9px] sm:text-[10px] leading-tight font-mono opacity-65 mt-0.5 ${
                            item.isSelected ? "text-purple-100" : "text-purple-600 dark:text-purple-400"
                          }`}
                        >
                          {item.bsSubDay}
                        </span>
                      )}
                    </button>
                  );
                })
              : bsDaysGrid.map((item, idx) => {
                  if (!item.isCurrentMonth) {
                    return (
                      <div
                        key={idx}
                        className="min-h-[44px] h-11 sm:h-12 rounded-xl flex items-center justify-center text-theme-text-muted/30 text-xs"
                      >
                        {item.day}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectBsDate(item.day)}
                      className={`min-h-[44px] h-11 sm:h-12 rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer select-none ${
                        item.isSelected
                          ? "bg-purple-600 text-white font-bold shadow-sm"
                          : item.isToday
                          ? "border-2 border-purple-500/60 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold hover:bg-purple-500/20"
                          : "hover:bg-theme-hover text-theme-text font-medium"
                      }`}
                    >
                      <span className="text-xs sm:text-sm leading-none">
                        {numeralSystem === "ne" ? toNepaliNumerals(item.day) : item.day}
                      </span>
                      {item.adSubDay && (
                        <span
                          className={`text-[9px] sm:text-[10px] leading-tight font-mono opacity-65 mt-0.5 ${
                            item.isSelected ? "text-purple-100" : "text-slate-500 dark:text-zinc-400"
                          }`}
                        >
                          {item.adSubDay}
                        </span>
                      )}
                    </button>
                  );
                })}
          </div>

          {/* Bottom Info & Action Bar */}
          <div className="mt-3.5 pt-3 border-t border-theme-border flex flex-col gap-2.5">
            {selectedInfo && (
              <div className="p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-500/30 flex items-center justify-between text-xs">
                <div>
                  <span className="text-theme-text-muted block text-[10px]">Selected Date:</span>
                  <span className="font-semibold text-purple-700 dark:text-purple-300">
                    {selectedInfo.formattedDual}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectToday}
                  className="px-3 py-2 rounded-xl border border-theme-border hover:bg-theme-hover text-xs font-semibold text-theme-text transition-colors flex items-center gap-1.5 min-h-[38px] cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 stroke-[2]" />
                  <span>Today</span>
                </button>
                {value && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-3 py-2 rounded-xl border border-theme-border hover:bg-rose-500/10 hover:text-rose-500 text-xs font-semibold text-theme-text-muted transition-colors min-h-[38px] cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer min-h-[38px]"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
