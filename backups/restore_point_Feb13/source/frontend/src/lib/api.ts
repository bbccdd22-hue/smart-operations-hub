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
  top_products?: Array<{ product_name: string; sales: number }>;
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

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

function fetchWithCsrf(url: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
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
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
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
  date_from?: string;
  date_to?: string;
  report_type?: string;
}): Promise<DashboardChartData> {
  const qs = new URLSearchParams();
  if (params?.city) qs.set("city", params.city);
  if (params?.brands?.length) qs.set("brands", params.brands.join(","));
  else if (params?.brand) qs.set("brand", params.brand);
  if (params?.branch_id != null) qs.set("branch_id", String(params.branch_id));
  if (params?.branch_ids?.length) qs.set("branch_ids", params.branch_ids.join(","));
  if (params?.date_from) qs.set("date_from", params.date_from);
  if (params?.date_to) qs.set("date_to", params.date_to);
  if (params?.report_type) qs.set("report_type", params.report_type);

  const url = `${API_BASE}/dashboard/chart-data/${qs.toString() ? `?${qs}` : ""}`;
  try {
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
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

export type Brand = {
  id: number;
  name: string;
  slug: string;
  brand_code?: string;
};

export type City = {
  id: number;
  name_en: string;
  name_ar: string;
  code: string;
};

export type Branch = {
  id: number;
  name: string;
  name_ar?: string;
  code: string;
  branch_code?: string;
  brand: Brand;
  city: City;
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

/** BOM/Recipe bulk upload. Columns: Product, Ingredient, Qty, Unit */
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

export async function createBrand(name: string, brand_code?: string): Promise<Brand> {
  const res = await fetch(`${API_BASE}/org/brands/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() || "" },
    credentials: "include",
    body: JSON.stringify({ name, brand_code: brand_code || "" }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.detail as string) || "Failed to create brand");
  return j;
}

export async function updateBrand(
  id: number,
  payload: Partial<{ name: string; brand_code: string }>
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
  payload: Partial<{ name: string; name_ar: string; brand_id: number; city_id: number; branch_code: string }>
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

export type ProductWithRecipe = { id: number; name: string; foodics_product_id: string };

export async function fetchProductsWithRecipes(): Promise<ProductWithRecipe[]> {
  try {
    const res = await fetch(`${API_BASE}/inventory/products-with-recipes/`, { credentials: "include" });
    if (!res.ok) throw new Error();
    return (await res.json()) as ProductWithRecipe[];
  } catch {
    return [];
  }
}

export type ProductionPlanIngredient = {
  ingredient_id: number;
  ingredient_name: string;
  unit_code: string;
  required_qty: string;
  on_hand: string;
  reorder_level: string;
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

export async function calculateProductionPlan(
  branchId: number,
  items: Array<{ product_id?: number; product_name?: string; qty: number }>
): Promise<{ ingredients: ProductionPlanIngredient[] }> {
  const res = await fetch(`${API_BASE}/inventory/production-plan/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ branch_id: branchId, items })
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { detail?: string }).detail || "Calculation failed");
  }
  return (await res.json()) as { ingredients: ProductionPlanIngredient[] };
}


