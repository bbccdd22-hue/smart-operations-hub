/**
 * POS Table Management — /pos/tables
 * Floor plan view: table grid with status colors, click to change status
 */
import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

type TableStatus = "available" | "occupied" | "reserved" | "paid" | "cleaning";

interface Table {
  id: number;
  branch_id: number;
  number: string;
  capacity: number;
  status: TableStatus;
  status_display: string;
  section: string;
  pos_x: number;
  pos_y: number;
  is_active: boolean;
  notes: string;
  current_sale_id: number | null;
  current_sale_number: string | null;
  current_sale_total: number | null;
}

const STATUS_COLORS: Record<TableStatus, { bg: string; border: string; label: string }> = {
  available: { bg: "#14532d", border: "#22c55e", label: "فارغة" },
  occupied:  { bg: "#7c2d12", border: "#f97316", label: "محتلة" },
  reserved:  { bg: "#1e3a5f", border: "#3b82f6", label: "محجوزة" },
  paid:      { bg: "#4c1d95", border: "#8b5cf6", label: "مدفوعة" },
  cleaning:  { bg: "#374151", border: "#9ca3af", label: "تنظيف" },
};

const STATUS_CYCLE: TableStatus[] = ["available", "occupied", "reserved", "paid", "cleaning"];

function TableCard({ table, onStatusChange }: { table: Table; onStatusChange: (id: number, next: TableStatus) => void }) {
  const colors = STATUS_COLORS[table.status] || STATUS_COLORS.available;
  const nextStatus = STATUS_CYCLE[(STATUS_CYCLE.indexOf(table.status) + 1) % STATUS_CYCLE.length];

  return (
    <div
      onClick={() => onStatusChange(table.id, nextStatus)}
      style={{
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: "0.75rem",
        padding: "1rem",
        cursor: "pointer",
        minWidth: 120,
        minHeight: 100,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "transform 0.15s",
        userSelect: "none",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <span style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff" }}>
          {table.number}
        </span>
        <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
          {table.capacity} أشخاص
        </span>
      </div>

      <div>
        <div
          style={{
            display: "inline-block",
            padding: "0.15rem 0.5rem",
            borderRadius: "0.4rem",
            background: colors.border + "33",
            color: colors.border,
            fontSize: "0.75rem",
            fontWeight: 600,
            marginBottom: "0.25rem",
          }}
        >
          {table.status_display}
        </div>
        {table.current_sale_total !== null && (
          <div style={{ color: "#fbbf24", fontSize: "0.75rem", fontWeight: 700 }}>
            {table.current_sale_total.toFixed(2)} ر.س
          </div>
        )}
        {table.section && (
          <div style={{ color: "#64748b", fontSize: "0.7rem" }}>{table.section}</div>
        )}
      </div>
    </div>
  );
}

function AddTableModal({ branchId, onClose, onAdd }: { branchId: number; onClose: () => void; onAdd: () => void }) {
  const [form, setForm] = useState({ number: "", capacity: "4", section: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.number) { setError("رقم الطاولة مطلوب"); return; }
    setLoading(true);
    try {
      await api.post("/pos/tables/", { branch_id: branchId, ...form, capacity: Number(form.capacity) });
      onAdd();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail || "خطأ في الإضافة");
    } finally {
      setLoading(false);
    }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.65rem 0.85rem", background: "#0f172a",
    border: "1px solid #334155", borderRadius: "0.6rem", color: "#f1f5f9",
    fontSize: "0.9rem", boxSizing: "border-box", marginBottom: "0.75rem",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
    }}>
      <div style={{ background: "#1e293b", borderRadius: "1rem", padding: "1.5rem", width: 340, direction: "rtl" }}>
        <h3 style={{ margin: "0 0 1rem", color: "#f1f5f9" }}>إضافة طاولة جديدة</h3>
        {error && <div style={{ color: "#ef4444", marginBottom: "0.75rem", fontSize: "0.85rem" }}>{error}</div>}
        <input style={inp} placeholder="رقم الطاولة (مثل: T1 أو VIP-3)" value={form.number}
          onChange={(e) => setForm(f => ({ ...f, number: e.target.value }))} />
        <input style={inp} type="number" placeholder="السعة (عدد الأشخاص)" value={form.capacity}
          onChange={(e) => setForm(f => ({ ...f, capacity: e.target.value }))} />
        <input style={inp} placeholder="القسم (اختياري: داخلي، VIP...)" value={form.section}
          onChange={(e) => setForm(f => ({ ...f, section: e.target.value }))} />
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <button onClick={submit} disabled={loading}
            style={{ flex: 1, padding: "0.65rem", background: "#6366f1", color: "#fff", border: "none", borderRadius: "0.6rem", cursor: "pointer", fontWeight: 600 }}>
            {loading ? "جارٍ الإضافة..." : "إضافة"}
          </button>
          <button onClick={onClose}
            style={{ flex: 1, padding: "0.65rem", background: "#334155", color: "#94a3b8", border: "none", borderRadius: "0.6rem", cursor: "pointer" }}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PosTablesPage() {
  const { user } = useAuth();
  const branchId = user?.branch_id as number | undefined;
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const load = useCallback(() => {
    if (!branchId) return;
    api.get(`/pos/tables/?branch_id=${branchId}`)
      .then(r => setTables(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 15s
  useEffect(() => {
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const handleStatusChange = async (tableId: number, newStatus: TableStatus) => {
    try {
      await api.post(`/pos/tables/${tableId}/status/`, { status: newStatus });
      setStatusMsg(`الطاولة → ${STATUS_COLORS[newStatus].label}`);
      setTimeout(() => setStatusMsg(""), 2000);
      load();
    } catch (e) {
      console.error(e);
    }
  };

  // Group by section
  const sections = [...new Set(tables.map(t => t.section || "الصالة الرئيسية"))];
  const counts = {
    available: tables.filter(t => t.status === "available").length,
    occupied:  tables.filter(t => t.status === "occupied").length,
    reserved:  tables.filter(t => t.status === "reserved").length,
  };

  return (
    <div style={{
      background: "#0f172a", minHeight: "100vh", padding: "2rem",
      color: "#f1f5f9", fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>🍽️ إدارة الطاولات</h1>
          <p style={{ color: "#64748b", margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
            انقر على الطاولة لتغيير حالتها
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            padding: "0.65rem 1.5rem", background: "#6366f1", color: "#fff",
            border: "none", borderRadius: "0.75rem", cursor: "pointer", fontWeight: 600,
          }}
        >
          + طاولة جديدة
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {[
          { label: "فارغة", count: counts.available, color: "#22c55e" },
          { label: "محتلة", count: counts.occupied, color: "#f97316" },
          { label: "محجوزة", count: counts.reserved, color: "#3b82f6" },
          { label: "الإجمالي", count: tables.length, color: "#6366f1" },
        ].map(item => (
          <div key={item.label} style={{
            background: "#1e293b", borderRadius: "0.75rem", padding: "0.75rem 1.25rem",
            display: "flex", alignItems: "center", gap: "0.5rem",
          }}>
            <span style={{ color: item.color, fontWeight: 800, fontSize: "1.3rem" }}>{item.count}</span>
            <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{item.label}</span>
          </div>
        ))}
        {statusMsg && (
          <div style={{
            background: "#14532d", borderRadius: "0.75rem", padding: "0.75rem 1.25rem",
            color: "#22c55e", fontSize: "0.85rem", fontWeight: 600,
          }}>
            ✓ {statusMsg}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {Object.entries(STATUS_COLORS).map(([key, val]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: val.border }} />
            <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{val.label}</span>
          </div>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", color: "#64748b", padding: "3rem" }}>جارٍ التحميل...</div>}

      {/* Tables by section */}
      {!loading && sections.map(section => {
        const sectionTables = tables.filter(t => (t.section || "الصالة الرئيسية") === section);
        return (
          <div key={section} style={{ marginBottom: "2rem" }}>
            <h3 style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {section} ({sectionTables.length} طاولة)
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              {sectionTables.map(t => (
                <TableCard key={t.id} table={t} onStatusChange={handleStatusChange} />
              ))}
            </div>
          </div>
        );
      })}

      {!loading && !tables.length && (
        <div style={{ textAlign: "center", color: "#64748b", padding: "4rem 0" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🍽️</div>
          <p>لا توجد طاولات بعد. انقر "+ طاولة جديدة" لإضافة أول طاولة.</p>
        </div>
      )}

      {showAdd && branchId && (
        <AddTableModal branchId={branchId} onClose={() => setShowAdd(false)} onAdd={load} />
      )}
    </div>
  );
}
