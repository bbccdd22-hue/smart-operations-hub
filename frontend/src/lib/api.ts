export type DashboardSummary = {
  filters?: {
    city?: string;
    brand?: string;
    branch_id?: string;
    date_from?: string;
    date_to?: string;
  };
  totals: {
    system_total_sales: number | null;
    system_cash: number | null;
    system_network: number | null;
    shifts_count: number | null;
    total_variance?: number | null;
    orders_count?: number | null;
    avg_check?: number | null;
    active_branches?: number | null;
  };
  financial_summary?: {
    cash_foodics: number;
    span: number;
    delivery_apps: number;
    total_sales?: number;
    cash_foodics_breakdown?: Array<{ branch_id: number; branch_name: string; total: number }>;
    span_breakdown?: Array<{ branch_id: number; branch_name: string; total: number }>;
    total_sales_breakdown?: Array<{ branch_id: number; branch_name: string; total: number }>;
    delivery_apps_breakdown?: Array<{
      app_name: string;
      total: number;
      by_branch: Array<{ branch_id: number; branch_name: string; total: number }>;
    }>;
  };
  by_brand: Array<{
    shift__branch__brand__name: string;
    shift__branch__brand__slug: string;
    system_total_sales: number;
    shifts: number;
  }>;
  alerts: {
    variance_cash: Array<{
      shift__branch__id: number;
      shift__branch__name: string;
      shift__branch__brand__name: string;
      variance_cash: number;
    }>;
    low_stock: Array<{
      branch_id: number;
      branch: string;
      ingredient: string;
      on_hand: string;
      reorder_level: string;
    }>;
  };
};

export type DashboardChartData = {
  daily_series: Array<{ date: string; sales: number; forecast: number; qty?: number }>;
  revenue_split: Array<{ name: string; value: number; key: string }>;
  top_products?: Array<{ product_name: string; product_sku?: string; sales: number; qty?: number }>;
  branch_performance?: Array<{ branch_name: string; value: number }>;
  sales_vs_qty_trend?: Array<{ date: string; sales: number; qty: number }>;
};

export type DashboardInsight = {
  type: "success" | "info" | "alert" | "warning";
  title?: string;
  message?: string;
  /** i18n key for title (full Arabic when device lang is ar) */
  title_key?: string;
  /** i18n key for message, with params for interpolation */
  message_key?: string | null;
  params?: Record<string, string | number>;
};

import { NETWORK_ID, ZERO_TIER_IP } from "../config/network";

/** [SAFETY LOCK] API base – ZeroTier 10.219.168.113. In dev, use /api (Vite proxy = same-origin, fixes 403). */
const API_BASE_FALLBACK = `http://${ZERO_TIER_IP}:8000/api`;
export const API_BASE =
  import.meta.env.DEV
    ? "/api" /* Dev: Vite proxies /api → backend; same-origin = cookies work */
    : (import.meta.env.VITE_API_BASE && typeof import.meta.env.VITE_API_BASE === "string")
      ? import.meta.env.VITE_API_BASE
      : API_BASE_FALLBACK;

/** All remote API requests include Network ID f3797ba7a810f0e3 */
function apiHeaders(opts: RequestInit = {}): Record<string, string> {
  return { "X-Network-ID": NETWORK_ID, ...(opts.headers as Record<string, string>) };
}

function fetchWithCsrf(url: string, opts: RequestInit = {}) {
  const headers = apiHeaders(opts);
  const method = (opts.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    if (match) headers["X-CSRFToken"] = match[1];
  }
  return fetch(url, { ...opts, credentials: "include", headers });
}

