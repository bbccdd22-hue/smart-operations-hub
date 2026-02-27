/**
 * POS – شاشة الكاشير
 * Apple-style design: real product photos, horizontal category pills,
 * responsive grid, slide-up cart for tablet, full-width on mobile.
 */
import React, {
  useCallback, useEffect, useLayoutEffect, useMemo,
  useRef, useState, memo,
} from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import {
  fetchPOSProducts, fetchPOSCategories, fetchPOSModifiers,
  createPOSSale, syncPOSOffline,
  type POSProduct, type POSCategory, type POSModifier, type POSCartItem,
} from "../lib/api";
import { getProductTheme, getCustomImages } from "../lib/productThemes";

const OFFLINE_KEY = "pos_pending_sales";
const TAX_RATE    = 0.15;

/* ── Helpers ────────────────────────────────────────────────────────── */
function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

function usePendingSales() {
  const [pending, setPending] = useState<unknown[]>(() => {
    try { const s = localStorage.getItem(OFFLINE_KEY); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });
  const add = useCallback((sale: unknown) => {
    setPending((p) => { const next = [...p, sale]; localStorage.setItem(OFFLINE_KEY, JSON.stringify(next)); return next; });
  }, []);
  const clear = useCallback(() => { setPending([]); localStorage.removeItem(OFFLINE_KEY); }, []);
  const set = useCallback((list: unknown[]) => {
    setPending(list);
    if (list.length) localStorage.setItem(OFFLINE_KEY, JSON.stringify(list));
    else localStorage.removeItem(OFFLINE_KEY);
  }, []);
  return { pending, add, clear, set };
}

function getTaxInvoicePayload(saleNumber: string, total: number, branchName: string) {
  return JSON.stringify({ v: "1", sn: saleNumber, t: total.toFixed(2), d: new Date().toISOString(), b: branchName });
}

/* ── Apple-style ProductCard ────────────────────────────────────────── */
const ProductCard = memo(function ProductCard({
  product,
  onSelect,
  customImageUrl,
}: {
  product: POSProduct;
  onSelect: () => void;
  customImageUrl?: string;
}) {
  const theme = getProductTheme(product.name || "");
  const resolvedUrl = customImageUrl || theme.imageUrl;
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const showImg = resolvedUrl && !imgError;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex flex-col overflow-hidden rounded-3xl shadow-md transition-transform duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
      style={{ minHeight: 160 }}
    >
      {/* Photo or gradient background */}
      <div className="absolute inset-0">
        {showImg && (
          <img
            src={resolvedUrl}
            alt={product.name}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`h-full w-full object-cover transition-all duration-700 group-hover:scale-110 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {/* Gradient fallback (always present, acts as placeholder until image loads) */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${theme.gradientFallback} transition-opacity duration-500 ${showImg && imgLoaded ? "opacity-0" : "opacity-100"}`}
        />
      </div>

      {/* Dark scrim – bottom for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      {/* Subtle top vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent h-1/3" />

      {/* Emoji badge – top-right */}
      <div className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-black/30 text-xl backdrop-blur-sm">
        {theme.emoji}
      </div>

      {/* Info strip – bottom */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-6">
        <p className="line-clamp-2 text-start text-[13px] font-semibold leading-tight text-white drop-shadow">
          {product.name}
        </p>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="rounded-xl bg-emerald-500/90 px-2.5 py-0.5 text-xs font-bold text-white shadow">
            {(product.price || 0).toFixed(1)} ر.س
          </span>
        </div>
      </div>
    </button>
  );
});

/* ── Thermal Receipt ────────────────────────────────────────────────── */
function ThermalReceiptPrint({
  saleNumber, total, items, branchName, tax, subtotal, onClose, isRTL,
}: {
  saleNumber: string; total: number; items: POSCartItem[];
  branchName: string; tax: number; subtotal: number; onClose: () => void; isRTL: boolean;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const qrPayload = getTaxInvoicePayload(saleNumber, total, branchName);
  const handlePrint = useCallback(() => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open("", "_blank", "width=320,height=600");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="${isRTL ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>Receipt</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;padding:8px;max-width:80mm;margin:0 auto;line-height:1.3}.center{text-align:center}.row{display:flex;justify-content:space-between;margin:2px 0}.total{border-top:1px dashed #000;margin-top:6px;padding-top:6px;font-weight:bold}.qr{margin:8px auto;display:block}</style></head><body>${el.innerHTML}</body></html>`);
    w.document.close(); w.focus(); w.print(); w.close();
  }, [isRTL]);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-[320px] overflow-y-auto rounded-xl bg-white p-4 text-black shadow-xl" dir={isRTL ? "rtl" : "ltr"}>
        <div ref={printRef} className="thermal-receipt">
          <div className="center mb-2 font-bold text-sm">{branchName}</div>
          <div className="center text-xs text-gray-600 mb-2">{isRTL ? "فاتورة ضريبية" : "Tax Invoice"}</div>
          <div className="center mb-2">{saleNumber}</div>
          <div className="center text-xs mb-3">{new Date().toLocaleString()}</div>
          <hr className="border-dashed border-gray-400 my-2" />
          {items.map((i, idx) => (
            <div key={idx} className="row text-xs">
              <span>{i.qty}× {i.product_name}{(i.modifier_total ?? 0) > 0 && ` (+${(i.modifier_total ?? 0).toFixed(2)})`}</span>
              <span>{(i.qty * (i.unit_price || 0) + (i.modifier_total ?? 0) - (i.discount_amount ?? 0)).toFixed(2)} ر.س</span>
            </div>
          ))}
          <hr className="border-dashed border-gray-400 my-2" />
          <div className="row text-xs"><span>{isRTL ? "المجموع الفرعي" : "Subtotal"}</span><span>{subtotal.toFixed(2)} ر.س</span></div>
          <div className="row text-xs"><span>{isRTL ? "الضريبة (15%)" : "Tax 15%"}</span><span>{tax.toFixed(2)} ر.س</span></div>
          <div className="row total"><span>{isRTL ? "الإجمالي" : "Total"}</span><span>{total.toFixed(2)} ر.س</span></div>
          <div className="center my-3"><QRCodeSVG value={qrPayload} size={80} level="M" className="qr mx-auto" /></div>
          <div className="center text-xs text-gray-600">{isRTL ? "شكراً لكم" : "Thank you"}</div>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={handlePrint} className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500">{isRTL ? "طباعة" : "Print"}</button>
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-200 py-2 px-4 text-sm hover:bg-slate-300">{isRTL ? "إغلاق" : "Close"}</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Main POS Page
══════════════════════════════════════════════════════════════════════ */
export default function POSPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";
  const online = useOnline();
  const { pending, add, set } = usePendingSales();

  const branchId = (user?.branch_id ?? 0) as number;
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [customImages, setCustomImages] = useState<Record<number, string>>(() => getCustomImages());
  const [categories, setCategories] = useState<POSCategory[]>([]);
  const [modifiers, setModifiers] = useState<POSModifier[]>([]);
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [modifierProduct, setModifierProduct] = useState<POSProduct | null>(null);
  const [selectedMods, setSelectedMods] = useState<{ id: number; name: string; price_add: number }[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "wallet" | "delivery_app">("cash");
  const [processing, setProcessing] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);   // for tablet slide-up cart
  const [lastSaleData, setLastSaleData] = useState<{
    number: string; total: number; items: POSCartItem[]; subtotal: number; tax: number;
  } | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  /* Responsive: is it a large screen (≥1024px)? */
  const [isLarge, setIsLarge] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const h = () => setIsLarge(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    if (!branchId) return;
    fetchPOSProducts(branchId, category === "all" ? undefined : category)
      .then(setProducts).catch(() => setProducts([]));
  }, [branchId, category]);

  useEffect(() => { fetchPOSCategories().then(setCategories).catch(() => setCategories([])); }, []);
  useEffect(() => { fetchPOSModifiers().then(setModifiers).catch(() => setModifiers([])); }, []);

  /* sync custom images when localStorage changes (e.g. from ProductsPage) */
  useEffect(() => {
    const handleStorage = () => setCustomImages(getCustomImages());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const addToCart = useCallback(
    (p: POSProduct, qty = 1, mods: { id: number; name: string; price_add: number }[] = []) => {
      const modTotal = mods.reduce((s, m) => s + m.price_add, 0);
      const modsForItem = mods.map((m) => ({ id: m.id, name: m.name, price_add: m.price_add }));
      setCart((prev) => {
        const existing = prev.find((c) => c.product_sku === p.sku && JSON.stringify(c.modifiers) === JSON.stringify(modsForItem));
        if (existing) {
          return prev.map((c) => c === existing ? { ...c, qty: c.qty + qty, modifier_total: (c.modifier_total ?? 0) + modTotal * qty } : c);
        }
        return [...prev, { product_sku: p.sku, product_name: p.name, qty, unit_price: p.price, modifier_total: modTotal * qty, modifiers: modsForItem, discount_amount: 0 }];
      });
      setModifierProduct(null);
      setSelectedMods([]);
    },
    []
  );

  const removeFromCart = useCallback((idx: number) => setCart((c) => c.filter((_, i) => i !== idx)), []);
  const updateCartQty = useCallback((idx: number, delta: number) => {
    setCart((c) => c.map((item, i) => {
      if (i !== idx) return item;
      const nq = Math.max(0, item.qty + delta);
      if (nq === 0) return null as unknown as POSCartItem;
      return { ...item, qty: nq };
    }).filter(Boolean) as POSCartItem[]);
  }, []);

  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((s, i) => s + i.qty * (i.unit_price || 0) + (i.modifier_total ?? 0) - (i.discount_amount ?? 0), 0);
    const discountVal = discountPercent ? (subtotal * discountPercent) / 100 : 0;
    const afterDiscount = Math.max(0, subtotal - discountVal);
    const tax = afterDiscount * TAX_RATE;
    const total = afterDiscount + tax;
    return { subtotal: subtotal - discountVal, discountVal, afterDiscount, tax, total };
  }, [cart, discountPercent]);

  const doPayment = useCallback(async () => {
    if (!branchId || cart.length === 0) return;
    setProcessing(true);
    try {
      const itemsPayload = cart.map((i) => ({
        product_sku: i.product_sku, product_name: i.product_name, qty: i.qty,
        unit_price: i.unit_price, modifier_total: i.modifier_total ?? 0,
        discount_amount: i.discount_amount ?? 0,
        modifiers: i.modifiers?.map((m) => ({ modifier_id: m.id })) ?? [],
      }));
      if (online) {
        const res = await createPOSSale({ branch_id: branchId, items: itemsPayload, payment_method: paymentMethod, discount_total: cartTotals.discountVal });
        setLastSaleData({ number: res.sale_number, total: cartTotals.total, items: [...cart], subtotal: cartTotals.afterDiscount, tax: cartTotals.tax });
      } else {
        add({ branch_id: branchId, items: itemsPayload, payment_method: paymentMethod, discount_total: cartTotals.discountVal, created_at: new Date().toISOString() });
        setLastSaleData({ number: "OFFLINE", total: cartTotals.total, items: [...cart], subtotal: cartTotals.afterDiscount, tax: cartTotals.tax });
      }
      setShowReceipt(true);
      setCart([]); setDiscountPercent(0); setShowPayment(false); setCartOpen(false);
    } catch (e) {
      alert((e as Error).message || "فشل إنشاء البيع");
    } finally { setProcessing(false); }
  }, [branchId, cart, paymentMethod, cartTotals, online, add]);

  const syncPending = useCallback(async () => {
    if (!online || pending.length === 0) return;
    setProcessing(true);
    try {
      const sales = pending.map((s: unknown) => { const r = s as { branch_id?: number }; return { ...r, branch_id: r.branch_id ?? branchId }; });
      const res = await syncPOSOffline(sales);
      if (res.synced > 0) set(pending.slice(res.synced));
    } catch { /* ignore */ } finally { setProcessing(false); }
  }, [online, pending, branchId, set]);

  const cartItemCount = cart.reduce((s, i) => s + i.qty, 0);

  if (!branchId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-slate-500">{t("selectBranch")}</p>
      </div>
    );
  }

  /* ── Cart panel (shared JSX) ────────────────────────────────────── */
  const CartPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="font-semibold">{isRTL ? "السلة" : "Cart"}</span>
        {!isLarge && (
          <button type="button" onClick={() => setCartOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-700 text-slate-300">✕</button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <span className="text-4xl mb-2">🛒</span>
            <span className="text-sm">{isRTL ? "السلة فارغة" : "Cart is empty"}</span>
          </div>
        )}
        {cart.map((item, i) => (
          <div key={i} className="flex items-center gap-2 rounded-2xl bg-slate-700/60 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{item.product_name}</div>
              <div className="text-xs text-slate-400">
                {item.qty} × {(item.unit_price || 0).toFixed(1)} ر.س
                {(item.modifier_total ?? 0) > 0 && <span className="text-emerald-400"> + {(item.modifier_total ?? 0).toFixed(1)}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => updateCartQty(i, -1)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-600 text-lg hover:bg-slate-500">−</button>
              <span className="w-7 text-center text-sm font-bold">{item.qty}</span>
              <button type="button" onClick={() => updateCartQty(i, 1)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-600 text-lg hover:bg-slate-500">+</button>
              <button type="button" onClick={() => removeFromCart(i)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-600/40 text-rose-300 hover:bg-rose-600">×</button>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-4 space-y-2">
        <div className="flex justify-between text-sm text-slate-400">
          <span>{isRTL ? "المجموع الفرعي" : "Subtotal"}</span>
          <span>{cartTotals.subtotal.toFixed(2)} ر.س</span>
        </div>
        {discountPercent > 0 && (
          <div className="flex justify-between text-sm text-amber-400">
            <span>{isRTL ? "الخصم" : "Discount"}</span>
            <span>−{cartTotals.discountVal.toFixed(2)} ر.س</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-slate-400">
          <span>{isRTL ? "الضريبة (15%)" : "Tax (15%)"}</span>
          <span>{cartTotals.tax.toFixed(2)} ر.س</span>
        </div>
        <div className="flex justify-between pt-1 text-xl font-bold text-emerald-400">
          <span>{isRTL ? "الإجمالي" : "Total"}</span>
          <span>{cartTotals.total.toFixed(2)} ر.س</span>
        </div>
        <button
          type="button"
          onClick={() => cart.length > 0 && setShowPayment(true)}
          disabled={cart.length === 0 || processing}
          className="mt-2 w-full min-h-[52px] rounded-2xl bg-emerald-500 font-bold text-white text-lg shadow-lg hover:bg-emerald-400 disabled:opacity-40 transition"
        >
          {isRTL ? "💳 دفع" : "💳 Pay"}
        </button>
      </div>
    </div>
  );

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-900 text-white"
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-800/90 px-4 py-2.5 backdrop-blur-sm">
        <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white text-lg">
          ←
        </Link>
        <h1 className="text-base font-bold tracking-tight">{isRTL ? "شاشة الكاشير" : "POS"}</h1>
        <div className="flex items-center gap-2">
          {!online && (
            <span className="rounded-full bg-amber-500/25 px-3 py-1 text-xs text-amber-300 border border-amber-500/40">{isRTL ? "غير متصل" : "Offline"}</span>
          )}
          {pending.length > 0 && online && (
            <button type="button" onClick={syncPending} disabled={processing} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500 disabled:opacity-50">
              {isRTL ? `مزامنة (${pending.length})` : `Sync (${pending.length})`}
            </button>
          )}
          <a href="/kitchen" target="_blank" rel="noopener noreferrer" className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600">
            {isRTL ? "🍳 المطبخ" : "🍳 Kitchen"}
          </a>
        </div>
      </header>

      {/* ── Category pills ──────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 overflow-x-auto border-b border-white/10 bg-slate-800/60 px-4 py-2.5 scrollbar-none" style={{ scrollbarWidth: "none" }}>
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={`shrink-0 rounded-2xl px-5 py-2 text-sm font-semibold transition-all ${category === "all" ? "bg-emerald-500 text-white shadow-[0_2px_12px_rgba(16,185,129,0.4)]" : "bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white"}`}
        >
          {isRTL ? "🏷️ الكل" : "🏷️ All"}
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`shrink-0 rounded-2xl px-5 py-2 text-sm font-semibold transition-all ${category === c.id ? "bg-emerald-500 text-white shadow-[0_2px_12px_rgba(16,185,129,0.4)]" : "bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white"}`}
          >
            {isRTL ? (c.name_ar || c.name) : c.name}
          </button>
        ))}
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Product area */}
        <main className="flex flex-1 min-h-0 flex-col">
          {/* Search */}
          <div className="shrink-0 px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 rounded-2xl bg-slate-700/60 px-4 py-2.5 focus-within:ring-2 focus-within:ring-emerald-500/50">
              <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isRTL ? "ابحث عن منتج..." : "Search product..."}
                className="w-full bg-transparent text-sm outline-none placeholder-slate-400 text-white"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-slate-400 hover:text-white">×</button>
              )}
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <span className="text-5xl mb-3">🔍</span>
                <span>{isRTL ? "لا توجد منتجات" : "No products"}</span>
              </div>
            ) : (
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: isLarge
                    ? "repeat(auto-fill, minmax(160px, 1fr))"
                    : "repeat(auto-fill, minmax(140px, 1fr))",
                }}
              >
                {filteredProducts.map((p) => (
                  <ProductCard key={p.id} product={p} onSelect={() => setModifierProduct(p)} customImageUrl={customImages[p.id]} />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Desktop side cart */}
        {isLarge && (
          <aside className="flex w-[360px] shrink-0 flex-col border-s border-white/10 bg-slate-800/80">
            {CartPanel}
          </aside>
        )}
      </div>

      {/* ── Tablet: Floating cart button ────────────────────────────── */}
      {!isLarge && (
        <div className="shrink-0 border-t border-white/10 bg-slate-800/90 px-4 py-3">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-emerald-500/20 px-5 py-3 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition"
          >
            <span className="text-sm font-semibold">
              🛒 {isRTL ? "السلة" : "Cart"} {cartItemCount > 0 && <span className="ml-1 rounded-full bg-emerald-500 px-2 py-0.5 text-xs text-white font-bold">{cartItemCount}</span>}
            </span>
            <span className="text-lg font-bold text-emerald-400">{cartTotals.total.toFixed(2)} ر.س</span>
          </button>
        </div>
      )}

      {/* ── Tablet: Cart bottom sheet ────────────────────────────────── */}
      {!isLarge && cartOpen && (
        <>
          <div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[56] flex flex-col bg-slate-800 rounded-t-3xl shadow-2xl" style={{ maxHeight: "85vh" }}>
            {CartPanel}
          </div>
        </>
      )}

      {/* ── Modifier modal ───────────────────────────────────────────── */}
      {modifierProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setModifierProduct(null)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-3xl bg-slate-800 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Product hero */}
            <div className="mb-4 flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
                {(() => {
                  const theme = getProductTheme(modifierProduct.name || "");
                  return (
                    <>
                      {theme.imageUrl
                        ? <img src={theme.imageUrl} alt={modifierProduct.name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        : <div className={`h-full w-full bg-gradient-to-br ${theme.gradientFallback} flex items-center justify-center text-3xl`}>{theme.emoji}</div>}
                    </>
                  );
                })()}
              </div>
              <div>
                <h3 className="text-lg font-bold leading-tight">{modifierProduct.name}</h3>
                <p className="mt-1 text-emerald-400 font-semibold">{(modifierProduct.price || 0).toFixed(1)} ر.س</p>
              </div>
            </div>
            {modifiers.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-sm font-semibold text-slate-300">{isRTL ? "الإضافات" : "Modifiers"}</p>
                <div className="space-y-2">
                  {modifiers.map((m) => {
                    const isSel = selectedMods.some((s) => s.id === m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMods((prev) => isSel ? prev.filter((s) => s.id !== m.id) : [...prev, { id: m.id, name: m.name, price_add: m.price_add }])}
                        className={`flex w-full items-center gap-3 rounded-2xl p-3 text-start transition ${isSel ? "bg-emerald-500/20 ring-1 ring-emerald-500/50" : "bg-slate-700/50 hover:bg-slate-700"}`}
                      >
                        <span className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${isSel ? "border-emerald-400 bg-emerald-500/30" : "border-slate-500"}`}>
                          {isSel && <span className="text-xs text-emerald-300">✓</span>}
                        </span>
                        <span className="flex-1 text-sm">{isRTL ? (m.name_ar || m.name) : m.name}</span>
                        {m.price_add > 0 && <span className="text-emerald-400 text-sm">+{m.price_add} ر.س</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => addToCart(modifierProduct, 1, selectedMods)} className="flex-1 rounded-2xl bg-emerald-500 py-3.5 font-bold text-lg hover:bg-emerald-400 transition">
                {isRTL ? "إضافة للسلة +" : "Add to Cart +"}
              </button>
              <button type="button" onClick={() => { setModifierProduct(null); setSelectedMods([]); }} className="rounded-2xl bg-slate-600 py-3.5 px-5 hover:bg-slate-500 transition">
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment modal ────────────────────────────────────────────── */}
      {showPayment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowPayment(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-slate-800 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-xl font-bold">{isRTL ? "طريقة الدفع" : "Payment"}</h3>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(["cash", "card", "wallet", "delivery_app"] as const).map((pm) => {
                const icon = pm === "cash" ? "💵" : pm === "card" ? "💳" : pm === "wallet" ? "📱" : "🛵";
                const label = isRTL
                  ? (pm === "cash" ? "كاش" : pm === "card" ? "بطاقة" : pm === "wallet" ? "محفظة" : "توصيل")
                  : (pm === "cash" ? "Cash" : pm === "card" ? "Card" : pm === "wallet" ? "Wallet" : "Delivery");
                return (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setPaymentMethod(pm)}
                    className={`rounded-2xl py-4 text-center transition flex flex-col items-center gap-1 ${paymentMethod === pm ? "bg-emerald-500/25 ring-2 ring-emerald-500/60 text-emerald-300" : "bg-slate-700/60 hover:bg-slate-700 text-slate-300"}`}
                  >
                    <span className="text-2xl">{icon}</span>
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-sm text-slate-400">{isRTL ? "خصم %" : "Discount %"}</label>
              <input
                type="number" min={0} max={100} value={discountPercent || ""}
                onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                className="w-full rounded-2xl bg-slate-700 px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none"
              />
            </div>
            <div className="mb-5 rounded-2xl bg-slate-700/40 p-4 text-sm space-y-1">
              <div className="flex justify-between text-slate-400"><span>{isRTL ? "الإجمالي قبل الضريبة" : "Subtotal"}</span><span>{cartTotals.afterDiscount.toFixed(2)} ر.س</span></div>
              <div className="flex justify-between text-slate-400"><span>{isRTL ? "الضريبة 15%" : "Tax 15%"}</span><span>{cartTotals.tax.toFixed(2)} ر.س</span></div>
              <div className="flex justify-between text-xl font-bold text-emerald-400 pt-1"><span>{isRTL ? "الإجمالي" : "Total"}</span><span>{cartTotals.total.toFixed(2)} ر.س</span></div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={doPayment} disabled={processing} className="flex-1 rounded-2xl bg-emerald-500 py-4 font-bold text-lg hover:bg-emerald-400 disabled:opacity-50 transition">
                {processing ? "⏳" : (isRTL ? "✅ تأكيد الدفع" : "✅ Confirm")}
              </button>
              <button type="button" onClick={() => setShowPayment(false)} className="rounded-2xl bg-slate-600 py-4 px-5 hover:bg-slate-500">
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt ──────────────────────────────────────────────────── */}
      {showReceipt && lastSaleData && (
        <ThermalReceiptPrint
          saleNumber={lastSaleData.number}
          total={lastSaleData.total}
          items={lastSaleData.items}
          branchName={user?.branch_name || "POS"}
          tax={lastSaleData.tax}
          subtotal={lastSaleData.subtotal}
          isRTL={isRTL}
          onClose={() => { setShowReceipt(false); setLastSaleData(null); }}
        />
      )}
    </div>
  );
}
