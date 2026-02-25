/**
 * POS - شاشة الكاشير
 * واجهة متكاملة: شبكة منتجات مع صور، تصنيفات، سلة جانبية، نافذة تعديلات،
 * دفع → قيد محاسبي + خصم مخزون، طباعة حرارية + QR للفاتورة الضريبية.
 * Optimized: React.memo + Virtual Grid for 10k+ products.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, memo } from "react";
import { Grid } from "react-window";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import {
  fetchPOSProducts,
  fetchPOSCategories,
  fetchPOSModifiers,
  createPOSSale,
  syncPOSOffline,
  type POSProduct,
  type POSCategory,
  type POSModifier,
  type POSCartItem,
} from "../lib/api";

const OFFLINE_KEY = "pos_pending_sales";
const TAX_RATE = 0.15;
const COLUMN_WIDTH = 140;
const ROW_HEIGHT = 130;
const GRID_GAP = 6;

// أيقونات/ألوان للتصنيفات
const CATEGORY_STYLES: Record<string, { icon: string; gradient: string }> = {
  coffee: { icon: "☕", gradient: "from-amber-900/80 to-amber-700/60" },
  desserts: { icon: "🍰", gradient: "from-rose-900/80 to-rose-700/60" },
  sandwiches: { icon: "🥪", gradient: "from-orange-900/80 to-orange-700/60" },
  drinks: { icon: "🥤", gradient: "from-sky-900/80 to-sky-700/60" },
  other: { icon: "🍽️", gradient: "from-slate-700/80 to-slate-600/60" },
};

type POSGridCellProps = {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  products: POSProduct[];
  gridColumnCount: number;
  onSelect: (p: POSProduct) => void;
};

const POSGridCell = memo(function POSGridCell({
  columnIndex,
  rowIndex,
  style,
  products,
  gridColumnCount,
  onSelect,
}: POSGridCellProps) {
  const idx = rowIndex * gridColumnCount + columnIndex;
  const p = products[idx];
  if (!p) return null;
  return (
    <div style={{ ...style, padding: 6 }}>
      <ProductCard product={p} onSelect={() => onSelect(p)} />
    </div>
  );
});

/** بطاقة منتج مُحسّنة – React.memo لتقليل إعادة الرسم */
const ProductCard = memo(function ProductCard({
  product,
  onSelect,
}: {
  product: POSProduct;
  onSelect: () => void;
}) {
  const style = CATEGORY_STYLES[product.category] ?? CATEGORY_STYLES.other;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex min-h-[120px] flex-col items-center justify-center rounded-2xl bg-slate-800/80 p-4 shadow-lg transition hover:bg-slate-700 hover:ring-2 hover:ring-emerald-500/50 active:scale-[0.98]"
    >
      <div
        className={`mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${style.gradient} text-2xl transition group-hover:scale-110`}
      >
        {style.icon}
      </div>
      <span className="line-clamp-2 text-center text-sm font-medium text-white">
        {product.name}
      </span>
      <span className="mt-1 text-xs font-semibold text-emerald-400">
        {(product.price || 0).toFixed(1)} ر.س
      </span>
    </button>
  );
});

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function usePendingSales() {
  const [pending, setPending] = useState<unknown[]>(() => {
    try {
      const s = localStorage.getItem(OFFLINE_KEY);
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const add = useCallback((sale: unknown) => {
    setPending((p) => {
      const next = [...p, sale];
      localStorage.setItem(OFFLINE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const clear = useCallback(() => {
    setPending([]);
    localStorage.removeItem(OFFLINE_KEY);
  }, []);
  const set = useCallback((list: unknown[]) => {
    setPending(list);
    if (list.length) localStorage.setItem(OFFLINE_KEY, JSON.stringify(list));
    else localStorage.removeItem(OFFLINE_KEY);
  }, []);
  return { pending, add, clear, set };
}

/** رابط التحقق الضريبي (ZATCA-style) - يُرمّز في QR */
function getTaxInvoicePayload(saleNumber: string, total: number, branchName: string): string {
  const payload = {
    v: "1",
    sn: saleNumber,
    t: total.toFixed(2),
    d: new Date().toISOString(),
    b: branchName,
  };
  return JSON.stringify(payload);
}

/** نافذة طباعة حرارية - عرض 80mm، خط أحادي */
function ThermalReceiptPrint({
  saleNumber,
  total,
  items,
  branchName,
  tax,
  subtotal,
  onClose,
  isRTL,
}: {
  saleNumber: string;
  total: number;
  items: POSCartItem[];
  branchName: string;
  tax: number;
  subtotal: number;
  onClose: () => void;
  isRTL: boolean;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const qrPayload = getTaxInvoicePayload(saleNumber, total, branchName);

  const handlePrint = useCallback(() => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open("", "_blank", "width=320,height=600");
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html><html dir="${isRTL ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>Receipt</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Courier New',monospace;font-size:12px;padding:8px;max-width:80mm;margin:0 auto;line-height:1.3}
        .center{text-align:center}
        .row{display:flex;justify-content:space-between;margin:2px 0}
        .total{border-top:1px dashed #000;margin-top:6px;padding-top:6px;font-weight:bold}
        .qr{margin:8px auto;display:block}
      </style></head><body>
      ${el.innerHTML}
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }, [isRTL]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div
        className="max-h-[90vh] w-full max-w-[320px] overflow-y-auto rounded-xl bg-white p-4 text-black shadow-xl"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div ref={printRef} className="thermal-receipt">
          <div className="center mb-2 font-bold text-sm">{branchName}</div>
          <div className="center text-xs text-gray-600 mb-2">
            {isRTL ? "فاتورة ضريبية" : "Tax Invoice"}
          </div>
          <div className="center mb-2">{saleNumber}</div>
          <div className="center text-xs mb-3">{new Date().toLocaleString()}</div>
          <hr className="border-dashed border-gray-400 my-2" />
          {items.map((i, idx) => (
            <div key={idx} className="row text-xs">
              <span>
                {i.qty}× {i.product_name}
                {(i.modifier_total ?? 0) > 0 && ` (+${(i.modifier_total ?? 0).toFixed(2)})`}
              </span>
              <span>
                {(i.qty * (i.unit_price || 0) + (i.modifier_total ?? 0) - (i.discount_amount ?? 0)).toFixed(
                  2
                )}{" "}
                ر.س
              </span>
            </div>
          ))}
          <hr className="border-dashed border-gray-400 my-2" />
          <div className="row text-xs">
            <span>{isRTL ? "المجموع الفرعي" : "Subtotal"}</span>
            <span>{subtotal.toFixed(2)} ر.س</span>
          </div>
          <div className="row text-xs">
            <span>{isRTL ? "الضريبة (15%)" : "Tax 15%"}</span>
            <span>{tax.toFixed(2)} ر.س</span>
          </div>
          <div className="row total">
            <span>{isRTL ? "الإجمالي" : "Total"}</span>
            <span>{total.toFixed(2)} ر.س</span>
          </div>
          <div className="center my-3">
            <QRCodeSVG value={qrPayload} size={80} level="M" className="qr mx-auto" />
          </div>
          <div className="center text-xs text-gray-600">{isRTL ? "شكراً لكم" : "Thank you"}</div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            {isRTL ? "طباعة" : "Print"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-200 py-2 px-4 text-sm hover:bg-slate-300"
          >
            {isRTL ? "إغلاق" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function POSPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";
  const online = useOnline();
  const { pending, add, set } = usePendingSales();

  const branchId = (user?.branch_id ?? 0) as number;
  const [category, setCategory] = useState<string>("all");
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [categories, setCategories] = useState<POSCategory[]>([]);
  const [modifiers, setModifiers] = useState<POSModifier[]>([]);
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [modifierProduct, setModifierProduct] = useState<POSProduct | null>(null);
  const [selectedMods, setSelectedMods] = useState<{ id: number; name: string; price_add: number }[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountFixed, setDiscountFixed] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "wallet" | "delivery_app">("cash");
  const [processing, setProcessing] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<{
    number: string;
    total: number;
    items: POSCartItem[];
    subtotal: number;
    tax: number;
  } | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        setGridSize({ width: Math.max(0, width - 24), height: Math.max(0, height - 16) });
      }
    });
    observer.observe(el);
    const { width, height } = el.getBoundingClientRect();
    setGridSize({ width: Math.max(0, width - 24), height: Math.max(0, height - 16) });
    return () => observer.disconnect();
  }, []);

  const gridWidth = gridSize.width;
  const gridHeight = gridSize.height;
  const gridColumnCount = Math.max(2, Math.floor(gridWidth / (COLUMN_WIDTH + GRID_GAP)) || 4);
  const gridRowCount = products.length ? Math.ceil(products.length / gridColumnCount) : 0;

  useEffect(() => {
    if (!branchId) return;
    fetchPOSProducts(branchId, category === "all" ? undefined : category)
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [branchId, category]);

  useEffect(() => {
    fetchPOSCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    fetchPOSModifiers().then(setModifiers).catch(() => setModifiers([]));
  }, []);

  const addToCart = useCallback(
    (p: POSProduct, qty = 1, selectedModsList: { id: number; name: string; price_add: number }[] = []) => {
      const modTotal = selectedModsList.reduce((s, m) => s + m.price_add, 0);
      const modsForItem = selectedModsList.map((m) => ({ id: m.id, name: m.name, price_add: m.price_add }));
      setCart((prev) => {
        const existing = prev.find((c) => c.product_sku === p.sku && JSON.stringify(c.modifiers) === JSON.stringify(modsForItem));
        if (existing) {
          return prev.map((c) =>
            c === existing
              ? {
                  ...c,
                  qty: c.qty + qty,
                  modifier_total: (c.modifier_total ?? 0) + modTotal * qty,
                }
              : c
          );
        }
        return [
          ...prev,
          {
            product_sku: p.sku,
            product_name: p.name,
            qty,
            unit_price: p.price,
            modifier_total: modTotal * qty,
            modifiers: modsForItem,
            discount_amount: 0,
          },
        ];
      });
      setModifierProduct(null);
      setSelectedMods([]);
    },
    []
  );

  const removeFromCart = useCallback((idx: number) => {
    setCart((c) => c.filter((_, i) => i !== idx));
  }, []);

  const updateCartQty = useCallback((idx: number, delta: number) => {
    setCart((c) =>
      c
        .map((item, i) => {
          if (i !== idx) return item;
          const nq = Math.max(0, item.qty + delta);
          if (nq === 0) return null;
          return { ...item, qty: nq };
        })
        .filter(Boolean) as POSCartItem[]
    );
  }, []);

  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce(
      (s, i) => s + i.qty * (i.unit_price || 0) + (i.modifier_total ?? 0) - (i.discount_amount ?? 0),
      0
    );
    const discountVal = discountPercent ? (subtotal * discountPercent) / 100 : discountFixed;
    const afterDiscount = Math.max(0, subtotal - discountVal);
    const tax = afterDiscount * TAX_RATE;
    const total = afterDiscount + tax;
    return { subtotal: subtotal - discountVal, discountVal, afterDiscount, tax, total };
  }, [cart, discountPercent, discountFixed]);

  const doPayment = useCallback(async () => {
    if (!branchId || cart.length === 0) return;
    setProcessing(true);
    try {
      const itemsPayload = cart.map((i) => ({
        product_sku: i.product_sku,
        product_name: i.product_name,
        qty: i.qty,
        unit_price: i.unit_price,
        modifier_total: i.modifier_total ?? 0,
        discount_amount: i.discount_amount ?? 0,
        modifiers: i.modifiers?.map((m) => ({ modifier_id: m.id })) ?? [],
      }));

      if (online) {
        const res = await createPOSSale({
          branch_id: branchId,
          items: itemsPayload,
          payment_method: paymentMethod,
          discount_total: cartTotals.discountVal,
        });
        setLastSaleData({
          number: res.sale_number,
          total: cartTotals.total,
          items: [...cart],
          subtotal: cartTotals.afterDiscount,
          tax: cartTotals.tax,
        });
        setShowReceipt(true);
        setCart([]);
        setDiscountPercent(0);
        setDiscountFixed(0);
        setShowPayment(false);
      } else {
        add({
          branch_id: branchId,
          items: itemsPayload,
          payment_method: paymentMethod,
          discount_total: cartTotals.discountVal,
          created_at: new Date().toISOString(),
        });
        setLastSaleData({
          number: "OFFLINE",
          total: cartTotals.total,
          items: [...cart],
          subtotal: cartTotals.afterDiscount,
          tax: cartTotals.tax,
        });
        setShowReceipt(true);
        setCart([]);
        setDiscountPercent(0);
        setDiscountFixed(0);
        setShowPayment(false);
      }
    } catch (e) {
      alert((e as Error).message || "فشل إنشاء البيع");
    } finally {
      setProcessing(false);
    }
  }, [branchId, cart, paymentMethod, cartTotals, online, add]);

  const syncPending = useCallback(async () => {
    if (!online || pending.length === 0) return;
    setProcessing(true);
    try {
      const sales = pending.map((s: unknown) => {
        const rec = s as { branch_id?: number };
        return { ...rec, branch_id: rec.branch_id ?? branchId };
      });
      const res = await syncPOSOffline(sales);
      if (res.synced > 0) set(pending.slice(res.synced));
    } catch {
      /* ignore */
    } finally {
      setProcessing(false);
    }
  }, [online, pending, branchId, set]);

  if (!branchId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-slate-500">{t("selectBranch")}</p>
      </div>
    );
  }

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-900 text-white"
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-slate-800/80 px-4 py-3 backdrop-blur-sm">
        <Link
          to="/"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
        >
          ←
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{isRTL ? "شاشة الكاشير" : "POS"}</h1>
          <a
            href="/kitchen"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600 hover:text-white"
          >
            {isRTL ? "المطبخ" : "Kitchen"}
          </a>
        </div>
        <div className="flex items-center gap-2">
          {!online && (
            <span className="rounded-full bg-amber-500/30 px-3 py-1 text-xs text-amber-300">
              {isRTL ? "غير متصل" : "Offline"}
            </span>
          )}
          {pending.length > 0 && online && (
            <button
              type="button"
              onClick={syncPending}
              disabled={processing}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
            >
              {isRTL ? `مزامنة (${pending.length})` : `Sync (${pending.length})`}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="flex w-24 shrink-0 flex-col gap-1 border-r border-white/10 bg-slate-800/50 p-2 overflow-y-auto">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`min-h-[56px] rounded-xl px-2 text-center text-sm font-medium transition ${
              category === "all"
                ? "bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-500/50"
                : "bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            {isRTL ? "الكل" : "All"}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`min-h-[56px] rounded-xl px-2 text-center text-sm font-medium transition ${
                category === c.id
                  ? "bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-500/50"
                  : "bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {isRTL ? c.name_ar : c.name}
            </button>
          ))}
        </aside>

        <main className="flex flex-1 min-h-0 flex-col p-4">
          <div ref={gridContainerRef} className="flex-1 min-h-0 rounded-xl">
            {products.length === 0 ? (
              <p className="py-12 text-center text-slate-500">{isRTL ? "لا توجد منتجات" : "No products"}</p>
            ) : gridHeight > 0 && gridWidth > 0 ? (
              <Grid
                columnCount={gridColumnCount}
                columnWidth={Math.floor((gridWidth - GRID_GAP * (gridColumnCount - 1)) / gridColumnCount)}
                rowCount={gridRowCount}
                rowHeight={ROW_HEIGHT + GRID_GAP}
                cellComponent={POSGridCell}
                cellProps={{ products, gridColumnCount, onSelect: setModifierProduct }}
                style={{ height: gridHeight, width: gridWidth, overflowX: "hidden" }}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {products.slice(0, 20).map((p) => (
                  <ProductCard key={p.id} product={p} onSelect={() => setModifierProduct(p)} />
                ))}
              </div>
            )}
          </div>
        </main>

        <aside className="flex w-96 shrink-0 flex-col border-l border-white/10 bg-slate-800/80">
          <div className="border-b border-white/10 px-4 py-3 font-semibold">{isRTL ? "السلة" : "Cart"}</div>
          <div className="flex-1 overflow-y-auto p-4">
            {cart.map((item, i) => (
              <div
                key={i}
                className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-slate-700/50 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.product_name}</div>
                  <div className="text-xs text-slate-400">
                    {item.qty} × {(item.unit_price || 0).toFixed(1)} ر.س
                    {(item.modifier_total ?? 0) > 0 && (
                      <span className="text-emerald-400"> + {(item.modifier_total ?? 0).toFixed(1)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateCartQty(i, -1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-600 text-lg hover:bg-slate-500"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm">{item.qty}</span>
                  <button
                    type="button"
                    onClick={() => updateCartQty(i, 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-600 text-lg hover:bg-slate-500"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromCart(i)}
                    className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600/50 text-rose-300 hover:bg-rose-600"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 p-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">{isRTL ? "المجموع الفرعي" : "Subtotal"}</span>
                <span>{cartTotals.subtotal.toFixed(2)} ر.س</span>
              </div>
              {(discountPercent > 0 || discountFixed > 0) && (
                <div className="flex justify-between text-amber-400">
                  <span>{isRTL ? "الخصم" : "Discount"}</span>
                  <span>−{cartTotals.discountVal.toFixed(2)} ر.س</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>{isRTL ? "الضريبة (15%)" : "Tax (15%)"}</span>
                <span>{cartTotals.tax.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between pt-2 text-lg font-bold text-emerald-400">
                <span>{isRTL ? "الإجمالي" : "Total"}</span>
                <span>{cartTotals.total.toFixed(2)} ر.س</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => cart.length > 0 && setShowPayment(true)}
              disabled={cart.length === 0 || processing}
              className="mt-4 w-full min-h-[52px] rounded-xl bg-emerald-500 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500"
            >
              {isRTL ? "دفع" : "Pay"}
            </button>
          </div>
        </aside>
      </div>

      {modifierProduct && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModifierProduct(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-slate-800 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold">{modifierProduct.name}</h3>
            <p className="mb-4 text-emerald-400">{(modifierProduct.price || 0).toFixed(1)} ر.س</p>
            {modifiers.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-sm text-slate-400">{isRTL ? "خيارات (إضافات، حرارة، حليب)" : "Options"}</p>
                <div className="space-y-2">
                  {modifiers.map((m) => {
                    const isSel = selectedMods.some((s) => s.id === m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setSelectedMods((prev) =>
                            isSel
                              ? prev.filter((s) => s.id !== m.id)
                              : [...prev, { id: m.id, name: m.name, price_add: m.price_add }]
                          )
                        }
                        className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition ${
                          isSel ? "bg-emerald-500/20 ring-1 ring-emerald-500/50" : "bg-slate-700/50 hover:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                            isSel ? "border-emerald-400 bg-emerald-500/30" : "border-slate-500"
                          }`}
                        >
                          {isSel && <span className="text-xs">✓</span>}
                        </span>
                        <span>{isRTL ? (m.name_ar || m.name) : m.name}</span>
                        {m.price_add > 0 && (
                          <span className="text-emerald-400">+{m.price_add} ر.س</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => addToCart(modifierProduct, 1, selectedMods)}
                className="flex-1 rounded-xl bg-emerald-500 py-3 font-medium hover:bg-emerald-600"
              >
                {isRTL ? "إضافة" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setModifierProduct(null);
                  setSelectedMods([]);
                }}
                className="rounded-xl bg-slate-600 py-3 px-6 hover:bg-slate-500"
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPayment && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowPayment(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold">{isRTL ? "طريقة الدفع" : "Payment"}</h3>
            <div className="mb-4 space-y-2">
              {(["cash", "card", "wallet", "delivery_app"] as const).map((pm) => (
                <button
                  key={pm}
                  type="button"
                  onClick={() => setPaymentMethod(pm)}
                  className={`w-full rounded-xl py-3 text-left px-4 transition ${
                    paymentMethod === pm
                      ? "bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-500/50"
                      : "bg-slate-700/50 hover:bg-slate-700"
                  }`}
                >
                  {pm === "cash" && (isRTL ? "كاش" : "Cash")}
                  {pm === "card" && (isRTL ? "بطاقة / شبكة" : "Card")}
                  {pm === "wallet" && (isRTL ? "محفظة" : "Wallet")}
                  {pm === "delivery_app" && (isRTL ? "توصيل" : "Delivery")}
                </button>
              ))}
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm text-slate-400">{isRTL ? "خصم %" : "Discount %"}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={discountPercent || ""}
                onChange={(e) => {
                  setDiscountPercent(Number(e.target.value) || 0);
                  setDiscountFixed(0);
                }}
                className="w-full rounded-lg bg-slate-700 px-3 py-2 text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={doPayment}
                disabled={processing}
                className="flex-1 rounded-xl bg-emerald-500 py-3 font-medium hover:bg-emerald-600 disabled:opacity-50"
              >
                {processing ? "..." : (isRTL ? "تأكيد الدفع" : "Confirm")}
              </button>
              <button
                type="button"
                onClick={() => setShowPayment(false)}
                className="rounded-xl bg-slate-600 py-3 px-6 hover:bg-slate-500"
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && lastSaleData && (
        <ThermalReceiptPrint
          saleNumber={lastSaleData.number}
          total={lastSaleData.total}
          items={lastSaleData.items}
          branchName={user?.branch_name || "POS"}
          tax={lastSaleData.tax}
          subtotal={lastSaleData.subtotal}
          isRTL={isRTL}
          onClose={() => {
            setShowReceipt(false);
            setLastSaleData(null);
          }}
        />
      )}
    </div>
  );
}