export async function fetchDashboardSummary(params?: {
  city?: string;
  brand?: string;
  brands?: string[];
  branch_id?: number | string;
  branch_ids?: number[];
  date_from?: string;
  date_to?: string;
  report_type?: string;
}): Promise<DashboardSummary> {
  const qs = new URLSearchParams();
  if (params?.city) qs.set("city", params.city);
  if (params?.brands?.length) qs.set("brands", params.brands.join(","));
  else if (params?.brand) qs.set("brand", params.brand);
  if (params?.branch_id != null) qs.set("branch_id", String(params.branch_id));
  if (params?.branch_ids?.length) qs.set("branch_ids", params.branch_ids.join(","));
  if (params?.date_from) qs.set("date_from", params.date_from);
  if (params?.date_to) qs.set("date_to", params.date_to);
  if (params?.report_type) qs.set("report_type", params.report_type);

  const url = `${API_BASE}/dashboard/summary/${qs.toString() ? `?${qs}` : ""}`;
  try {
    const res = await fetch(url, { credentials: "include", cache: "no-store", headers: apiHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as DashboardSummary;
  } catch {
    return {
      totals: {
        system_total_sales: 0,
        system_cash: 0,
        system_network: 0,
        shifts_count: 0,
        total_variance: 0,
        orders_count: null
      },
      by_brand: [],
      alerts: { variance_cash: [], low_stock: [] }
    };
  }
}

export async function fetchDashboardInsights(params?: { brand?: string; brands?: string[] }): Promise<{
  insights: DashboardInsight[];
}> {
  const qs = new URLSearchParams();
  if (params?.brands?.length) qs.set("brands", params.brands.join(","));
  else if (params?.brand) qs.set("brand", params.brand);
  try {
    const res = await fetch(`${API_BASE}/dashboard/insights/?${qs.toString()}`, {
      credentials: "include",
      cache: "no-store",
      headers: apiHeaders(),
    });
    if (!res.ok) return { insights: [] };
    return res.json();
  } catch {
    return { insights: [] };
  }
}

export async function fetchDashboardChartData(params?: {
  city?: string;
  brand?: string;
  brands?: string[];
  branch_id?: number | string;
  branch_ids?: number[];
  branch_code?: string;
  branch_name?: string;
  date_from?: string;
  date_to?: string;
  report_type?: string;
  include_all_products?: boolean;
}): Promise<DashboardChartData> {
  const qs = new URLSearchParams();
  if (params?.city) qs.set("city", params.city);
  if (params?.brands?.length) qs.set("brands", params.brands.join(","));
  else if (params?.brand) qs.set("brand", params.brand);
  if (params?.branch_id != null) qs.set("branch_id", String(params.branch_id));
  if (params?.branch_ids?.length) qs.set("branch_ids", params.branch_ids.join(","));
  if (params?.branch_code) qs.set("branch_code", params.branch_code);
  if (params?.branch_name) qs.set("branch_name", params.branch_name);
  if (params?.date_from) qs.set("date_from", params.date_from);
  if (params?.date_to) qs.set("date_to", params.date_to);
  if (params?.report_type) qs.set("report_type", params.report_type);
  if (params?.include_all_products) qs.set("include_all_products", "1");

  const url = `${API_BASE}/dashboard/chart-data/${qs.toString() ? `?${qs}` : ""}`;
  try {
    const res = await fetch(url, { credentials: "include", cache: "no-store", headers: apiHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as DashboardChartData;
  } catch {
    return {
      daily_series: [],
      revenue_split: [],
      top_products: [],
      branch_performance: [],
      sales_vs_qty_trend: [],
    };
  }
}

/**
 * Prep List (PR1002): Fetch sales from SP1003 (ProductSale).
 * EMERGENCY: If branch filter returns empty, retry with brands ONLY.
 * [Ref: 2026-02-13] RAW qty sum. product_name fallback when sku missing.
 */
export async function fetchProductSalesForPrepList(params: {
  brands?: string[];
  branch_ids?: number[] | null;
  branch_id?: number | string | null;
  branch_code?: string | null;
  branch_name?: string | null;
  date_from: string;
  date_to: string;
}): Promise<DashboardChartData & { used_fallback?: boolean; actual_date_from?: string; actual_date_to?: string }> {
  const base: Parameters<typeof fetchDashboardChartData>[0] = {
    date_from: params.date_from,
    date_to: params.date_to,
    report_type: "product_sales",
    include_all_products: true,
  };
  const branchIdsValid = params.branch_ids != null && Array.isArray(params.branch_ids) && params.branch_ids.length > 0;
  const branchIdValid = params.branch_id != null && params.branch_id !== "";
  if (branchIdsValid) base.branch_ids = params.branch_ids!;
  else if (branchIdValid) base.branch_id = params.branch_id!;
  if (params.brands?.length) base.brands = params.brands;
  if (params.branch_code) base.branch_code = params.branch_code;
  if (params.branch_name) base.branch_name = params.branch_name;

  let res = await fetchDashboardChartData(base);
  const hasProducts = (res.top_products || []).some((p) => (p.product_name?.trim?.() || "").length > 0);

  if (!hasProducts && params.brands?.length) {
    const brandsOnly = { ...base } as typeof base;
    delete (brandsOnly as Record<string, unknown>).branch_ids;
    delete (brandsOnly as Record<string, unknown>).branch_id;
    delete (brandsOnly as Record<string, unknown>).branch_code;
    delete (brandsOnly as Record<string, unknown>).branch_name;
    res = await fetchDashboardChartData(brandsOnly);
    if ((res.top_products || []).some((p) => (p.product_name?.trim?.() || "").length > 0)) {
      return { ...res, used_fallback: true, actual_date_from: params.date_from, actual_date_to: params.date_to };
    }
  }
  return res;
}

/** @deprecated Use fetchProductSalesForPrepList for Prep List. Kept for OperationsDashboardPage. */
export async function fetchDashboardChartDataWithFallback(params: {
  branch_id?: number | string;
  branch_ids?: number[];
  brands?: string[];
  date_from: string;
  date_to: string;
  include_all_products?: boolean;
}): Promise<DashboardChartData & { used_fallback?: boolean; actual_date_from?: string; actual_date_to?: string }> {
  return fetchProductSalesForPrepList({
    ...params,
    date_from: params.date_from,
    date_to: params.date_to,
  });
}

export type Brand = {
  id: number;
  name: string;
  name_ar?: string;
  slug: string;
  brand_code?: string;
  chart_rev_prefix?: string;
  chart_exp_prefix?: string;
};

export type City = {
  id: number;
  option_code?: string;
  name_en: string;
  name_ar: string;
  code: string;
};

export type District = {
  id: number;
  option_code?: string;
  city: number;
  city_name_en?: string;
  city_name_ar?: string;
  name_en: string;
  name_ar: string;
};

export type BranchType = {
  id: number;
  option_code?: string;
  name_en: string;
  name_ar: string;
};

export type Branch = {
  id: number;
  name: string;
  name_ar?: string;
  code: string;
  branch_code?: string;
  brand: Brand;
  city: City;
  district?: District | null;
  branch_type?: BranchType | null;
};

/** Localized display name for Branch (AR/EN) */
export function branchDisplayName(branch: Branch, lang: string): string {
  return (lang === "ar" && branch.name_ar) ? branch.name_ar : branch.name;
}

/** Localized display name for Brand (AR/EN) */
export function brandDisplayName(brand: Brand, lang: string): string {
  const b = brand as { name_ar?: string };
  return b.name_ar && lang === "ar" ? b.name_ar : brand.name;
}

export async function fetchBrands(): Promise<Brand[]> {
  try {
    const res = await fetch(`${API_BASE}/org/brands/`, { credentials: "include" });
    if (!res.ok) throw new Error();
    return (await res.json()) as Brand[];
  } catch {
    return [];
  }
}

export async function fetchCities(): Promise<City[]> {
  try {
    const res = await fetch(`${API_BASE}/org/cities/`, { credentials: "include" });
    if (!res.ok) throw new Error();
    return (await res.json()) as City[];
  } catch {
    return [];
  }
}

export async function fetchDistricts(cityId?: number): Promise<District[]> {
  try {
    const qs = cityId != null ? `?city_id=${cityId}` : "";
    const res = await fetch(`${API_BASE}/org/districts/${qs}`, { credentials: "include" });
    if (!res.ok) throw new Error();
    return (await res.json()) as District[];
  } catch {
    return [];
  }
}

export async function fetchBranchTypes(): Promise<BranchType[]> {
  try {
    const res = await fetch(`${API_BASE}/org/branch-types/`, { credentials: "include" });
    if (!res.ok) throw new Error();
    return (await res.json()) as BranchType[];
  } catch {
    return [];
  }
}

export async function createCity(payload: { name_en: string; name_ar?: string; code?: string }): Promise<City> {
  const res = await fetch(`${API_BASE}/org/cities/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCsrfToken() || "",
      ...apiHeaders(),
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to create city");
  return j;
}

export async function createDistrict(payload: {
  city_id: number;
  name_en: string;
  name_ar?: string;
}): Promise<District> {
  const res = await fetch(`${API_BASE}/org/districts/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to create district");
  return j;
}

export async function createBranchType(payload: {
  name_en: string;
  name_ar?: string;
}): Promise<BranchType> {
  const res = await fetch(`${API_BASE}/org/branch-types/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to create branch type");
  return j;
}

export async function updateCity(id: number, payload: Partial<{ name_en: string; name_ar: string }>): Promise<City> {
  const res = await fetch(`${API_BASE}/org/cities/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to update city");
  return j;
}

export async function deleteCity(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/org/cities/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers: { "X-CSRFToken": getCsrfToken() || "" },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j.detail as string) || "Failed to delete city");
  }
}

export type ChartAccount = {
  id: number;
  code: string;
  name_ar: string;
  name_en: string;
  level: number;
  parent: number | null;
  account_type: string;
  statement: string;
  is_active: boolean;
  balance?: string | number;
  has_balance?: boolean;
};

export async function fetchChartAccounts(): Promise<ChartAccount[]> {
  const res = await fetch(`${API_BASE}/accounting/chart/`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch chart of accounts");
  return res.json();
}

export async function createChartAccount(payload: Partial<ChartAccount>): Promise<ChartAccount> {
  const res = await fetch(`${API_BASE}/accounting/chart/`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "", ...apiHeaders() },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || (j.code ? j.code[0] : "Failed"));
  return j;
}

export async function updateChartAccount(id: number, payload: Partial<ChartAccount>): Promise<ChartAccount> {
  const res = await fetch(`${API_BASE}/accounting/chart/${id}/`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "", ...apiHeaders() },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed");
  return j;
}

export async function deleteChartAccount(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/accounting/chart/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers: { "X-CSRFToken": getCsrfToken() || "", ...apiHeaders() },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to delete");
}

/** محرك رفع البيانات المالي – تحديث أرصدة الحسابات من الإكسل */
export async function importChartBalances(balances: Record<string, number>): Promise<{ updated: number; not_found: string[]; errors: string[] }> {
  const res = await fetch(`${API_BASE}/accounting/chart/import-balances/`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "", ...apiHeaders() },
    body: JSON.stringify({ balances }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to import balances");
  return j;
}

/** Clear all cities and districts (SAIF only). Returns count of deleted records. */
export type RolePermissions = {
  role: string;
  permissions: Record<string, boolean>;
};

export async function fetchRolePermissions(role: string): Promise<RolePermissions> {
  const res = await fetch(`${API_BASE}/org/role-permissions/${role}/`, {
    credentials: "include",
    headers: apiHeaders(),
  });
  const j = (await res.json().catch(() => ({}))) as RolePermissions | { detail?: string };
  if (!res.ok) throw new Error((j as { detail?: string }).detail || "Failed to fetch role permissions");
  return j as RolePermissions;
}

export async function updateRolePermissions(role: string, permissions: Record<string, boolean>): Promise<RolePermissions> {
  const res = await fetch(`${API_BASE}/org/role-permissions/${role}/`, {
    method: "PATCH",
    credentials: "include",
    headers: { ...apiHeaders(), "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    body: JSON.stringify({ permissions }),
  });
  const j = (await res.json().catch(() => ({}))) as RolePermissions | { detail?: string };
  if (!res.ok) throw new Error((j as { detail?: string }).detail || "Failed to update role permissions");
  return j as RolePermissions;
}

export async function clearAllCities(): Promise<{ deleted_cities: number; deleted_districts: number }> {
  const res = await fetch(`${API_BASE}/org/cities/clear/`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRFToken": getCsrfToken() || "", ...apiHeaders() },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to clear cities");
  return j;
}

export async function updateDistrict(
  id: number,
  payload: Partial<{ name_en: string; name_ar: string; city_id: number }>
): Promise<District> {
  const res = await fetch(`${API_BASE}/org/districts/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to update district");
  return j;
}

export async function deleteDistrict(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/org/districts/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers: { "X-CSRFToken": getCsrfToken() || "" },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j.detail as string) || "Failed to delete district");
  }
}

export async function updateBranchType(
  id: number,
  payload: Partial<{ name_en: string; name_ar: string }>
): Promise<BranchType> {
  const res = await fetch(`${API_BASE}/org/branch-types/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to update branch type");
  return j;
}

export async function deleteBranchType(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/org/branch-types/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers: { "X-CSRFToken": getCsrfToken() || "" },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j.detail as string) || "Failed to delete branch type");
  }
}

function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : null;
}

export async function createUser(payload: {
  username: string;
  password: string;
  email?: string;
  role: string;
  brand_ids?: number[];
  branch_ids?: number[];
  all_brands?: boolean;
}): Promise<{ id: number; username: string; email: string; role: string }> {
  const res = await fetch(`${API_BASE}/org/users/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to create user");
  return j;
}

export type UserDetail = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  brand_id: number | null;
  branch_id: number | null;
  brand_ids?: number[];
  all_brands?: boolean;
  brand: { id: number; name: string } | null;
  branch: { id: number; name: string; name_ar?: string } | null;
  phone: string;
  employee_id: string;
  preferred_language: string;
  login_code: string;
  is_staff: boolean;
  is_active: boolean;
  last_login: string | null;
};

export async function fetchUserDetail(id: number): Promise<UserDetail> {
  const res = await fetch(`${API_BASE}/org/users/${id}/`, { credentials: "include" });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to fetch user");
  return j;
}

export async function updateUser(
  id: number,
  payload: Partial<{
    is_active: boolean;
    role: string;
    brand_id: number | null;
    branch_id: number | null;
    brand_ids: number[];
    all_brands: boolean;
    password: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    employee_id: string;
    preferred_language: string;
    login_code: string;
  }>
): Promise<UserDetail> {
  const res = await fetch(`${API_BASE}/org/users/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to update user");
  return j;
}

export async function deleteUser(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/org/users/${id}/`, {
    method: "DELETE",
    headers: { "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j.detail as string) || "Failed to delete user");
  }
}

export type NotificationPreferenceMap = Record<string, boolean>;

export async function fetchNotificationPreferences(): Promise<NotificationPreferenceMap> {
  const res = await fetch(`${API_BASE}/org/notification-preferences/`, { credentials: "include" });
  if (!res.ok) return {};
  return (await res.json()) as NotificationPreferenceMap;
}

export async function updateNotificationPreferences(
  prefs: NotificationPreferenceMap
): Promise<void> {
  const res = await fetch(`${API_BASE}/org/notification-preferences/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error("Failed to update preferences");
}

export type AdminNotificationItem = {
  id: number;
  event_type: string;
  title: string;
  message: string;
  created_at: string;
};

export async function fetchAdminNotifications(limit?: number): Promise<AdminNotificationItem[]> {
  const qs = limit != null ? `?limit=${limit}` : "";
  const res = await fetch(`${API_BASE}/org/notifications${qs}`, { credentials: "include" });
  if (!res.ok) return [];
  return (await res.json()) as AdminNotificationItem[];
}

export async function markNotificationsRead(ids: number[]): Promise<void> {
  await fetch(`${API_BASE}/org/notifications/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify({ ids }),
  });
}

/** Parse preview: upload file, get rows + column mapping. No DB save. */
export type ParsePreviewResponse = {
  rows: Record<string, string>[];
  columns: string[];
  mapping: Record<string, string | null>;
  detected_brand: string | null;
  suggested_report_type: string;
  error_rows: Array<{ row_index: number; sample: Record<string, string> }>;
  total_rows: number;
};

export async function parsePreview(file: File): Promise<ParsePreviewResponse> {
  const form = new FormData();
  form.append("file", file);
  const csrf = getCsrfToken();
  const headers: Record<string, string> = {};
  if (csrf) headers["X-CSRFToken"] = csrf;
  const res = await fetch(`${API_BASE}/imports/parse-preview/`, {
    method: "POST",
    headers,
    body: form,
    credentials: "include",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Parse failed");
  return j;
}

/** Extract server error message from DRF response (detail can be string or object). */
function extractServerError(j: unknown, fallback: string): string {
  if (!j || typeof j !== "object") return fallback;
  const d = (j as Record<string, unknown>).detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => String(x)).join(". ");
  if (d && typeof d === "object") return JSON.stringify(d);
  const fields = (j as Record<string, unknown>);
  const msgs = Object.entries(fields)
    .filter(([k]) => k !== "detail")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("; ");
  return msgs || fallback;
}

/** Upload file with column mapping, brand_id (optional), branch_id. */
export async function uploadExcel(params: {
  file: File;
  report_type: string;
  column_mapping?: Record<string, string | null>;
  brand_id?: number | null;
  branch_id?: number | null;
}): Promise<{
  id: number;
  status: string;
  report_date_from?: string;
  report_date_to?: string;
  variances?: unknown[];
  new_products_count?: number;
}> {
  const form = new FormData();
  form.append("file", params.file);
  form.append("report_type", params.report_type);
  if (params.brand_id != null) form.append("brand_id", String(params.brand_id));
  if (params.column_mapping) {
    form.append("column_mapping", JSON.stringify(params.column_mapping));
  }
  if (params.branch_id != null) form.append("branch_id", String(params.branch_id));
  const csrf = getCsrfToken();
  const headers: Record<string, string> = {};
  if (csrf) headers["X-CSRFToken"] = csrf;
  const res = await fetch(`${API_BASE}/imports/upload/`, {
    method: "POST",
    headers,
    body: form,
    credentials: "include",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractServerError(j, "Upload failed"));
  return j;
}

/** Analytics for a processed upload. */
export type UploadAnalytics = {
  daily_series: Array<{ date: string; sales: number; cash: number; network: number }>;
  branch_performance: Array<{ branch: string; brand: string; sales: number }>;
  payment_split: Array<{ name: string; value: number; key: string }>;
  date_from: string | null;
  date_to: string | null;
};

export async function fetchUploadAnalytics(uploadId: number): Promise<UploadAnalytics> {
  const res = await fetch(`${API_BASE}/imports/upload/${uploadId}/analytics/`, {
    credentials: "include",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to fetch analytics");
  return j;
}

/** Product Catalog upload (Saif format). Headers: المنتج, الوحدة, كود تعريف المنتج, السعر غير شامل الضريبة */
export type ProductCatalogUploadResult = {
  created?: number;
  updated?: number;
  skipped?: number;
  total_processed?: number;
  errors?: Array<{ row: number; error: string }>;
};

export async function uploadProductCatalog(file: File): Promise<ProductCatalogUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const csrf = getCsrfToken();
  const headers: Record<string, string> = {};
  if (csrf) headers["X-CSRFToken"] = csrf;
  const res = await fetch(`${API_BASE}/inventory/product-catalog-upload/`, {
    method: "POST",
    headers,
    body: form,
    credentials: "include",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Product catalog upload failed");
  return j;
}

/** BOM/Recipe bulk upload. Columns: Product, Product SKU (opt), Ingredient, Ingredient Code (opt), Qty, Unit */
export type RecipeBOMUploadResult = {
  created_products?: number;
  created_ingredients?: number;
  created_lines?: number;
  errors?: Array<{ row: number; error: string }>;
};

export async function uploadRecipeBOM(file: File): Promise<RecipeBOMUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const csrf = getCsrfToken();
  const headers: Record<string, string> = {};
  if (csrf) headers["X-CSRFToken"] = csrf;
  const res = await fetch(`${API_BASE}/inventory/recipe-bulk-upload/`, {
    method: "POST",
    headers,
    body: form,
    credentials: "include",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Recipe upload failed");
  return j;
}

/** Batch upload multiple files. Auto branch/brand routing per file. */
export type BatchUploadResult = {
  results: Array<{
    file: string;
    status: "success" | "error" | "skipped";
    upload_id?: number;
    rows?: number;
    error?: string;
  }>;
  summary: {
    success: number;
    failed: number;
    total_sales_sar: number;
    brands: string[];
  };
};

export async function batchUploadExcel(
  files: File[],
  options?: { brand_id?: number | null; branch_id?: number | null }
): Promise<BatchUploadResult> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  if (options?.brand_id != null) form.append("brand_id", String(options.brand_id));
  if (options?.branch_id != null) form.append("branch_id", String(options.branch_id));
  const csrf = getCsrfToken();
  const headers: Record<string, string> = {};
  if (csrf) headers["X-CSRFToken"] = csrf;
  const res = await fetch(`${API_BASE}/imports/batch-upload/`, {
    method: "POST",
    headers,
    body: form,
    credentials: "include",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractServerError(j, "Batch upload failed"));
  return j;
}

/** Saved views for SAIF. */
export type SavedView = {
  id: number;
  name: string;
  brand_slug: string;
  branch_ids: number[];
  report_type: string;
  date_range_days: number;
  is_default: boolean;
};

export async function fetchSavedViews(): Promise<SavedView[]> {
  const res = await fetch(`${API_BASE}/org/saved-views/`, { credentials: "include" });
  if (!res.ok) return [];
  return (await res.json()) as SavedView[];
}

export async function createSavedView(v: Partial<SavedView> & { name: string }): Promise<SavedView> {
  const res = await fetch(`${API_BASE}/org/saved-views/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify(v),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to save view");
  return j;
}

export async function updateSavedView(id: number, v: Partial<SavedView>): Promise<void> {
  const res = await fetch(`${API_BASE}/org/saved-views/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify(v),
  });
  if (!res.ok) throw new Error("Failed to update view");
}

export async function deleteSavedView(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/org/saved-views/${id}/`, {
    method: "DELETE",
    headers: { "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete view");
}

/** سجل الرقابة – فقط سيف يرى هذه الصفحة */
export type ActivityLogEntry = {
  id: number;
  user_id: number | null;
  username: string;
  action_type: string;
  description: string;
  page_path: string;
  file_name: string;
  target_model: string;
  target_id: string;
  ip_address: string;
  created_at: string;
};

export async function fetchActivityLog(limit = 500): Promise<ActivityLogEntry[]> {
  const res = await fetch(`${API_BASE}/org/activity-log/?limit=${Math.min(limit, 1000)}`, {
    credentials: "include",
    headers: apiHeaders(),
  });
  const j = (await res.json().catch(() => ({}))) as { logs?: ActivityLogEntry[] };
  if (!res.ok) return [];
  return j.logs ?? [];
}

export async function logActivity(payload: {
  action_type?: string;
  page_path?: string;
  description?: string;
  file_name?: string;
  target_model?: string;
  target_id?: string;
}): Promise<void> {
  try {
    await fetchWithCsrf(`${API_BASE}/org/activity-log/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action_type: payload.action_type ?? "page_view",
        page_path: payload.page_path ?? "",
        description: payload.description ?? "",
        file_name: payload.file_name ?? "",
        target_model: payload.target_model ?? "",
        target_id: payload.target_id ?? "",
      }),
    });
  } catch {
    // Fire-and-forget; don't block the app
  }
}

export async function createBrand(payload: {
  name: string;
  name_ar?: string;
  brand_code?: string;
}): Promise<Brand> {
  const { name, name_ar, brand_code } = payload;
  const res = await fetch(`${API_BASE}/org/brands/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify({ name, name_ar: name_ar || name, brand_code: brand_code || "" }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to create brand");
  return j;
}

export async function updateBrand(
  id: number,
  payload: Partial<{ name: string; name_ar: string; brand_code: string }>
): Promise<Brand> {
  const res = await fetch(`${API_BASE}/org/brands/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to update brand");
  return j;
}

export async function deleteBrand(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/org/brands/${id}/`, {
    method: "DELETE",
    headers: { "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j.detail as string) || "Failed to delete brand");
  }
}

export async function createBranch(payload: {
  brand_id: number;
  city_id: number;
  district_id?: number | null;
  branch_type_id?: number | null;
  name: string;
  name_ar?: string;
  code?: string;
  branch_code?: string;
}): Promise<Branch> {
  const res = await fetch(`${API_BASE}/org/branches/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to create branch");
  return j;
}

export async function updateBranch(
  id: number,
  payload: Partial<{
    name: string;
    name_ar: string;
    brand_id: number;
    city_id: number;
    district_id: number | null;
    branch_type_id: number | null;
    branch_code: string;
  }>
): Promise<Branch> {
  const res = await fetch(`${API_BASE}/org/branches/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to update branch");
  return j;
}

export async function deleteBranch(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/org/branches/${id}/`, {
    method: "DELETE",
    headers: { "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j.detail as string) || "Failed to delete branch");
  }
}

export async function fetchBranches(brandSlug?: string, brandSlugs?: string[]): Promise<Branch[]> {
  const qs = new URLSearchParams();
  if (brandSlugs?.length) qs.set("brands", brandSlugs.join(","));
  else if (brandSlug) qs.set("brand", brandSlug);
  try {
    const res = await fetch(`${API_BASE}/org/branches/${qs.toString() ? `?${qs}` : ""}`, {
      credentials: "include"
    });
    if (!res.ok) throw new Error();
    return (await res.json()) as Branch[];
  } catch {
    return [];
  }
}

export async function lookupSystemCash(branchId: number, isoDate: string): Promise<number> {
  const qs = new URLSearchParams({ branch_id: String(branchId), date: isoDate });
  try {
    const res = await fetch(`${API_BASE}/imports/system-cash/?${qs.toString()}`, { credentials: "include" });
    if (!res.ok) throw new Error();
    const json = (await res.json()) as { system_cash: string };
    return Number(json.system_cash ?? 0) || 0;
  } catch {
    return 0;
  }
}

export type ForecastDay = { date: string; predicted_sales: number; lower: number; upper: number };
export type ForecastResponse = {
  next_7_days: ForecastDay[];
  next_30_days: ForecastDay[];
  warnings: Array<{ type?: string; message?: string; date?: string }>;
};

export async function fetchForecast(branchId?: number): Promise<ForecastResponse> {
  const qs = new URLSearchParams();
  if (branchId != null) qs.set("branch_id", String(branchId));
  try {
    const res = await fetch(`${API_BASE}/dashboard/forecast/?${qs.toString()}`, { credentials: "include" });
    if (!res.ok) throw new Error();
    return (await res.json()) as ForecastResponse;
  } catch {
    return { next_7_days: [], next_30_days: [], warnings: [] };
  }
}

export type SystemHealthItem = {
  report_type: string;
  label: string;
  last_sync: string | null;
  file_name: string | null;
  date_from: string | null;
  date_to: string | null;
};
export type SystemHealthResponse = { last_uploads: SystemHealthItem[]; status: string };

export async function fetchSystemHealth(): Promise<SystemHealthResponse> {
  try {
    const res = await fetch(`${API_BASE}/dashboard/system-health/`, { credentials: "include" });
    if (!res.ok) throw new Error();
    return (await res.json()) as SystemHealthResponse;
  } catch {
    return { last_uploads: [], status: "unknown" };
  }
}

export type ProductWithRecipe = {
  id: number;
  name: string;
  foodics_product_id: string;
  product_sku?: string;
};

export type InventoryUnit = {
  id: number;
  code: string;
  name_en: string;
  name_ar?: string;
};

export type ManageIngredient = {
  id: number;
  serial_code: string;
  name_en: string;
  name_ar: string;
  system_code: string;
  system_group: string;
  base_unit_id: number | null;
  base_unit_code: string;
  base_unit_name_en: string;
  base_unit_name_ar: string;
  package_conversion_factor: string | null;
  package_name_en: string;
  package_name_ar: string;
  unit_cost?: string | null;
};

export async function fetchInventoryUnits(): Promise<InventoryUnit[]> {
  const res = await fetch(`${API_BASE}/inventory/units/`, { credentials: "include" });
  if (!res.ok) return [];
  return (await res.json()) as InventoryUnit[];
}

export async function fetchIngredients(systemGroup?: string): Promise<ManageIngredient[]> {
  const qs = systemGroup ? `?system_group=${encodeURIComponent(systemGroup)}` : "";
  const res = await fetch(`${API_BASE}/inventory/ingredients/${qs}`, { credentials: "include" });
  if (!res.ok) return [];
  return (await res.json()) as ManageIngredient[];
}

export async function createIngredient(data: {
  name_en: string;
  name_ar?: string;
  base_unit_id: number;
  serial_code?: string;
  system_group?: string;
  package_conversion_factor?: number;
  package_name_en?: string;
  package_name_ar?: string;
}): Promise<ManageIngredient> {
  const res = await fetchWithCsrf(`${API_BASE}/inventory/ingredients/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { detail?: string }).detail || "Failed to create");
  }
  const created = (await res.json()) as ManageIngredient & { id: number };
  return created as ManageIngredient;
}

export async function updateIngredient(
  id: number,
  data: Partial<{
    name_en: string;
    name_ar: string;
    base_unit_id: number;
    serial_code: string;
    system_group: string;
    package_conversion_factor: number | null;
    package_name_en: string;
    package_name_ar: string;
    unit_cost: number | string | null;
  }>
): Promise<void> {
  const res = await fetchWithCsrf(`${API_BASE}/inventory/ingredients/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { detail?: string }).detail || "Failed to update");
  }
}

export type HeartbeatData = {
  burn_rate: {
    milk: { used: string; daily_prep: string; pct: number; label: string };
    beans: { used: string; daily_prep: string; pct: number; label: string };
  };
  sales_mix: { hot_pct: number; cold_pct: number; hot_qty: number; cold_qty: number };
  food_to_coffee_ratio: { pct: number; food_revenue: string; total_revenue: string };
  waste_monitor: {
    theoretical_waste_sar: string;
    variance_pct: number;
    exceeds_tolerance: boolean;
    tolerance_pct: number;
  };
  progress_through_day: number;
  date: string;
  error?: string;
};

export async function fetchHeartbeat(params?: {
  branch_id?: number;
  branch_ids?: number[];
  date?: string;
}): Promise<HeartbeatData> {
  const qs = new URLSearchParams();
  if (params?.branch_id != null) qs.set("branch_id", String(params.branch_id));
  if (params?.branch_ids?.length) qs.set("branch_ids", params.branch_ids.join(","));
  if (params?.date) qs.set("date", params.date);
  const res = await fetch(`${API_BASE}/dashboard/heartbeat/?${qs.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch heartbeat");
  return (await res.json()) as HeartbeatData;
}

export type ProfitSummary = {
  total_sales: string;
  total_cogs: string;
  gross_profit: string;
  ingredients_with_cost?: Array<{
    ingredient_id: number;
    ingredient_name: string;
    serial_code: string;
    qty: string;
    unit_cost: string;
    cost: string;
  }>;
  error?: string;
};

export async function fetchProfitSummary(params: {
  branch_id?: number;
  branch_ids?: number[];
  date_from?: string;
  date_to?: string;
  brands?: string[];
}): Promise<ProfitSummary> {
  const qs = new URLSearchParams();
  if (params.branch_id != null) qs.set("branch_id", String(params.branch_id));
  if (params.branch_ids?.length) qs.set("branch_ids", params.branch_ids.join(","));
  if (params.date_from) qs.set("date_from", params.date_from);
  if (params.date_to) qs.set("date_to", params.date_to);
  if (params.brands?.length) qs.set("brands", params.brands.join(","));
  const res = await fetch(`${API_BASE}/financials/summary/?${qs.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch financial summary");
  return (await res.json()) as ProfitSummary;
}

export type WasteReportEntry = {
  id: number | null;
  ingredient_id: number;
  ingredient_name: string;
  ingredient_name_ar: string;
  serial_code: string;
  date: string;
  theoretical_usage: string;
  actual_usage: string;
  variance: string | null;
};

export type WasteReport = {
  entries: WasteReportEntry[];
  date: string;
};

export async function fetchWasteReport(params: {
  date?: string;
  branch_id?: number;
}): Promise<WasteReport> {
  const qs = new URLSearchParams();
  if (params.date) qs.set("date", params.date);
  if (params.branch_id != null) qs.set("branch_id", String(params.branch_id));
  const res = await fetch(`${API_BASE}/inventory/waste-report/?${qs.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch waste report");
  return (await res.json()) as WasteReport;
}

export async function saveWasteReport(data: {
  date?: string;
  entries: Array<{
    ingredient_id: number;
    theoretical_usage: string | number;
    actual_usage: string | number;
  }>;
}): Promise<{ saved: number; date: string }> {
  const res = await fetchWithCsrf(`${API_BASE}/inventory/waste-report/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save waste report");
  return (await res.json()) as { saved: number; date: string };
}

export async function fetchProductsWithRecipes(branchId?: number): Promise<ProductWithRecipe[]> {
  try {
    const url =
      branchId != null
        ? `${API_BASE}/inventory/products-with-recipes/?branch_id=${branchId}`
        : `${API_BASE}/inventory/products-with-recipes/`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error();
    return (await res.json()) as ProductWithRecipe[];
  } catch {
    return [];
  }
}

export type ProductionPlanIngredient = {
  ingredient_id: number;
  ingredient_name: string;
  ingredient_name_ar?: string;
  serial_code?: string;
  unit_code: string;
  required_qty: string;
  on_hand: string;
  reorder_level: string;
  /** Converted to best display unit (e.g. "10 Liters" or "2 Bottles (2.8L)") */
  display_qty?: string;
  display_unit_code?: string;
  display_unit_label?: string;
  /** PR1002 workable units: e.g. "2 كرتون و 4 وحدة" / "2 Carton and 4 units" */
  workable_display_ar?: string;
  workable_display_en?: string;
  /** Rounded UP quantity for template (e.g. "10") - packages needed */
  workable_qty?: string;
  /** Unit string: package + size (e.g. "علبة (2.8 لتر)" / "Box (1500g)") */
  workable_unit_ar?: string;
  workable_unit_en?: string;
  /** Exact required qty in base unit (e.g. "1080") */
  exact_required?: string;
  /** Base unit label for exact (e.g. "g", "gram") */
  exact_unit_label?: string;
};

export type ProductWithoutRecipe = {
  product_name: string;
  product_sku: string;
  qty: number;
};

export async function fetchPredictForDate(params: {
  branchId?: number;
  brandId?: number;
  date?: string;
}): Promise<{ date: string; predicted_sales: number; lower: number; upper: number; method: string }> {
  const qs = new URLSearchParams();
  if (params.branchId != null) qs.set("branch_id", String(params.branchId));
  if (params.brandId != null) qs.set("brand_id", String(params.brandId));
  if (params.date) qs.set("date", params.date);
  const res = await fetch(`${API_BASE}/dashboard/predict-date/?${qs.toString()}`, {
    credentials: "include"
  });
  if (!res.ok) throw new Error("Forecast failed");
  return (await res.json()) as { date: string; predicted_sales: number; lower: number; upper: number; method: string };
}

export type ReconciliationRow = {
  branch_id: number;
  branch_name: string;
  brand_name: string;
  system_cash: number;
  actual_cash: number;
  cash_variance: number;
  system_card: number;
  actual_card: number;
  card_variance: number;
  delivery_total: number;
  manual_notes: string;
  has_variance: boolean;
  /** Foodics Payments Report (reference only) - for variance display */
  foodics_cash?: number;
  foodics_span?: number;
  foodics_delivery?: number;
  foodics_cash_variance?: number | null;
  foodics_span_variance?: number | null;
};

export type ReconciliationResponse = {
  date: string;
  rows: ReconciliationRow[];
};

export type CashToBankResponse = {
  date: string;
  total_collected: number;
  total_system_cash: number;
  total_variance: number;
  branches: ReconciliationRow[];
};

export type DiscrepancyAlert = {
  branch_id: number;
  branch_name: string;
  brand_name: string;
  occurrences: number;
  total_shortage: number;
  avg_shortage: number;
};

export async function fetchSubmittedBranches(date: string): Promise<{ branch_ids: number[] }> {
  const res = await fetch(`${API_BASE}/accounting/submitted-branches/?date=${date}`, {
    credentials: "include",
  });
  if (!res.ok) return { branch_ids: [] };
  return res.json();
}

export async function fetchDailyReconciliation(params?: {
  date?: string;
  brand?: string;
  branch_ids?: number[];
}): Promise<ReconciliationResponse> {
  const qs = new URLSearchParams();
  if (params?.date) qs.set("date", params.date);
  if (params?.brand) qs.set("brand", params.brand);
  if (params?.branch_ids?.length) qs.set("branch_ids", params.branch_ids.join(","));
  const url = `${API_BASE}/accounting/daily/${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch reconciliation");
  return res.json();
}

export async function fetchCashToBank(params?: { date?: string; brand?: string }): Promise<CashToBankResponse> {
  const qs = new URLSearchParams();
  if (params?.date) qs.set("date", params.date);
  if (params?.brand) qs.set("brand", params.brand);
  const url = `${API_BASE}/accounting/cash-to-bank/${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch cash-to-bank");
  return res.json();
}

export async function fetchDiscrepancyAlerts(params?: {
  days?: number;
  brand?: string;
}): Promise<{ alerts: DiscrepancyAlert[] }> {
  const qs = new URLSearchParams();
  if (params?.days) qs.set("days", String(params.days));
  if (params?.brand) qs.set("brand", params.brand ?? "");
  const url = `${API_BASE}/accounting/discrepancy-alerts/?${qs.toString()}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch alerts");
  return res.json();
}

export async function exportReconciliation(params: {
  date: string;
  brand?: string;
  format: "xlsx" | "csv" | "pdf";
}): Promise<Blob> {
  const qs = new URLSearchParams({ date: params.date, format: params.format });
  if (params.brand) qs.set("brand", params.brand);
  const res = await fetch(`${API_BASE}/accounting/export/?${qs.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Export failed");
  return res.blob();
}

export async function exportDailyReport(params: { date: string; brand?: string }): Promise<Blob> {
  const qs = new URLSearchParams({ date: params.date });
  if (params.brand) qs.set("brand", params.brand);
  const res = await fetch(`${API_BASE}/accounting/daily-report/?${qs.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Export failed");
  return res.blob();
}

export async function fetchPendingSubmissions(params?: { date?: string; brand?: string }): Promise<{
  pending_count: number;
  is_finalized: boolean;
}> {
  const qs = new URLSearchParams();
  if (params?.date) qs.set("date", params.date);
  if (params?.brand) qs.set("brand", params.brand ?? "");
  const res = await fetch(`${API_BASE}/accounting/pending/?${qs.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) return { pending_count: 0, is_finalized: false };
  const j = await res.json();
  return { pending_count: j.pending_count ?? 0, is_finalized: j.is_finalized ?? false };
}

export async function finalizeDay(date: string): Promise<void> {
  const res = await fetchWithCsrf(`${API_BASE}/accounting/finalize/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { detail?: string }).detail || "Failed to finalize");
  }
}

export async function getShiftClosingByBranchDate(params: {
  branchId: number;
  date: string;
  shiftType: string;
}): Promise<{ closing: Record<string, unknown> | null; is_submitted: boolean }> {
  const qs = new URLSearchParams({
    branch_id: String(params.branchId),
    date: params.date,
    shift_type: params.shiftType,
  });
  const res = await fetch(`${API_BASE}/shifts/closing/by-branch-date/?${qs.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) return { closing: null, is_submitted: false };
  return res.json();
}

export async function submitShiftClosing(payload: Record<string, unknown>): Promise<{
  closing: Record<string, unknown>;
  is_submitted: boolean;
}> {
  const res = await fetchWithCsrf(`${API_BASE}/shifts/closing/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { detail?: string }).detail || "Failed to save");
  }
  return res.json();
}

async function doProductionPlanRequest(
  branchId: number,
  items: Array<{ product_id?: number; product_sku?: string; product_name?: string; qty: number }>
): Promise<Response> {
  return fetchWithCsrf(`${API_BASE}/inventory/production-plan/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ branch_id: branchId, items }),
  });
}

export type ProductionPlanResponse = {
  ingredients: ProductionPlanIngredient[];
  total_ingredients?: ProductionPlanIngredient[];
  products_without_recipe?: ProductWithoutRecipe[];
};

export async function calculateProductionPlan(
  branchId: number,
  items: Array<{ product_id?: number; product_sku?: string; product_name?: string; qty: number }>
): Promise<ProductionPlanResponse> {
  let res = await doProductionPlanRequest(branchId, items);

  // On 403 Forbidden, retry once (credentials/cookies may not have been sent on first request)
  if (res.status === 403) {
    res = await doProductionPlanRequest(branchId, items);
  }

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { detail?: string }).detail || `Calculation failed (${res.status})`);
  }
  const json = (await res.json()) as ProductionPlanResponse & { ingredients?: ProductionPlanIngredient[]; total_ingredients?: ProductionPlanIngredient[] };
  return {
    ingredients: json.ingredients ?? [],
    total_ingredients: json.total_ingredients ?? json.ingredients ?? [],
    products_without_recipe: json.products_without_recipe ?? [],
  };
}


