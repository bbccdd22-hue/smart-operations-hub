import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useNotifications } from "../contexts/NotificationContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  parsePreview,
  uploadExcel,
  batchUploadExcel,
  fetchUploadAnalytics,
  fetchUploadStatus,
  fetchBrands,
  fetchBranches,
  logActivity,
  type ParsePreviewResponse,
  type UploadAnalytics,
  type Brand,
  type Branch,
} from "../lib/api";

const DB_FIELDS = [
  { key: "brand", label: "Brand" },
  { key: "branch", label: "Branch" },
  { key: "date", label: "Date" },
  { key: "total_sales", label: "Net Sales" },
  { key: "cash", label: "Cash" },
  { key: "network", label: "Cards/Network" },
  { key: "order_count", label: "Order Count / عدد الطلبات" },
  { key: "hour", label: "Hour" },
  { key: "product", label: "Product" },
  { key: "qty", label: "Qty" },
];

const COLORS = ["#7c3aed", "#00b074", "#3b82f6", "#f59e0b"];

const BRAND_COLORS: Record<string, string> = {
  "8oz": "#7c3aed",
  blanca: "#00b074",
  hemi: "#3b82f6",
  "sweet bread": "#f59e0b",
  "tea plus": "#06b6d4",
  chart: "#ec4899",
};

function getBrandAccent(slug: string | undefined): string {
  if (!slug) return "#7c3aed";
  return BRAND_COLORS[slug.toLowerCase()] ?? "#7c3aed";
}

