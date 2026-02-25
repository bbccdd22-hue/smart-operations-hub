/**
 * Global Date Range Context – فترة التاريخ العالمية
 * عند تغيير التاريخ في أي صفحة، يتذكر النظام الفترة عند الانتقال لصفحة أخرى.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  differenceInDays,
  subWeeks,
} from "date-fns";

export type DateRange = { from: Date; to: Date };

export type ComparisonPeriod = {
  from: Date;
  to: Date;
} | null;

/** الاختصارات: اليوم، أمس، هذا الأسبوع، الأسبوع السابق، هذا الشهر، الشهر السابق */
const PRESETS = [
  { id: "today", labelKey: "today", getRange: () => ({ from: new Date(), to: new Date() }) },
  {
    id: "yesterday",
    labelKey: "yesterday",
    getRange: () => {
      const d = subDays(new Date(), 1);
      return { from: d, to: d };
    },
  },
  {
    id: "thisWeek",
    labelKey: "thisWeek",
    getRange: () => {
      const now = new Date();
      return { from: startOfWeek(now, { weekStartsOn: 0 }), to: endOfWeek(now, { weekStartsOn: 0 }) };
    },
  },
  {
    id: "lastWeek",
    labelKey: "lastWeek",
    getRange: () => {
      const now = new Date();
      const prev = subWeeks(now, 1);
      return { from: startOfWeek(prev, { weekStartsOn: 0 }), to: endOfWeek(prev, { weekStartsOn: 0 }) };
    },
  },
  { id: "thisMonth", labelKey: "thisMonth", getRange: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  {
    id: "lastMonth",
    labelKey: "lastMonth",
    getRange: () => {
      const now = new Date();
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    },
  },
  {
    id: "thisYear",
    labelKey: "thisYear",
    getRange: () => {
      const now = new Date();
      return { from: startOfYear(now), to: now };
    },
  },
] as const;

const DEFAULT_RANGE: DateRange = { from: new Date(), to: new Date() };

/** يُرجع فترة مقابلة سابقة للفترة المختارة (نفس المدة) */
export function getComparisonPeriod(range: DateRange): ComparisonPeriod {
  const days = differenceInDays(range.to, range.from) + 1;
  const prevTo = subDays(range.from, 1);
  const prevFrom = subDays(prevTo, days - 1);
  return { from: prevFrom, to: prevTo };
}

export const PRESET_LIST = PRESETS;

type DateRangeContextValue = {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  dateFrom: string;
  dateTo: string;
  comparisonEnabled: boolean;
  setComparisonEnabled: (v: boolean) => void;
  comparisonPeriod: ComparisonPeriod;
  compDateFrom: string | null;
  compDateTo: string | null;
  canUseComparison: boolean;
};

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function DateRangeProvider({
  children,
  canUseComparison = false,
}: {
  children: ReactNode;
  canUseComparison?: boolean;
}) {
  const [dateRange, setDateRangeState] = useState<DateRange>(DEFAULT_RANGE);
  const [comparisonEnabled, setComparisonEnabled] = useState(false);

  const setDateRange = useCallback((range: DateRange) => {
    setDateRangeState(range);
  }, []);

  const comparisonPeriod = useMemo(() => {
    if (!comparisonEnabled) return null;
    return getComparisonPeriod(dateRange);
  }, [comparisonEnabled, dateRange]);

  const value = useMemo(
    () => ({
      dateRange,
      setDateRange,
      dateFrom: format(dateRange.from, "yyyy-MM-dd"),
      dateTo: format(dateRange.to, "yyyy-MM-dd"),
      comparisonEnabled,
      setComparisonEnabled: canUseComparison ? setComparisonEnabled : () => {},
      comparisonPeriod,
      compDateFrom: comparisonPeriod ? format(comparisonPeriod.from, "yyyy-MM-dd") : null,
      compDateTo: comparisonPeriod ? format(comparisonPeriod.to, "yyyy-MM-dd") : null,
      canUseComparison,
    }),
    [
      dateRange,
      setDateRange,
      comparisonEnabled,
      comparisonPeriod,
      canUseComparison,
    ]
  );

  return (
    <DateRangeContext.Provider value={value}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) {
    return {
      dateRange: DEFAULT_RANGE,
      setDateRange: () => {},
      dateFrom: format(new Date(), "yyyy-MM-dd"),
      dateTo: format(new Date(), "yyyy-MM-dd"),
      comparisonEnabled: false,
      setComparisonEnabled: () => {},
      comparisonPeriod: null as ComparisonPeriod,
      compDateFrom: null as string | null,
      compDateTo: null as string | null,
      canUseComparison: false,
    };
  }
  return ctx;
}
