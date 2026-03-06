/**
 * Supplier Portal Dashboard — PO status, GR pending, Invoice upload
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function SupplierPortalDashboardPage() {
  const navigate = useNavigate();
  const apiKey = sessionStorage.getItem("supplier_api_key");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoiceForm, setInvoiceForm] = useState({ invoice_number: "", total_amount: "", notes: "" });
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);

  useEffect(() => {
    if (!apiKey) {
      navigate("/supplier-portal/login");
      return;
    }
    api
      .get("/supplier-portal/dashboard/", { headers: { "X-Supplier-API-Key": apiKey } })
      .then((r) => setData(r.data))
      .catch(() => navigate("/supplier-portal/login"))
      .finally(() => setLoading(false));
  }, [apiKey, navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem("supplier_api_key");
    sessionStorage.removeItem("supplier_name");
    sessionStorage.removeItem("supplier_id");
    navigate("/supplier-portal/login");
  };

  const handleInvoiceSubmit = async () => {
    if (!apiKey || !invoiceForm.invoice_number || !invoiceForm.total_amount) return;
    setInvoiceSubmitting(true);
    try {
      await api.post("/supplier-portal/invoice/", {
        invoice_number: invoiceForm.invoice_number,
        total_amount: invoiceForm.total_amount,
        notes: invoiceForm.notes,
      }, { headers: { "X-Supplier-API-Key": apiKey } });
      setInvoiceForm({ invoice_number: "", total_amount: "", notes: "" });
      const r = await api.get("/supplier-portal/dashboard/", { headers: { "X-Supplier-API-Key": apiKey } });
      setData(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  const card = { background: "#1e293b", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1rem" };
  const tableStyle = { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.85rem" };
  const thStyle = { color: "#94a3b8", padding: "0.5rem", textAlign: "right" as const };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", padding: "2rem", color: "#f1f5f9", direction: "rtl" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>📦 لوحة المورد — {(data as { supplier_name?: string })?.supplier_name || "..."}</h1>
        <button onClick={handleLogout} style={{ padding: "0.5rem 1rem", background: "#334155", color: "#94a3b8", border: "none", borderRadius: "0.5rem", cursor: "pointer" }}>تسجيل الخروج</button>
      </div>

      {loading && <div style={{ color: "#64748b" }}>جارٍ التحميل...</div>}

      {!loading && data && (
        <>
          <div style={card}>
            <h3 style={{ margin: "0 0 1rem", color: "#94a3b8" }}>أوامر الشراء</h3>
            <table style={tableStyle}>
              <thead><tr>{["رقم الأمر", "التاريخ", "الحالة"].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {((data.purchase_orders as Array<{ order_number: string; order_date: string; status: string }>) || []).map((p) => (
                  <tr key={p.id} style={{ borderTop: "1px solid #334155" }}>
                    <td style={{ padding: "0.5rem" }}>{p.order_number}</td>
                    <td style={{ padding: "0.5rem" }}>{p.order_date}</td>
                    <td style={{ padding: "0.5rem" }}>{p.status}</td>
                  </tr>
                ))}
                {(!(data.purchase_orders as unknown[])?.length) && <tr><td colSpan={3} style={{ padding: "1rem", color: "#64748b", textAlign: "center" }}>لا توجد أوامر</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={card}>
            <h3 style={{ margin: "0 0 1rem", color: "#94a3b8" }}>استلامات بضاعة قيد الانتظار</h3>
            <table style={tableStyle}>
              <thead><tr>{["رقم الاستلام", "أمر الشراء", "التاريخ"].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {((data.goods_receipts_pending as Array<{ receipt_number: string; po_number: string; receipt_date: string }>) || []).map((g) => (
                  <tr key={g.id} style={{ borderTop: "1px solid #334155" }}>
                    <td style={{ padding: "0.5rem" }}>{g.receipt_number}</td>
                    <td style={{ padding: "0.5rem" }}>{g.po_number}</td>
                    <td style={{ padding: "0.5rem" }}>{g.receipt_date}</td>
                  </tr>
                ))}
                {(!(data.goods_receipts_pending as unknown[])?.length) && <tr><td colSpan={3} style={{ padding: "1rem", color: "#64748b", textAlign: "center" }}>لا توجد استلامات</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={card}>
            <h3 style={{ margin: "0 0 1rem", color: "#94a3b8" }}>رفع فاتورة جديدة</h3>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div><label style={{ display: "block", color: "#94a3b8", fontSize: "0.78rem", marginBottom: "0.25rem" }}>رقم الفاتورة</label>
                <input value={invoiceForm.invoice_number} onChange={(e) => setInvoiceForm(f => ({ ...f, invoice_number: e.target.value }))} style={{ padding: "0.5rem", background: "#0f172a", border: "1px solid #334155", borderRadius: "0.5rem", color: "#f1f5f9", width: 140 }} />
              </div>
              <div><label style={{ display: "block", color: "#94a3b8", fontSize: "0.78rem", marginBottom: "0.25rem" }}>المبلغ (ر.س)</label>
                <input type="number" value={invoiceForm.total_amount} onChange={(e) => setInvoiceForm(f => ({ ...f, total_amount: e.target.value }))} style={{ padding: "0.5rem", background: "#0f172a", border: "1px solid #334155", borderRadius: "0.5rem", color: "#f1f5f9", width: 120 }} />
              </div>
              <button onClick={handleInvoiceSubmit} disabled={invoiceSubmitting} style={{ padding: "0.5rem 1rem", background: "#22c55e", color: "#fff", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: 600 }}>
                {invoiceSubmitting ? "جارٍ..." : "إرسال"}
              </button>
            </div>
          </div>

          <div style={card}>
            <h3 style={{ margin: "0 0 1rem", color: "#94a3b8" }}>آخر الفواتير</h3>
            <table style={tableStyle}>
              <thead><tr>{["رقم الفاتورة", "التاريخ", "المبلغ"].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {((data.recent_invoices as Array<{ invoice_number: string; invoice_date: string; total_amount: string }>) || []).map((i) => (
                  <tr key={i.id} style={{ borderTop: "1px solid #334155" }}>
                    <td style={{ padding: "0.5rem" }}>{i.invoice_number}</td>
                    <td style={{ padding: "0.5rem" }}>{i.invoice_date}</td>
                    <td style={{ padding: "0.5rem" }}>{i.total_amount} ر.س</td>
                  </tr>
                ))}
                {(!(data.recent_invoices as unknown[])?.length) && <tr><td colSpan={3} style={{ padding: "1rem", color: "#64748b", textAlign: "center" }}>لا توجد فواتير</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
