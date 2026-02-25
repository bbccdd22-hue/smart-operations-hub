/**
 * سياق رؤية التحليل المالي الكامل
 * SAIF والمدير العام فقط – تبديل بين لوحة تشغيلية (إجمالي) ولوحة مالية (صافي الربح والتكاليف)
 * الوضع الافتراضي للمدير العام: تشغيلية (لخصوصية العرض)
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

const STORAGE_KEY_PREFIX = "smart-ops-profit-visibility";

type ProfitVisibilityContextValue = {
  /** عرض التحليل المالي الكامل (صافي الربح، التكاليف، صافي الدخل) */
  showFullFinancial: boolean;
  setShowFullFinancial: (v: boolean) => void;
  /** الصلاحية: SAIF أو المدير العام فقط */
  canUseProfitVisibility: boolean;
};

const ProfitVisibilityContext = createContext<ProfitVisibilityContextValue | null>(null);

export function ProfitVisibilityProvider({
  children,
  canUseProfitVisibility,
  /** الوضع الافتراضي عند الدخول – المدير العام: false (خصوصية)، SAIF: true */
  defaultShowFullFinancial,
  userId,
}: {
  children: ReactNode;
  canUseProfitVisibility: boolean;
  defaultShowFullFinancial: boolean;
  userId?: string | number | null;
}) {
  const [showFullFinancial, setShowFullFinancialState] = useState(defaultShowFullFinancial);
  const storageKey = `${STORAGE_KEY_PREFIX}-${userId ?? "default"}`;

  /** تحميل التفضيل من localStorage – إن لم يكن محفوظاً نستخدم الوضع الافتراضي حسب الدور */
  useEffect(() => {
    if (!canUseProfitVisibility) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        setShowFullFinancialState(stored === "true");
      } else {
        setShowFullFinancialState(defaultShowFullFinancial);
      }
    } catch {
      setShowFullFinancialState(defaultShowFullFinancial);
    }
  }, [canUseProfitVisibility, storageKey, defaultShowFullFinancial]);

  const setShowFullFinancial = useCallback(
    (v: boolean) => {
      if (!canUseProfitVisibility) return;
      setShowFullFinancialState(v);
      try {
        localStorage.setItem(storageKey, String(v));
      } catch {
        // ignore
      }
    },
    [canUseProfitVisibility, storageKey]
  );

  const value: ProfitVisibilityContextValue = {
    showFullFinancial,
    setShowFullFinancial,
    canUseProfitVisibility,
  };

  return (
    <ProfitVisibilityContext.Provider value={value}>
      {children}
    </ProfitVisibilityContext.Provider>
  );
}

export function useProfitVisibility() {
  const ctx = useContext(ProfitVisibilityContext);
  return (
    ctx ?? {
      showFullFinancial: false,
      setShowFullFinancial: () => {},
      canUseProfitVisibility: false,
    }
  );
}
