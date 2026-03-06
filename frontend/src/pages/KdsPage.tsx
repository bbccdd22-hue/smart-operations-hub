/**
 * KDS - Kitchen Display System
 * شاشة المطبخ المتكاملة: pending → cooking → ready → delivered
 * Polling كل 5 ثوانٍ للتحديث الفوري
 */
import { useEffect, useRef, useState, useCallback } from "react";
import api from "../lib/api";

type KDSStatus = "pending" | "cooking" | "ready" | "delivered" | "cancelled";

interface KDSOrder {
  id: number;
  order_number: string;
  table_number: string;
  branch_name: string;
  kds_status: KDSStatus;
  kds_status_display: string;
  items: Array<{ name?: string; product_name?: string; qty: number; notes?: string }>;
  priority: number;
  notes: string;
  created_at: string;
  cooking_started_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  elapsed_cooking_seconds: number | null;
  sale_id: number | null;
}

const STATUS_CONFIG: Record<KDSStatus, { label: string; bg: string; border: string; next: KDSStatus | null; nextLabel: string }> = {
  pending:   { label: "انتظار", bg: "#1e3a5f", border: "#3b82f6", next: "cooking", nextLabel: "ابدأ التحضير →" },
  cooking:   { label: "قيد التحضير", bg: "#78350f", border: "#f59e0b", next: "ready", nextLabel: "جاهز ✓" },
  ready:     { label: "جاهز", bg: "#14532d", border: "#22c55e", next: "delivered", nextLabel: "تم التسليم ✓" },
  delivered: { label: "تم التسليم", bg: "#1e293b", border: "#475569", next: null, nextLabel: "" },
  cancelled: { label: "ملغي", bg: "#1e293b", border: "#374151", next: null, nextLabel: "" },
};

