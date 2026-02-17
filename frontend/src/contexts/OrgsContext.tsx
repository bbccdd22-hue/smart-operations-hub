/**
 * لوحة الإعدادات/التحكم – المصدر الوحيد (Single Source of Truth)
 * يجلب العلامات التجارية والفروع من API الإعدادات
 * أي تغيير في لوحة التحكم ينعكس على جميع القوائم المنسدلة
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { fetchBrands, fetchBranches, type Brand, type Branch } from "../lib/api";

export const ORG_DATA_CHANGED_EVENT = "org-data-changed";

export type OrgsState = {
  brands: Brand[];
  branches: Branch[];
  /** فروع لكل علامة – مفتاح بمعرف العلامة (للاستعلام البرمجي) */
  branchesByBrand: Record<string, Branch[]>;
  branchesByBrandId: Record<number, Branch[]>;
  loading: boolean;
  error: string | null;
};

export type OrgsContextValue = OrgsState & {
  refresh: () => Promise<void>;
};

const OrgsContext = createContext<OrgsContextValue | null>(null);

export function OrgsProvider({ children }: { children: ReactNode }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [brandsData, branchesData] = await Promise.all([
        fetchBrands(),
        fetchBranches(),
      ]);
      setBrands(brandsData);
      setBranches(branchesData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setBrands([]);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onChanged = () => refresh();
    window.addEventListener(ORG_DATA_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(ORG_DATA_CHANGED_EVENT, onChanged);
  }, [refresh]);

  const branchesByBrand: Record<string, Branch[]> = {};
  const branchesByBrandId: Record<number, Branch[]> = {};
  for (const b of brands) {
    const key = (b.brand_code ?? b.slug ?? b.name).trim() || String(b.id);
    const list = branches.filter((br) => br.brand?.id === b.id || br.brand?.name === b.name);
    branchesByBrand[key] = list;
    branchesByBrandId[b.id] = list;
  }

  const value: OrgsContextValue = {
    brands,
    branches,
    branchesByBrand,
    branchesByBrandId,
    loading,
    error,
    refresh,
  };

  return <OrgsContext.Provider value={value}>{children}</OrgsContext.Provider>;
}

const EMPTY_ORGS: OrgsContextValue = {
  brands: [],
  branches: [],
  branchesByBrand: {},
  branchesByBrandId: {},
  loading: false,
  error: null,
  refresh: async () => {},
};

export function useOrgs(): OrgsContextValue {
  return useContext(OrgsContext) ?? EMPTY_ORGS;
}

/** اطلاق حدث لتحديث البيانات بعد أي تغيير في لوحة التحكم */
export function dispatchOrgsChanged() {
  window.dispatchEvent(new Event(ORG_DATA_CHANGED_EVENT));
}
