import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DENOMS, denomTotal, round2, variance, type DenomCounts } from "../lib/money";
import {
  Branch,
  Brand,
  deleteShiftClosingAttachment,
  fetchBranches,
  fetchBrands,
  fetchShiftClosingAttachments,
  getShiftClosingByBranchDate,
  lookupSystemCash,
  submitShiftClosing,
  uploadShiftClosingAttachment,
  type ShiftClosingAttachmentItem,
} from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

type MoneyInputs = {
  pettyCash: number;
  mada: number;
  visa: number;
  master: number;
  hungerstation: number;
  jahez: number;
  lugmety: number;
  chefz: number;
  toyou: number;
  expensesVouchers: number;
  staffDrinks: number;
  systemCash: number;
  systemNetwork: number;
};

type ShiftHeader = {
  date: string;
  shiftType: "morning" | "evening" | "late_night";
  brandId?: number;
  brandSlug?: string;
  branchId?: number;
  notes: string;
};

function num(v: string) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-slate-600">{label}</div>
      <input
        className="glass-input w-full rounded-xl px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
        inputMode="decimal"
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) => onChange(num(e.target.value))}
        disabled={disabled}
      />
    </label>
  );
}

export default function ShiftClosingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isBranchSupervisor = user?.role === "branch_supervisor";
  const lockedBranchId = isBranchSupervisor ? user?.branch_id ?? null : null;

  const [counts, setCounts] = useState<DenomCounts>(() => ({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    1: 0
  }));

  const [m, setM] = useState<MoneyInputs>({
    pettyCash: 0,
    mada: 0,
    visa: 0,
    master: 0,
    hungerstation: 0,
    jahez: 0,
    lugmety: 0,
    chefz: 0,
    toyou: 0,
    expensesVouchers: 0,
    staffDrinks: 0,
    systemCash: 0,
    systemNetwork: 0
  });

  const [header, setHeader] = useState<ShiftHeader>({
    date: new Date().toISOString().slice(0, 10),
    shiftType: "morning",
    notes: ""
  });
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isFetchingSystemCash, setIsFetchingSystemCash] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLoadingClosing, setIsLoadingClosing] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<ShiftClosingAttachmentItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchBrands().then(setBrands);
  }, []);

  useEffect(() => {
    const slug = isBranchSupervisor ? (user?.brand_slug ?? null) : header.brandSlug ?? null;
    if (!slug) {
      setBranches([]);
      return;
    }
    fetchBranches(slug).then((b) => {
      setBranches(b);
      if (lockedBranchId) {
        const branch = b.find((br) => br.id === lockedBranchId);
        if (branch) {
          setHeader((h) => ({
            ...h,
            brandSlug: branch.brand.slug,
            brandId: branch.brand.id,
            branchId: lockedBranchId,
          }));
        }
      }
    });
  }, [header.brandSlug, user?.brand_slug, lockedBranchId, isBranchSupervisor]);

  useEffect(() => {
    if (!header.branchId || !header.date) return;
    setIsFetchingSystemCash(true);
    lookupSystemCash(header.branchId, header.date)
      .then((val) => setM((p) => ({ ...p, systemCash: val })))
      .finally(() => setIsFetchingSystemCash(false));
  }, [header.branchId, header.date]);

  useEffect(() => {
    if (!header.branchId || !header.date) {
      setIsSubmitted(false);
      return;
    }
    setIsLoadingClosing(true);
    getShiftClosingByBranchDate({
      branchId: header.branchId,
      date: header.date,
      shiftType: header.shiftType,
    })
      .then(({ closing, is_submitted }) => {
        setIsSubmitted(is_submitted);
        if (closing) {
          const c = closing as Record<string, unknown>;
          setClosingId(typeof c.id === "number" ? c.id : null);
          setCounts({
            500: Number(c.bills_500 ?? 0),
            200: Number(c.bills_200 ?? 0),
            100: Number(c.bills_100 ?? 0),
            50: Number(c.bills_50 ?? 0),
            20: Number(c.bills_20 ?? 0),
            10: Number(c.bills_10 ?? 0),
            5: Number(c.bills_5 ?? 0),
            1: Number(c.bills_1 ?? 0),
          });
          setM({
            pettyCash: Number((c as { opening_petty_cash?: number }).opening_petty_cash ?? 0),
            mada: Number(c.mada ?? 0),
            visa: Number(c.visa ?? 0),
            master: Number(c.master_card ?? 0),
            hungerstation: Number(c.hungerstation ?? 0),
            jahez: Number(c.jahez ?? 0),
            lugmety: Number(c.lugmety ?? 0),
            chefz: Number(c.the_chefz ?? 0),
            toyou: Number(c.toyou ?? 0),
            expensesVouchers: Number(c.expenses_vouchers ?? 0),
            staffDrinks: Number(c.staff_drinks ?? 0),
            systemCash: Number(c.system_cash ?? 0),
            systemNetwork: Number(c.system_network ?? 0),
          });
          setHeader((h) => ({ ...h, notes: String((c as { shift_notes?: string }).shift_notes ?? "") }));
        } else {
          setClosingId(null);
        }
      })
      .finally(() => setIsLoadingClosing(false));
  }, [header.branchId, header.date, header.shiftType]);

  useEffect(() => {
    if (!closingId || isSubmitted) {
      setAttachments([]);
      return;
    }
    fetchShiftClosingAttachments(closingId).then(setAttachments);
  }, [closingId, isSubmitted]);

  const cashTotal = useMemo(() => denomTotal(counts), [counts]);
  const networkTotal = useMemo(() => round2(m.mada + m.visa + m.master), [m.mada, m.visa, m.master]);
  const deliveryTotal = useMemo(
    () => round2(m.hungerstation + m.jahez + m.lugmety + m.chefz + m.toyou),
    [m.hungerstation, m.jahez, m.lugmety, m.chefz, m.toyou]
  );

  const varianceCash = useMemo(() => variance(cashTotal, m.systemCash), [cashTotal, m.systemCash]);
  const varianceNetwork = useMemo(() => variance(networkTotal, m.systemNetwork), [networkTotal, m.systemNetwork]);

  const formatSAR = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "SAR" }).format(n);

  const buildPayload = useCallback(
    (submit: boolean) => {
      if (!header.branchId || !header.date) return null;
      return {
        branch_id: header.branchId,
        date: header.date,
        shift_type: header.shiftType,
        notes: header.notes,
        submit,
        bills_500: counts[500],
        bills_200: counts[200],
        bills_100: counts[100],
        bills_50: counts[50],
        bills_20: counts[20],
        bills_10: counts[10],
        bills_5: counts[5],
        bills_1: counts[1],
        mada: m.mada,
        visa: m.visa,
        master_card: m.master,
        hungerstation: m.hungerstation,
        jahez: m.jahez,
        lugmety: m.lugmety,
        the_chefz: m.chefz,
        toyou: m.toyou,
        expenses_vouchers: m.expensesVouchers,
        staff_drinks: m.staffDrinks,
        opening_petty_cash: m.pettyCash,
        system_cash: m.systemCash,
        system_network: m.systemNetwork,
        system_delivery: deliveryTotal,
        system_total_sales: round2(m.systemCash + m.systemNetwork + deliveryTotal),
      };
    },
    [header, counts, m, deliveryTotal]
  );

  const handleSaveDraft = async () => {
    const payload = buildPayload(false);
    if (!payload) return;
    setIsSubmitting(true);
    try {
      const res = await submitShiftClosing(payload);
      const c = res.closing as Record<string, unknown>;
      setClosingId(typeof c?.id === "number" ? c.id : null);
      setIsSubmitted(res.is_submitted);
    } catch {
      // Error handled by user
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveSubmit = async () => {
    const payload = buildPayload(true);
    if (!payload) return;
    setIsSubmitting(true);
    try {
      const res = await submitShiftClosing(payload);
      const c = res.closing as Record<string, unknown>;
      setClosingId(typeof c?.id === "number" ? c.id : null);
      setIsSubmitted(res.is_submitted);
      setShowConfirmModal(false);
    } catch {
      // Error shown
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length || !closingId || isSubmitted) return;
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    const toUpload = list.filter((f) => allowed.includes(f.type));
    if (!toUpload.length) return;
    setIsUploading(true);
    try {
      for (const file of toUpload) {
        const uploaded = await uploadShiftClosingAttachment(closingId, file);
        setAttachments((prev) => [uploaded, ...prev]);
      }
    } catch {
      // Error - could add toast
    } finally {
      setIsUploading(false);
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    await uploadFiles(files);
    e.target.value = "";
  };

  const handleAttachmentDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer.files?.length || !closingId || isSubmitted) return;
    await uploadFiles(e.dataTransfer.files);
  };

  const handleAttachmentDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleAttachmentDelete = async (id: number) => {
    if (isSubmitted) return;
    try {
      await deleteShiftClosingAttachment(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // Error
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card space-y-3 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500">{t("shiftClosing")}</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("shiftClosing")}</h1>
          </div>
          <div className="text-xs text-slate-500">
            Logged in as: <span className="font-semibold">{user?.username ?? "—"}</span>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="block text-xs">
            <div className="mb-1 font-medium text-slate-600">Date</div>
            <input
              type="date"
              className="glass-input w-full rounded-xl px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
              value={header.date}
              onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))}
              disabled={isSubmitted}
            />
          </label>

          <label className="block text-xs">
            <div className="mb-1 font-medium text-slate-600">Shift Type</div>
            <select
              className="glass-input w-full rounded-xl px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
              value={header.shiftType}
              onChange={(e) =>
                setHeader((h) => ({
                  ...h,
                  shiftType: e.target.value as ShiftHeader["shiftType"]
                }))
              }
              disabled={isSubmitted}
            >
              <option value="morning">Morning Shift</option>
              <option value="evening">Evening Shift</option>
              <option value="late_night">Late Night Shift</option>
            </select>
          </label>

          <label className="block text-xs">
            <div className="mb-1 font-medium text-slate-600">Brand</div>
            <select
              className="glass-input w-full rounded-xl px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
              value={header.brandSlug ?? ""}
              onChange={(e) => {
                if (isBranchSupervisor) return;
                const slug = e.target.value || undefined;
                const brand = brands.find((b) => b.slug === slug);
                setHeader((h) => ({
                  ...h,
                  brandSlug: slug,
                  brandId: brand?.id,
                  branchId: undefined
                }));
              }}
              disabled={isBranchSupervisor || isSubmitted}
            >
              <option value="">Select brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs">
            <div className="mb-1 font-medium text-slate-600">Branch</div>
            <select
              className="glass-input w-full rounded-xl px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
              value={header.branchId ?? ""}
              onChange={(e) => {
                if (isBranchSupervisor) return;
                setHeader((h) => ({
                  ...h,
                  branchId: e.target.value ? Number(e.target.value) : undefined
                }));
              }}
              disabled={isBranchSupervisor || isSubmitted}
            >
              <option value="">Select branch</option>
              {branches.map((br) => (
                <option key={br.id} value={br.id}>
                  {br.name}
                </option>
              ))}
            </select>
            {isBranchSupervisor && (
              <div className="mt-1 text-[11px] text-amber-600">Locked to your branch</div>
            )}
          </label>
        </div>

        <label className="block text-xs">
          <div className="mb-1 font-medium text-slate-600">Manual Notes</div>
          <textarea
            className="glass-input min-h-[64px] w-full rounded-xl px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
            value={header.notes}
            onChange={(e) => setHeader((h) => ({ ...h, notes: e.target.value }))}
            placeholder="Record incidents, shortages, vouchers, etc."
            disabled={isSubmitted}
          />
        </label>

        <div className="mt-4 rounded-2xl border border-dashed border-slate-300/60 bg-slate-50/50 p-4 dark:border-slate-600/50 dark:bg-slate-800/30">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              رفع صور العمليات الورقية / Image Upload
            </h3>
            {!closingId && !isSubmitted && (
              <span className="text-xs text-amber-600 dark:text-amber-500">
                احفظ المسودة أولاً لإضافة المرفقات / Save draft first to add attachments
              </span>
            )}
          </div>
          {closingId && !isSubmitted && (
            <label
              className="relative mb-3 flex min-h-[140px] cursor-pointer touch-manipulation flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 transition hover:border-emerald-500 hover:bg-emerald-50/50 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/20"
              style={{ touchAction: "manipulation" }}
              onDrop={handleAttachmentDrop}
              onDragOver={handleAttachmentDragOver}
              onDragLeave={handleAttachmentDragOver}
            >
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                capture="environment"
                multiple
                className="hidden"
                onChange={handleAttachmentUpload}
                disabled={isUploading}
              />
              {isUploading && (
                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80 dark:bg-slate-900/80">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                </span>
              )}
              <svg className="mb-2 h-12 w-12 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12v8m0 0l3-3m-3 3l-3-3" />
              </svg>
              <span className="text-center text-sm font-medium text-slate-600 dark:text-slate-400">
                {isUploading ? "جاري الرفع…" : "انقر أو التقط بالجوال · اسحب للرفع"}
              </span>
              <span className="mt-1 text-xs text-slate-500">JPEG, PNG, WebP · رفع متعدد · كاميرا مباشرة</span>
            </label>
          )}
          {attachments.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {attachments.map((att) => (
                <div key={att.id} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                  <img
                    src={att.file_url}
                    alt={att.caption || "Attachment"}
                    className="h-24 w-full object-cover"
                  />
                  {!isSubmitted && (
                    <button
                      type="button"
                      onClick={() => handleAttachmentDelete(att.id)}
                      className="absolute right-1 top-1 min-h-[44px] min-w-[44px] rounded-full bg-rose-500/90 p-2 text-white opacity-90 transition hover:bg-rose-600 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {att.caption && (
                    <div className="truncate px-2 py-1 text-xs text-slate-500">{att.caption}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!isSubmitted && header.branchId && (
            <>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSubmitting}
                className="glass-btn rounded-xl px-4 py-2 text-sm font-medium text-white/90 disabled:opacity-50"
              >
                {isSubmitting ? "Saving…" : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={isSubmitting}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                اعتماد وإرسال / Approve & Submit
              </button>
            </>
          )}
          {isSubmitted && (
            <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800">
              ✓ تم الإرسال / Submitted
            </span>
          )}
        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowConfirmModal(false)}>
          <div className="glass-card max-w-md rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900">Confirm Submission</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to approve and submit this shift? Once submitted, all fields will be locked and cannot be changed.
            </p>
            <p className="mt-1 text-xs text-slate-500">هل أنت متأكد من اعتماد وإرسال نوبة العمل؟</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveSubmit}
                disabled={isSubmitting}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSubmitting ? "Submitting…" : "اعتماد وإرسال / Approve & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("denominationCounter")}</h2>
            <div className="text-xs text-slate-500">{t("cash")}: {formatSAR(cashTotal)}</div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {DENOMS.map((d) => (
              <label key={d} className="block">
                <div className="mb-1 text-xs font-medium text-slate-600">{d} SAR</div>
                <input
                  className="glass-input w-full rounded-xl px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
                  inputMode="numeric"
                  value={counts[d]}
                  onChange={(e) =>
                    setCounts((prev) => ({
                      ...prev,
                      [d]: Math.max(0, Math.floor(num(e.target.value)))
                    }))
                  }
                  disabled={isSubmitted}
                />
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 p-3">
              <div className="text-xs font-medium text-slate-500">{t("manualTotals")}</div>
              <div className="mt-1 text-lg font-semibold">{formatSAR(cashTotal)}</div>
              <div className="mt-1 text-xs text-slate-500">
                Deductions: {t("expensesVouchers")} + {t("staffDrinks")} (stored separately)
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 p-3">
              <div className="text-xs font-medium text-slate-500">{t("variance")} — {t("cash")}</div>
              <div className="mt-1 text-lg font-semibold">{formatSAR(varianceCash)}</div>
              <div className="mt-1 text-xs text-slate-500">
                Manual cash − System cash
              </div>
            </div>
          </div>
        </section>

        <section className="glass-card rounded-2xl p-4">
          <h2 className="text-sm font-semibold">Revenue sources</h2>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("pettyCash")} value={m.pettyCash} onChange={(v) => setM((p) => ({ ...p, pettyCash: v }))} disabled={isSubmitted} />
              <Field
                label={t("expensesVouchers")}
                value={m.expensesVouchers}
                onChange={(v) => setM((p) => ({ ...p, expensesVouchers: v }))}
                disabled={isSubmitted}
              />
              <Field
                label={t("staffDrinks")}
                value={m.staffDrinks}
                onChange={(v) => setM((p) => ({ ...p, staffDrinks: v }))}
                disabled={isSubmitted}
              />
            </div>

            <div className="rounded-xl border border-slate-100 p-3">
              <div className="text-xs font-medium text-slate-500">{t("network")}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="MADA" value={m.mada} onChange={(v) => setM((p) => ({ ...p, mada: v }))} disabled={isSubmitted} />
                <Field label="VISA" value={m.visa} onChange={(v) => setM((p) => ({ ...p, visa: v }))} disabled={isSubmitted} />
                <Field label="MASTER" value={m.master} onChange={(v) => setM((p) => ({ ...p, master: v }))} disabled={isSubmitted} />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-600">Manual network total</span>
                <span className="font-semibold">{formatSAR(networkTotal)}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 p-3">
              <div className="text-xs font-medium text-slate-500">{t("delivery")}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field
                  label="Hungerstation"
                  value={m.hungerstation}
                  onChange={(v) => setM((p) => ({ ...p, hungerstation: v }))}
                  disabled={isSubmitted}
                />
                <Field label="Jahez" value={m.jahez} onChange={(v) => setM((p) => ({ ...p, jahez: v }))} disabled={isSubmitted} />
                <Field label="Lugmety" value={m.lugmety} onChange={(v) => setM((p) => ({ ...p, lugmety: v }))} disabled={isSubmitted} />
                <Field label="The Chefz" value={m.chefz} onChange={(v) => setM((p) => ({ ...p, chefz: v }))} disabled={isSubmitted} />
                <Field label="ToYou" value={m.toyou} onChange={(v) => setM((p) => ({ ...p, toyou: v }))} disabled={isSubmitted} />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-600">Delivery total</span>
                <span className="font-semibold">{formatSAR(deliveryTotal)}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-slate-500">{t("systemTotals")}</div>
                <div className="text-[11px] text-slate-500">
                  {isFetchingSystemCash ? "Loading system cash from Excel…" : "Excel archive (daily sales)"}
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field
                  label={t("shiftTotalSpan")}
                  value={m.systemNetwork}
                  onChange={(v) => setM((p) => ({ ...p, systemNetwork: v }))}
                  disabled={isSubmitted}
                />
                <Field
                  label={t("foodicsCash")}
                  value={m.systemCash}
                  onChange={(v) => setM((p) => ({ ...p, systemCash: v }))}
                  disabled={isSubmitted}
                />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs font-medium text-slate-500">{t("shiftFoodicsNetwork")}</div>
                  <div
                    className={`mt-1 text-lg font-semibold ${Math.abs(varianceNetwork) > 0.5 ? "text-rose-600" : ""}`}
                  >
                    {formatSAR(varianceNetwork)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Manual network total − {t("shiftTotalSpan")}
                  </div>
                  <div className="mt-2 text-xs">
                    {Math.abs(varianceNetwork) > 0.5 ? (
                      <span className="font-semibold text-rose-600">{t("shiftStatusMismatch")}</span>
                    ) : (
                      <span className="font-semibold text-emerald-700">{t("shiftStatusOK")}</span>
                    )}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs font-medium text-slate-500">{t("shiftFoodicsCash")}</div>
                  <div
                    className={`mt-1 text-lg font-semibold ${Math.abs(varianceCash) > 0.5 ? "text-rose-600" : ""}`}
                  >
                    {formatSAR(varianceCash)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Manual cash − System cash
                  </div>
                  <div className="mt-2 text-xs">
                    {Math.abs(varianceCash) > 0.5 ? (
                      <span className="font-semibold text-rose-600">{t("shiftStatusMismatch")}</span>
                    ) : (
                      <span className="font-semibold text-emerald-700">{t("shiftStatusOK")}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-1 text-xs text-slate-500">{t("shiftThresholdLabel")}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