function elapsed(seconds: number | null): string {
  if (seconds === null) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeSince(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}ث`;
  if (diff < 3600) return `${Math.floor(diff / 60)}د`;
  return `${Math.floor(diff / 3600)}س`;
}

function OrderCard({ order, onAdvance }: { order: KDSOrder; onAdvance: (id: number) => void }) {
  const cfg = STATUS_CONFIG[order.kds_status] || STATUS_CONFIG.pending;
  const isPriority = order.priority > 0;

  return (
    <div
      style={{
        background: cfg.bg,
        border: `2px solid ${cfg.border}`,
        borderRadius: "1rem",
        padding: "1rem",
        marginBottom: "0.75rem",
        position: "relative",
        boxShadow: isPriority ? `0 0 12px ${cfg.border}66` : "none",
        animation: order.kds_status === "ready" ? "pulse 1.5s infinite" : "none",
      }}
    >
      {isPriority && (
        <div style={{
          position: "absolute", top: -8, right: 12,
          background: "#ef4444", color: "#fff", fontSize: "0.65rem",
          fontWeight: 700, padding: "2px 8px", borderRadius: "9999px",
        }}>
          PRIORITY
        </div>
      )}

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#f1f5f9" }}>
            #{order.order_number}
          </span>
          {order.table_number && (
            <span style={{ marginRight: "0.5rem", color: "#94a3b8", fontSize: "0.85rem" }}>
              طاولة {order.table_number}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {order.elapsed_cooking_seconds !== null && (
            <span style={{
              fontFamily: "monospace", fontSize: "1rem", fontWeight: 700,
              color: order.elapsed_cooking_seconds > 600 ? "#ef4444" : "#f59e0b",
            }}>
              ⏱ {elapsed(order.elapsed_cooking_seconds)}
            </span>
          )}
          <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
            {timeSince(order.created_at)} مضى
          </span>
        </div>
      </div>

      {/* Items */}
      <div style={{ marginBottom: "0.75rem" }}>
        {order.items.map((item, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between",
            padding: "0.3rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
            fontSize: "0.88rem",
          }}>
            <span style={{ color: "#e2e8f0" }}>
              <strong style={{ color: "#fbbf24" }}>{item.qty}×</strong>{" "}
              {item.name || item.product_name || "صنف"}
            </span>
            {item.notes && (
              <span style={{ color: "#94a3b8", fontSize: "0.78rem" }}>📝 {item.notes}</span>
            )}
          </div>
        ))}
      </div>

      {/* Notes */}
      {order.notes && (
        <div style={{
          background: "#0f172a", borderRadius: "0.5rem", padding: "0.5rem 0.75rem",
          color: "#fbbf24", fontSize: "0.8rem", marginBottom: "0.75rem",
        }}>
          ملاحظة: {order.notes}
        </div>
      )}

      {/* Action button */}
      {cfg.next && (
        <button
          onClick={() => onAdvance(order.id)}
          style={{
            width: "100%", padding: "0.6rem", background: cfg.border + "33",
            border: `1px solid ${cfg.border}`, borderRadius: "0.6rem",
            color: cfg.border, cursor: "pointer", fontWeight: 700, fontSize: "0.88rem",
          }}
        >
          {cfg.nextLabel}
        </button>
      )}
    </div>
  );
}

function Column({ status, orders, onAdvance }: {
  status: KDSStatus;
  orders: KDSOrder[];
  onAdvance: (id: number) => void;
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div style={{ flex: 1, minWidth: 280 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "1rem", paddingBottom: "0.75rem",
        borderBottom: `2px solid ${cfg.border}`,
      }}>
        <h3 style={{ margin: 0, color: cfg.border, fontSize: "1rem", fontWeight: 700 }}>
          {cfg.label}
        </h3>
        <span style={{
          background: cfg.border + "22", color: cfg.border,
          borderRadius: "9999px", padding: "0.15rem 0.6rem",
          fontWeight: 700, fontSize: "0.85rem",
        }}>
          {orders.length}
        </span>
      </div>
      {orders.map(o => (
        <OrderCard key={o.id} order={o} onAdvance={onAdvance} />
      ))}
      {!orders.length && (
        <div style={{ textAlign: "center", color: "#334155", padding: "2rem 0", fontSize: "0.85rem" }}>
          لا توجد طلبات
        </div>
      )}
    </div>
  );
}

export default function KdsPage() {
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [stats, setStats] = useState<{ pending: number; cooking: number; ready: number; delivered: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    const params = branchId ? `?branch_id=${branchId}&status=pending,cooking,ready` : "?status=pending,cooking,ready";
    api.get(`/pos/kds/${params}`)
      .then(r => {
        setOrders(r.data);
        setLastUpdate(new Date().toLocaleTimeString("ar"));
      })
      .catch(console.error);

    if (branchId) {
      api.get(`/pos/kds/stats/?branch_id=${branchId}`)
        .then(r => setStats(r.data))
        .catch(() => {});
    }
  }, [branchId]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 5_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const advance = async (id: number) => {
    try {
      await api.post(`/pos/kds/${id}/advance/`);
      load();
    } catch (e) { console.error(e); }
  };

  const byStatus = (s: KDSStatus) => orders.filter(o => o.kds_status === s);

  return (
    <div style={{
      background: "#0f172a", minHeight: "100vh", padding: "1.5rem",
      color: "#f1f5f9", fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl",
    }}>
      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.7 } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>
            🖥️ Kitchen Display System
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.8rem" }}>
            آخر تحديث: {lastUpdate} — تحديث كل 5 ثوانٍ
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <input
            placeholder="رقم الفرع..."
            value={branchId}
            onChange={e => setBranchId(e.target.value)}
            style={{
              padding: "0.5rem 0.75rem", background: "#1e293b",
              border: "1px solid #334155", borderRadius: "0.6rem",
              color: "#f1f5f9", fontSize: "0.85rem", width: 120,
            }}
          />
          <button
            onClick={load}
            style={{
              padding: "0.5rem 1rem", background: "#1e293b", color: "#6366f1",
              border: "1px solid #6366f1", borderRadius: "0.6rem", cursor: "pointer", fontWeight: 600,
            }}
          >
            تحديث
          </button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {[
            { label: "انتظار", val: stats.pending, color: "#3b82f6" },
            { label: "تحضير", val: stats.cooking, color: "#f59e0b" },
            { label: "جاهز", val: stats.ready, color: "#22c55e" },
            { label: "تسليم اليوم", val: stats.delivered, color: "#6366f1" },
          ].map(s => (
            <div key={s.label} style={{
              background: "#1e293b", borderRadius: "0.75rem", padding: "0.65rem 1rem",
              borderRight: `3px solid ${s.color}`,
            }}>
              <div style={{ fontWeight: 800, fontSize: "1.3rem", color: s.color }}>{s.val}</div>
              <div style={{ color: "#64748b", fontSize: "0.75rem" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 3-column KDS board */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        <Column status="pending"  orders={byStatus("pending")}  onAdvance={advance} />
        <Column status="cooking"  orders={byStatus("cooking")}  onAdvance={advance} />
        <Column status="ready"    orders={byStatus("ready")}    onAdvance={advance} />
      </div>

      {!orders.length && (
        <div style={{ textAlign: "center", color: "#334155", paddingTop: "4rem" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>✅</div>
          <p style={{ fontSize: "1.1rem" }}>المطبخ فاضي — لا توجد طلبات نشطة</p>
        </div>
      )}
    </div>
  );
}