export default function SmartUploadPage() {
  const { t } = useTranslation();
  const { addToast } = useNotifications() ?? { addToast: () => {} };
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<ParsePreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [reportType, setReportType] = useState<string>("daily_sales");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadId, setUploadId] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ pct: number; message: string } | null>(null);
  const [analytics, setAnalytics] = useState<UploadAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  type FilePreview = {
    file: File;
    preview: ParsePreviewResponse | null;
    error?: string;
    status: "parsing" | "ready" | "error";
  };

  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [batchFiles, setBatchFiles] = useState<FilePreview[]>([]);
  const [batchSummary, setBatchSummary] = useState<{
    success: number;
    failed: number;
    total_sales_sar: number;
    brands: string[];
    failed_files?: Array<{ file: string; error?: string }>;
  } | null>(null);
  const [showBatchMode, setShowBatchMode] = useState(false);
  const [expandedFileIdx, setExpandedFileIdx] = useState<number | null>(null);
  const brandSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    fetchBrands().then(setBrands);
  }, []);
  useEffect(() => {
    brandSelectRef.current?.focus();
  }, [brands.length]);
  useEffect(() => {
    fetchBranches(selectedBrandId ? brands.find((b) => b.id === selectedBrandId)?.slug : undefined).then(setBranches);
    setSelectedBranchId(null);
  }, [selectedBrandId, brands]);

  useEffect(() => {
    if (preview?.detected_brand && brands.length) {
      const b = brands.find((x) => x.slug === preview.detected_brand);
      if (b) setSelectedBrandId(b.id);
    }
  }, [preview?.detected_brand, brands]);

  const processFiles = useCallback((files: File[]) => {
    if (!selectedBrandId) {
      setError("Select a brand first before uploading.");
      return;
    }
    const valid = files.filter((f) => {
      const n = f.name.toLowerCase();
      return n.endsWith(".xlsx") || n.endsWith(".csv") || n.endsWith(".pdf");
    });
    if (valid.length === 0) {
      setError("Use .xlsx, .csv, or .pdf");
      return;
    }
    setError(null);
    setBatchSummary(null);
    if (valid.length === 1) {
      setFile(valid[0]);
      setBatchFiles([]);
      setShowBatchMode(false);
      setLoading(true);
        parsePreview(valid[0])
        .then((p) => {
          setPreview(p);
          setMapping(p.mapping || {});
          setReportType(p.suggested_report_type || "daily_sales");
        })
        .catch((err) => setError(err?.message || "Parse failed"))
        .finally(() => setLoading(false));
      return;
    }
    setFile(null);
    setPreview(null);
    setShowBatchMode(true);
    const items: FilePreview[] = valid.map((f) => ({ file: f, preview: null, status: "parsing" }));
    setBatchFiles(items);
    valid.forEach((f, i) => {
      parsePreview(f)
        .then((p) => {
          setBatchFiles((prev) => {
            const next = [...prev];
            if (next[i]) next[i] = { file: f, preview: p, status: "ready" };
            return next;
          });
        })
        .catch((err) => {
          setBatchFiles((prev) => {
            const next = [...prev];
            if (next[i]) next[i] = { file: f, preview: null, error: err?.message, status: "error" };
            return next;
          });
        });
    });
  }, [selectedBrandId]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      processFiles(Array.from(e.dataTransfer.files || []));
    },
    [processFiles]
  );

  const handleBatchConfirm = async () => {
    if (!selectedBrandId) {
      setError("Select a brand before uploading.");
      return;
    }
    const toUpload = batchFiles.filter((f) => f.status === "ready" && f.file);
    const clientFailed = batchFiles.filter((f) => f.status === "error");
    if (toUpload.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const result = await batchUploadExcel(toUpload.map((f) => f.file), {
        brand_id: selectedBrandId,
        branch_id: selectedBranchId,
      });
      const serverFailed = result.results?.filter((r) => r.status === "error") ?? [];
      const allFailed = [
        ...serverFailed.map((r) => ({ file: r.file, error: r.error })),
        ...clientFailed.map((f) => ({ file: f.file.name, error: f.error })),
      ];
      setBatchSummary({
        ...result.summary,
        failed_files: allFailed,
      });
      if ((result.summary?.success ?? 0) > 0) {
        addToast(t("uploadSuccess"), t("styledHeaderToast"));
        logActivity({
          action_type: "file_upload",
          page_path: "/admin-hub/smart-upload",
          file_name: toUpload.map((f) => f.file.name).join(", "),
          description: `رفع جماعي - ${result.summary?.success ?? 0} ملف`,
        });
        window.dispatchEvent(new CustomEvent("smart-ops-dashboard-refresh"));
      }
      setShowBatchMode(false);
      setBatchFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err || "Batch upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) processFiles(files);
    e.target.value = "";
  };

  const handleConfirm = async () => {
    if (!file || !selectedBrandId) {
      setError("Select a brand before uploading.");
      return;
    }
    setUploading(true);
    setError(null);
    setUploadProgress(null);
    try {
      const result = await uploadExcel({
        file,
        report_type: reportType,
        column_mapping: mapping,
        brand_id: selectedBrandId,
        branch_id: selectedBranchId,
      });
      setUploadId(result.id);
      if (result.status === "processing") {
        setUploadProgress({ pct: result.progress_pct ?? 0, message: result.progress_message ?? "" });
        const poll = async (): Promise<void> => {
          const key = result.uuid ?? result.id;
          const status = await fetchUploadStatus(key);
          setUploadProgress({ pct: status.progress_pct ?? 0, message: status.progress_message ?? "" });
          if (status.status === "processed") {
            const msg =
              reportType === "product_sales"
                ? t("productSalesSuccess")
                : reportType === "payments_report"
                  ? t("paymentsReportSuccess")
                  : t("styledHeaderToast");
            addToast(t("uploadSuccess"), msg);
            logActivity({
              action_type: "file_upload",
              page_path: "/admin-hub/smart-upload",
              file_name: file?.name ?? "",
              description: `رفع ${reportType} - ${file?.name ?? ""}`,
            });
            window.dispatchEvent(new CustomEvent("smart-ops-dashboard-refresh"));
            const analyticsData = await fetchUploadAnalytics(key);
            setAnalytics(analyticsData);
            setUploading(false);
            setUploadProgress(null);
            return;
          }
          if (status.status === "failed") {
            setError(status.error_message ?? "Upload failed");
            setUploading(false);
            setUploadProgress(null);
            return;
          }
          setTimeout(poll, 1500);
        };
        setTimeout(poll, 1500);
        return;
      }
      const msg =
        reportType === "product_sales"
          ? t("productSalesSuccess")
          : reportType === "payments_report"
            ? t("paymentsReportSuccess")
            : t("styledHeaderToast");
      addToast(t("uploadSuccess"), msg);
      logActivity({
        action_type: "file_upload",
        page_path: "/admin-hub/smart-upload",
        file_name: file?.name ?? "",
        description: `رفع ${reportType} - ${file?.name ?? ""}`,
      });
      window.dispatchEvent(new CustomEvent("smart-ops-dashboard-refresh"));
      const analyticsData = await fetchUploadAnalytics(result.uuid ?? result.id);
      setAnalytics(analyticsData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || "Upload failed");
      setError(msg);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const exportPdf = async () => {
    const el = document.getElementById("analytics-export-area");
    if (!el) return;
    const canvas = await html2canvas(el, { useCORS: true, backgroundColor: "#ffffff", scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, w, h);
    pdf.save(`brand-performance-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportPng = async () => {
    const el = document.getElementById("analytics-export-area");
    if (!el) return;
    const canvas = await html2canvas(el, { useCORS: true, backgroundColor: "#ffffff", scale: 2 });
    const link = document.createElement("a");
    link.download = `brand-performance-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const mappedColumns = preview?.columns?.filter((c) =>
    Object.values(mapping).some((v) => v === c)
  ) ?? [];

  const selectedBrand = brands.find((b) => b.id === selectedBrandId);
  const brandAccent = getBrandAccent(selectedBrand?.slug);

  return (
    <div className="min-h-[calc(100vh-8rem)] space-y-6">
      <div>
        <Link to="/admin-hub" className="text-sm text-white/70 hover:text-white">
          ← {t("adminDashboard")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Smart File Upload</h1>
        <p className="mt-1 text-sm text-white/60">
          Select a brand first, then drag & drop Excel, CSV, or PDF files.
        </p>
      </div>

      {/* Mandatory Brand Selection */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-5"
        style={{
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white/90">{t("brand")} *</span>
            <select
              ref={brandSelectRef}
              value={selectedBrandId ?? ""}
              onChange={(e) => {
                setSelectedBrandId(e.target.value ? Number(e.target.value) : null);
                setError(null);
              }}
              className="glass-input min-w-[180px] rounded-xl px-4 py-2.5 text-white"
              style={{
                borderColor: selectedBrand ? `${brandAccent}40` : undefined,
              }}
            >
              <option value="">— Select Brand —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
          {selectedBrand && (
            <div className="flex items-center gap-2 text-sm text-white/70">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: brandAccent }}
              />
              <span>Selected Brand: <strong className="text-white/95">{selectedBrand.name}</strong></span>
              <span className="text-white/40">|</span>
              <span>Identity: SAIF</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Drag & Drop Zone */}
      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          if (selectedBrandId) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (selectedBrandId) handleDrop(e);
        }}
        animate={{
          scale: dragOver ? 1.02 : 1,
          boxShadow: selectedBrandId
            ? (dragOver ? `0 0 40px ${brandAccent}66` : `0 8px 32px rgba(0,0,0,0.37)`)
            : "0 8px 32px rgba(0,0,0,0.37)",
        }}
        className={`glass-card rounded-2xl border-2 border-dashed p-12 transition ${
          selectedBrandId
            ? `cursor-pointer ${dragOver ? "bg-white/5" : "hover:border-white/40"}`
            : "cursor-not-allowed opacity-75"
        }`}
        style={{
          borderColor: selectedBrandId
            ? (dragOver ? brandAccent : "rgba(255,255,255,0.2)")
            : "rgba(255,255,255,0.15)",
        }}
      >
        <input
          type="file"
          accept=".xlsx,.csv,.pdf"
          multiple
          className="hidden"
          id="file-upload"
          onChange={handleFileInput}
          disabled={!selectedBrandId}
        />
        {selectedBrandId ? (
          <label htmlFor="file-upload" className="flex cursor-pointer flex-col items-center gap-3">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: `${brandAccent}30` }}
            >
              📁
            </div>
            <div className="text-center font-medium text-white/95">
              {loading ? "Parsing…" : showBatchMode && batchFiles.length ? `Processing ${batchFiles.length} files…` : "Drop Excel, CSV, or PDF here (multiple ok)"}
            </div>
            <div className="text-sm text-white/60">or click to browse • Supports batch upload</div>
          </label>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="text-4xl opacity-50">📁</div>
            <div className="text-center font-medium text-white/70">Select a brand above to enable upload</div>
            <div className="text-sm text-white/50">Upload & Process requires brand selection</div>
          </div>
        )}
      </motion.div>

      {error && (
        <div className="rounded-xl bg-rose-500/20 px-4 py-3 text-sm text-rose-200">{error}</div>
      )}

      {/* Batch Progress List (Glassmorphism) */}
      <AnimatePresence>
        {showBatchMode && batchFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card overflow-hidden rounded-2xl"
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.37)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div className="border-b border-white/10 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Batch Processing ({batchFiles.length} files)</h2>
              <p className="mt-1 text-sm text-white/60">
                {batchFiles.filter((f) => f.status === "ready").length} ready • {batchFiles.filter((f) => f.status === "error").length} failed • {batchFiles.filter((f) => f.status === "parsing").length} parsing
              </p>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto p-4">
              {batchFiles.map((fp, i) => (
                <div key={fp.file.name + i} className="space-y-0">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                    fp.status === "error"
                      ? "bg-rose-500/20 border border-rose-500/40"
                      : fp.status === "ready"
                        ? "bg-white/5 border border-white/10"
                        : "bg-white/5 border border-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{fp.status === "parsing" ? "⏳" : fp.status === "error" ? "❌" : "✅"}</span>
                    <div>
                      <div className="font-medium text-white/95">{fp.file.name}</div>
                      <div className="text-xs text-white/60">
                        {fp.status === "parsing" && "Parsing…"}
                        {fp.status === "ready" && fp.preview && (
                          <>Brand: {fp.preview.detected_brand || "—"} • {fp.preview.total_rows} rows • {fp.preview.suggested_report_type}</>
                        )}
                        {fp.status === "error" && fp.error}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedFileIdx(expandedFileIdx === i ? null : i)}
                    className="text-xs text-white/60 hover:text-white"
                  >
                    {expandedFileIdx === i ? "Hide" : "Details"}
                  </button>
                </motion.div>
                {expandedFileIdx === i && fp.preview && (
                  <div className="ml-11 mt-2 rounded-lg bg-black/20 p-3 text-xs">
                    <div className="mb-2 font-medium text-white/80">Preview (first 5 rows)</div>
                    <table className="w-full text-white/70">
                      <thead>
                        <tr className="border-b border-white/20">
                          {fp.preview.columns.slice(0, 6).map((c) => (
                            <th key={c} className="px-2 py-1 text-left">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fp.preview.rows.slice(0, 5).map((row, ri) => (
                          <tr key={ri} className="border-b border-white/5">
                            {fp.preview!.columns.slice(0, 6).map((c) => (
                              <td key={c} className="px-2 py-1">{String(row[c] ?? "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                </div>
              ))}
            </div>
            {batchFiles.some((f) => f.status === "error") && (
              <div
                className="mx-4 mb-4 rounded-xl px-4 py-3"
                style={{
                  background: "rgba(244, 63, 94, 0.15)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(244, 63, 94, 0.4)",
                }}
              >
                <div className="font-medium text-rose-200">Failed files</div>
                <ul className="mt-1 list-inside list-disc text-sm text-rose-200/90">
                  {batchFiles.filter((f) => f.status === "error").map((f, i) => (
                    <li key={i}>{f.file.name}: {f.error || "Unknown error"}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4 border-t border-white/10 p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/70">{t("brand")}:</span>
                <select
                  value={selectedBrandId ?? ""}
                  onChange={(e) => setSelectedBrandId(e.target.value ? Number(e.target.value) : null)}
                  className="glass-input rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="">Auto (filename)</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/70">{t("branch")}:</span>
                <select
                  value={selectedBranchId ?? ""}
                  onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : null)}
                  className="glass-input rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="">Auto</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleBatchConfirm}
                disabled={uploading || !selectedBrandId || batchFiles.filter((f) => f.status === "ready").length === 0}
                className="rounded-xl bg-[#7c3aed] px-6 py-2 font-medium text-white transition hover:bg-[#6d28d9] disabled:opacity-50"
              >
                {uploading ? "Uploading…" : `Confirm & Upload ${batchFiles.filter((f) => f.status === "ready").length} file(s)`}
              </button>
              <button
                type="button"
                onClick={() => { setShowBatchMode(false); setBatchFiles([]); setBatchSummary(null); }}
                className="glass-btn rounded-xl px-4 py-2 text-sm text-white/90"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Summary (Unified Preview) */}
      <AnimatePresence>
        {batchSummary && !showBatchMode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card overflow-hidden rounded-2xl"
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.37)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div className="border-b border-white/10 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Batch Summary</h2>
              <p className="mt-2 text-white/95">
                Successfully processed <strong>{batchSummary.success}</strong> file(s).
                {batchSummary.total_sales_sar > 0 && (
                  <> Total Sales: <strong>{batchSummary.total_sales_sar.toLocaleString()} SAR</strong>.</>
                )}
                {batchSummary.brands.length > 0 && (
                  <> Brands impacted: <strong>{batchSummary.brands.join(", ")}</strong>.</>
                )}
              </p>
              {batchSummary.failed > 0 && (
                <div
                  className="mt-3 rounded-xl px-4 py-3"
                  style={{
                    background: "rgba(244, 63, 94, 0.15)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(244, 63, 94, 0.4)",
                  }}
                >
                  <div className="font-medium text-rose-200">Failed files ({batchSummary.failed})</div>
                  <ul className="mt-1 list-inside list-disc text-sm text-rose-200/90">
                    {(batchSummary.failed_files ?? []).map((f, i) => (
                      <li key={i}>{f.file}: {f.error || "Unknown error"}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 p-4">
              <button
                type="button"
                onClick={() => setBatchSummary(null)}
                className="glass-btn rounded-xl px-4 py-2 text-sm text-white/90"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Table */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card overflow-hidden rounded-2xl"
          >
            <div className="border-b border-white/10 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">
                Found {preview.total_rows} rows, {preview.columns.length} columns
              </h2>
              <p className="mt-1 text-sm text-white/60">
                Detected brand: {preview.detected_brand || "—"} • Is this correct?
              </p>
            </div>
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="glass-table-header border-b">
                    {preview.columns.map((col) => (
                      <th
                        key={col}
                        className={`px-3 py-2 text-left font-semibold ${
                          mappedColumns.includes(col) ? "bg-[#7c3aed]/30 text-[#c4b5fd]" : "text-white/90"
                        }`}
                      >
                        {col}
                        <select
                          value={(mapping ? Object.entries(mapping).find(([, v]) => v === col)?.[0] : null) ?? ""}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            const next = { ...mapping };
                            for (const k of Object.keys(next)) {
                              if (next[k] === col) delete next[k];
                            }
                            if (val) next[val] = col;
                            setMapping(next);
                          }}
                          className="ml-1 mt-1 rounded border border-white/20 bg-white/10 px-2 py-0.5 text-xs text-white"
                        >
                          <option value="">— Map to —</option>
                          {DB_FIELDS.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {preview.columns.map((col) => (
                        <td key={col} className="px-3 py-2 text-white/80">
                          {row[col] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.error_rows.length > 0 && (
              <div className="border-t border-rose-500/30 bg-rose-500/10 px-6 py-3 text-sm text-rose-200">
                ⚠ Rows with missing date/amount: {preview.error_rows.length} (first 10 shown)
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4 border-t border-white/10 p-4">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="glass-input rounded-xl px-4 py-2 text-white"
              >
                <option value="daily_sales">Daily Sales</option>
                <option value="hourly_sales">Hourly Sales</option>
                <option value="product_sales">Product Sales</option>
                <option value="payments_report">Payments Report / تقرير المقبوضات</option>
              </select>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/70">{t("brand")}:</span>
                <select
                  value={selectedBrandId ?? ""}
                  onChange={(e) => setSelectedBrandId(e.target.value ? Number(e.target.value) : null)}
                  className="glass-input rounded-xl px-4 py-2 text-white"
                >
                  <option value="">Auto (from file / filename)</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/70">{t("branch")}:</span>
                <select
                  value={selectedBranchId ?? ""}
                  onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : null)}
                  className="glass-input rounded-xl px-4 py-2 text-white"
                >
                  <option value="">Auto (from file / filename)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              {uploadProgress && (
                <div className="flex flex-1 flex-col gap-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#7c3aed] transition-all duration-300"
                      style={{ width: `${uploadProgress.pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/70">{uploadProgress.message || "جاري المعالجة…"}</span>
                </div>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={uploading || !selectedBrandId}
                className="rounded-xl bg-[#7c3aed] px-6 py-2 font-medium text-white transition hover:bg-[#6d28d9] disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Confirm & Upload"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instant Analytics */}
      <AnimatePresence>
        {analytics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-white">Instant Analytics</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={exportPdf}
                  className="glass-btn rounded-xl px-4 py-2 text-sm font-medium text-white/90"
                >
                  تصدير PDF
                </button>
                <button
                  type="button"
                  onClick={exportPng}
                  className="glass-btn rounded-xl px-4 py-2 text-sm font-medium text-white/90"
                >
                  Save as PNG
                </button>
                <a
                  href="mailto:SAAL.NQ@ICLOUD.COM?subject=Brand%20Performance%20Report&body=Please%20find%20the%20report%20attached."
                  className="glass-btn rounded-xl px-4 py-2 text-sm font-medium text-white/90"
                >
                  Share via Email
                </a>
              </div>
            </div>

            <div
              id="analytics-export-area"
              className="space-y-6 rounded-2xl bg-white p-6 text-slate-800"
            >
              <div className="border-b pb-4">
                <h3 className="text-lg font-bold">تقرير أداء العلامة التجارية</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Date Range: {analytics.date_from ?? "—"} to {analytics.date_to ?? "—"}
                </p>
                <p className="text-xs text-slate-500">
                  Generated by: SAIF (SAAL.NQ@ICLOUD.COM)
                </p>
              </div>

              {analytics.daily_series.length > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold">Daily Sales Trend</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.daily_series}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          formatter={(v: number | undefined) => [v != null ? `${v.toFixed(2)} SAR` : "", "Sales"]}
                          labelFormatter={(l) => `Date: ${l}`}
                        />
                        <Line type="monotone" dataKey="sales" stroke="#7c3aed" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {analytics.branch_performance.length > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold">Branch Performance</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.branch_performance} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" stroke="#64748b" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="branch" stroke="#64748b" width={80} />
                        <Tooltip formatter={(v: number | undefined) => [v != null ? `${v.toFixed(2)} SAR` : "", "Sales"]} />
                        <Bar dataKey="sales" fill="#00b074" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {analytics.payment_split.some((p) => p.value > 0) && (
                <div>
                  <h4 className="mb-2 font-semibold">Payment Methods</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.payment_split.filter((p) => p.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        >
                          {analytics.payment_split.filter((p) => p.value > 0).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number | undefined) => [v != null ? `${v.toFixed(2)} SAR` : "", ""]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
