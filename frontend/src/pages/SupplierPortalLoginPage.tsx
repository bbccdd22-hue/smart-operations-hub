/**
 * Supplier Portal — Public login
 * المورد يدخل مفتاح API ويتحقق من الهوية
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function SupplierPortalLoginPage() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!apiKey.trim()) { setError("أدخل مفتاح API"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/supplier-portal/auth/", { api_key: apiKey.trim() });
      sessionStorage.setItem("supplier_api_key", apiKey.trim());
      sessionStorage.setItem("supplier_name", res.data.supplier_name || "");
      sessionStorage.setItem("supplier_id", String(res.data.supplier_id || ""));
      navigate("/supplier-portal/dashboard");
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } };
      setError(err?.response?.status === 401 ? "مفتاح API غير صحيح" : "حدث خطأ. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const style = {
    page: { minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", direction: "rtl" as const },
    card: { background: "#1e293b", borderRadius: "1rem", padding: "2rem", width: "100%", maxWidth: 420 },
    h1: { color: "#f1f5f9", marginBottom: "0.5rem", fontSize: "1.3rem" },
    input: { width: "100%", padding: "0.75rem 1rem", background: "#0f172a", border: "1px solid #334155", borderRadius: "0.6rem", color: "#f1f5f9", fontSize: "0.95rem", marginBottom: "1rem", boxSizing: "border-box" as const },
    btn: { width: "100%", padding: "0.85rem", background: "#6366f1", color: "#fff", border: "none", borderRadius: "0.6rem", fontWeight: 600, cursor: "pointer", fontSize: "1rem" },
  };

  return (
    <div style={style.page}>
      <div style={style.card}>
        <h1 style={style.h1}>🔐 بوابة الموردين</h1>
        <p style={{ color: "#64748b", marginBottom: "1.5rem", fontSize: "0.88rem" }}>
          أدخل مفتاح API الذي حصلت عليه من إدارة المشتريات
        </p>
        {error && <div style={{ color: "#ef4444", marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</div>}
        <input
          type="password"
          placeholder="مفتاح API"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          style={style.input}
        />
        <button onClick={handleLogin} disabled={loading} style={style.btn}>
          {loading ? "جارٍ التحقق..." : "تسجيل الدخول"}
        </button>
      </div>
    </div>
  );
}
