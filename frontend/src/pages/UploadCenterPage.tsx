import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNotifications } from "../contexts/NotificationContext";
import { fetchBrands, fetchBranches, uploadExcel, logActivity, type Brand, type Branch } from "../lib/api";
import { getBrandDisplayName, getBranchDisplayName } from "../lib/localization";

type UploadState = "idle" | "uploading" | "success" | "error";

type VarianceItem = {
  date: string;
  branch_name: string;
  brand_name: string;
  cash_variance: number;
  card_variance: number;
  categories: string[];
};

export default function UploadCenterPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { addToast } = useNotifications() ?? { addToast: () => {} };
  const [file, setFile] = useState<File | null>(null);
  const [reportType, setReportType] = useState<
    "hourly_sales" | "daily_sales" | "product_sales" | "payments_report"
  >("daily_sales");
  const [status, setStatus] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [variances, setVariances] = useState<VarianceItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  useEffect(() => {
    fetchBrands().then(setBrands);
  }, []);

  useEffect(() => {
    const slug = brands.find((b) => b.id === selectedBrandId)?.slug;
    fetchBranches(slug).then(setBranches);
  }, [selectedBrandId, brands]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setStatus("uploading");
    setMessage(null);

    try {
      const result = await uploadExcel({
        file,
        report_type: reportType,
        brand_id: selectedBrandId ?? undefined,
        branch_id: selectedBranchId ?? undefined,
      });
      setStatus("success");
      setMessage("File ingested and archived successfully.");
      setVariances((result.variances ?? []) as VarianceItem[]);
      const msg =
        reportType === "product_sales"
          ? t("productSalesSuccess")
          :           reportType === "payments_report"
            ? t("paymentsReportSuccess")
            : t("styledHeaderToast");
      addToast(t("uploadSuccess"), msg);
      logActivity({
        action_type: "file_upload",
        page_path: "/upload-center",
        file_name: file?.name ?? "Excel",
        description: `رفع ${reportType} - ${file?.name ?? ""}`,
      });
      window.dispatchEvent(new CustomEvent("smart-ops-dashboard-refresh"));
    } catch (err: unknown) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload failed");
      setVariances([]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-slate-500">Upload Center</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Excel Archiving (Foodics Exports)</h1>
        <div className="mt-2 text-sm text-slate-600">
          Upload Hourly, Daily, or Product Sales reports exported from Foodics. The system links rows to Brand, Branch,
          and Date and exposes them to the Shift Closing and Dashboard modules.
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="glass-card space-y-4 rounded-2xl p-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-xs">
            <div className="mb-1 font-medium text-slate-600">Brand</div>
            <select
              className="glass-input w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
              value={selectedBrandId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedBrandId(v ? Number(v) : null);
                setSelectedBranchId(null);
              }}
            >
              <option value="">Select brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {getBrandDisplayName(b, lang)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs">
            <div className="mb-1 font-medium text-slate-600">Branch (optional)</div>
            <select
              className="glass-input w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
              value={selectedBranchId ?? ""}
              onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {getBranchDisplayName(b, lang)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs">
            <div className="mb-1 font-medium text-slate-600">Report Type</div>
            <select
              className="glass-input w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
              value={reportType}
              onChange={(e) =>
                setReportType(
                  e.target.value as
                    | "hourly_sales"
                    | "daily_sales"
                    | "product_sales"
                    | "payments_report"
                )
              }
            >
              <option value="hourly_sales">Hourly Sales</option>
              <option value="daily_sales">Daily Sales</option>
              <option value="product_sales">Product Sales</option>
              <option value="payments_report">Payments Report / تقرير المقبوضات</option>
            </select>
          </label>

          <label className="block text-xs">
            <div className="mb-1 font-medium text-slate-600">Excel File (.xlsx)</div>
            <input
              type="file"
              accept=".xlsx"
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-slate-800"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={!file || status === "uploading"}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {status === "uploading" ? "Uploading…" : "Upload & Process"}
        </button>

        {message && (
          <div
            className={`mt-2 rounded-lg px-3 py-2 text-xs ${
              status === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {message}
          </div>
        )}

        {variances.length > 0 && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="text-sm font-semibold text-rose-800">Auto-Discovery: Variance Mismatches</div>
            <div className="mt-2 text-xs text-rose-700">
              The following mismatches were found between Foodics data and staff entries:
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-rose-200">
                    <th className="px-2 py-1.5 text-left font-medium">Date</th>
                    <th className="px-2 py-1.5 text-left font-medium">Branch</th>
                    <th className="px-2 py-1.5 text-left font-medium">Category</th>
                    <th className="px-2 py-1.5 text-right font-medium">Cash Var</th>
                    <th className="px-2 py-1.5 text-right font-medium">Card Var</th>
                  </tr>
                </thead>
                <tbody>
                  {variances.map((v, i) => (
                    <tr key={i} className="border-b border-rose-100">
                      <td className="px-2 py-1.5">{v.date}</td>
                      <td className="px-2 py-1.5 font-medium">{v.branch_name} ({v.brand_name})</td>
                      <td className="px-2 py-1.5">
                        <span className="rounded bg-rose-200 px-1.5 py-0.5 text-rose-900">
                          {v.categories.join(", ")}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right font-medium text-rose-700">
                        {v.cash_variance !== 0 ? v.cash_variance.toFixed(2) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-medium text-rose-700">
                        {v.card_variance !== 0 ? v.card_variance.toFixed(2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </form>

      <div className="glass-card rounded-2xl border border-dashed border-white/20 p-4 text-xs text-white/60">
        The parser is tuned for standard Foodics exports. If your Excel headers differ (for example translated column
        names), we can update the column mappings in the backend `imports/parser.py` file to match your exact format.
      </div>
    </div>
  );
}

