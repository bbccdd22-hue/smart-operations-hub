/**
 * UltimateDateRangePicker – المكون العالمي الموحد لاختيار فترة التاريخ
 * يُستخدم في كافة صفحات النظام والتقارير دون استثناء
 *
 * الميزات:
 * - تقويمان متجاوران (الشهر الحالي + التالي)
 * - لوحة اختصارات جانبية (اليوم، أمس، هذا الأسبوع، الشهر السابق، إلخ)
 * - خيار المقارنة بفترة سابقة (SAIF والمدير العام)
 * - تصميم Glassmorphism داكن: خطوط بيضاء ناصعة، أيام محددة زمردي، خلفية ضبابية
 */
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWithinInterval,
} from "date-fns";
import { ar } from "date-fns/locale";
import type { DateRange, ComparisonPeriod } from "../contexts/DateRangeContext";
import { PRESET_LIST, getComparisonPeriod } from "../contexts/DateRangeContext";

export type { DateRange };

type Props = {
  value: DateRange;
  onChange: (range: DateRange) => void;
  onApply?: () => void;
  comparisonEnabled?: boolean;
  onComparisonChange?: (enabled: boolean) => void;
  canUseComparison?: boolean;
  triggerClassName?: string;
  /** استخدام زر داكن (للصفحات ذات الثيم الداكن مثل لوحة المالك) */
  triggerDark?: boolean;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_AR = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

function renderCalendarMonth(
  monthView: Date,
  draft: DateRange,
  compPeriod: ComparisonPeriod | null,
  isRTL: boolean,
  handleDayClick: (d: Date) => void
) {
  const monthStart = startOfMonth(monthView);
  const monthEnd = endOfMonth(monthView);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: isRTL ? 6 : 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: isRTL ? 6 : 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekdays = isRTL ? WEEKDAYS_AR : WEEKDAYS;

  const isInRange = (d: Date) => isWithinInterval(d, { start: draft.from, end: draft.to });
  const isInCompRange = (d: Date) =>
    compPeriod && isWithinInterval(d, { start: compPeriod.from, end: compPeriod.to });

  return (
    <div className="flex flex-col" style={{ flex: "1 1 180px", minWidth: 0 }}>
      <div className="ultimate-calendar-month-title mb-2 text-center text-xs font-semibold">
        {format(monthView, "MMMM yyyy", { locale: isRTL ? ar : undefined })}
      </div>
      <div className="ultimate-calendar-weekdays grid grid-cols-7 gap-0.5 text-center text-[9px] font-medium">
        {weekdays.map((w) => (
          <div key={w} className="py-0.5">
            {w}
          </div>
        ))}
      </div>
      <div className="ultimate-calendar-days mt-0.5 grid grid-cols-7 gap-0.5">
        {days.map((d) => {
          const inRange = isInRange(d);
          const inComp = isInCompRange(d);
          const isSameMonthDay = isSameMonth(d, monthView);
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => handleDayClick(d)}
              className={`ultimate-calendar-day flex h-7 w-7 items-center justify-center rounded-lg text-[11px] transition
                ${!isSameMonthDay ? "ultimate-calendar-day-other" : ""}
                ${inComp && !inRange ? "ultimate-calendar-day-comp" : ""}
                ${inRange ? "ultimate-calendar-day-selected" : ""}
                ${isSameMonthDay && !inRange && !inComp ? "ultimate-calendar-day-normal" : ""}
              `}
            >
              {format(d, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function UltimateDateRangePicker({
  value,
  onChange,
  onApply,
  comparisonEnabled = false,
  onComparisonChange,
  canUseComparison = false,
  triggerClassName,
  triggerDark = false,
}: Props) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const [draftComp, setDraftComp] = useState(comparisonEnabled);
  const [monthViewLeft, setMonthViewLeft] = useState(value.from);
  const monthViewRight = addMonths(monthViewLeft, 1);
  const [selectMode, setSelectMode] = useState<"from" | "to">("from");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; openUp: boolean } | null>(null);

  useEffect(() => {
    setDraft(value);
    setMonthViewLeft(value.from);
  }, [value, open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !document.body) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const popupHeight = 380;
    const popupWidth = 560;
    const gap = 8;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceBelow = viewportHeight - trigger.bottom;
    const spaceAbove = trigger.top;
    const openUp = spaceBelow < popupHeight && spaceAbove > spaceBelow;

    const top = openUp ? trigger.top - popupHeight - gap : trigger.bottom + gap;

    let left: number;
    if (isRTL) {
      left = Math.max(12, Math.min(trigger.right - popupWidth, viewportWidth - popupWidth - 12));
    } else {
      left = Math.max(12, Math.min(trigger.left, viewportWidth - popupWidth - 12));
    }

    setPosition({ top, left, openUp });
  }, [open, isRTL]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!open || triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open || e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const compPeriod: ComparisonPeriod = draftComp ? getComparisonPeriod(draft) : null;

  const handleDayClick = (d: Date) => {
    if (selectMode === "from") {
      setDraft({ from: d, to: d });
      setSelectMode("to");
    } else {
      if (d < draft.from) {
        setDraft({ from: d, to: draft.from });
      } else {
        setDraft({ from: draft.from, to: d });
      }
      setSelectMode("from");
    }
  };

  const handlePreset = (preset: (typeof PRESET_LIST)[number]) => {
    const r = preset.getRange();
    setDraft(r);
    setMonthViewLeft(r.from);
  };

  const handleApply = () => {
    onChange(draft);
    onComparisonChange?.(draftComp);
    onApply?.();
    setOpen(false);
  };

  const displayRange = `${format(draft.from, "yyyy-MM-dd")} - ${format(draft.to, "yyyy-MM-dd")}`;

  const popupContent =
    open && position ? (
      <AnimatePresence>
        <motion.div
          ref={popupRef}
          initial={{ opacity: 0, y: position.openUp ? 8 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position.openUp ? 8 : -8 }}
          transition={{ duration: 0.2 }}
          className="ultimate-date-picker-popover"
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            minWidth: 560,
            maxWidth: 600,
            zIndex: 9999,
          }}
        >
          <div className="flex flex-1">
            <div
              className={`flex flex-1 flex-col gap-2 border-white/10 p-4 ${isRTL ? "border-l" : "border-r"}`}
            >
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setMonthViewLeft((m) => subMonths(m, 1))}
                  className="ultimate-picker-nav-btn rounded-lg p-1.5 transition"
                >
                  {isRTL ? "→" : "←"}
                </button>
                <span className="ultimate-picker-nav-label text-xs font-medium">
                  {format(monthViewLeft, "MMM yyyy", { locale: isRTL ? ar : undefined })} –{" "}
                  {format(monthViewRight, "MMM yyyy", { locale: isRTL ? ar : undefined })}
                </span>
                <button
                  type="button"
                  onClick={() => setMonthViewLeft((m) => addMonths(m, 1))}
                  className="ultimate-picker-nav-btn rounded-lg p-1.5 transition"
                >
                  {isRTL ? "←" : "→"}
                </button>
              </div>
              <div className={`flex flex-1 gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                {renderCalendarMonth(
                  monthViewLeft,
                  draft,
                  compPeriod,
                  isRTL,
                  handleDayClick
                )}
                {renderCalendarMonth(
                  monthViewRight,
                  draft,
                  compPeriod,
                  isRTL,
                  handleDayClick
                )}
              </div>
            </div>

            <div
              className={`ultimate-shortcuts-panel flex flex-col border-white/10 p-3 ${isRTL ? "border-r" : "border-l"}`}
              style={{ width: 150 }}
            >
              <div className="ultimate-shortcuts-title text-[10px] font-semibold uppercase tracking-wider">
                {t("shortcuts")}
              </div>
              <div className="mt-2 space-y-0.5">
                {PRESET_LIST.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePreset(p)}
                    className="ultimate-shortcut-btn w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium transition"
                  >
                    {t(p.labelKey as keyof typeof t)}
                  </button>
                ))}
              </div>

              {canUseComparison && onComparisonChange && (
                <div className="mt-4 border-t border-white/10 pt-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draftComp}
                      onChange={(e) => setDraftComp(e.target.checked)}
                      className="h-4 w-4 rounded border-white/30 bg-white/10 text-[#10B981]"
                    />
                    <span className="ultimate-compare-label text-xs">
                      {t("compareToPreviousPeriod")}
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="ultimate-picker-footer flex w-full justify-end border-t border-white/10 p-3">
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-[#10B981] px-6 py-2 text-sm font-medium text-white transition hover:bg-[#059669]"
            >
              {t("apply")}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    ) : null;

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={
            triggerClassName ??
            `ultimate-picker-trigger flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${triggerDark ? "ultimate-picker-trigger-dark" : ""}`
          }
        >
          <span className="text-[10px] uppercase tracking-wider opacity-70">📅</span>
          {displayRange}
        </button>
      </div>
      {typeof document !== "undefined" && createPortal(popupContent, document.body)}
    </>
  );
}
