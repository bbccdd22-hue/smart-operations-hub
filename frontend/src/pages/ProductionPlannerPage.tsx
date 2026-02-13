import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  fetchBranches,
  fetchProductsWithRecipes,
  calculateProductionPlan,
  fetchPredictForDate,
  type Branch,
  type ProductWithRecipe,
  type ProductionPlanIngredient
} from "../lib/api";

type LineItem = { product_id?: number; product_name: string; qty: number };

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function ProductionPlannerPage() {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<ProductWithRecipe[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [targetDate, setTargetDate] = useState(toISODate(new Date()));
  const [aiPredicted, setAiPredicted] = useState<number | null>(null);
  const [lines, setLines] = useState<LineItem[]>([{ product_name: "", qty: 0 }]);
  const [ingredients, setIngredients] = useState<ProductionPlanIngredient[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchBranches().then(setBranches);
    fetchProductsWithRecipes().then(setProducts);
  }, []);

  const addLine = () => setLines((prev) => [...prev, { product_name: "", qty: 0 }]);
  const updateLine = (i: number, field: "product_name" | "product_id" | "qty", value: string | number) => {
    setLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const handleUseAiPrediction = async () => {
    if (!branchId) {
      setError("Select a branch first.");
      return;
    }
    setError(null);
    try {
      const res = await fetchPredictForDate({
        branchId: Number(branchId),
        date: targetDate
      });
      setAiPredicted(res.predicted_sales);
      updateLine(0, "qty", Math.round(res.predicted_sales));
    } catch {
      setError("Could not fetch AI prediction.");
    }
  };

  const exportToCsv = () => {
    if (!ingredients?.length) return;
    const headers = "Ingredient,Unit,Required,On Hand,Shortage\n";
    const rows = ingredients.map((i) => {
      const req = Number(i.required_qty) || 0;
      const onHand = Number(i.on_hand) || 0;
      const short = Math.max(0, req - onHand);
      return `"${i.ingredient_name}","${i.unit_code}",${req},${onHand},${short}`;
    });
    const csv = headers + rows.join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `production-plan-${targetDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCalculate = async () => {
    setError(null);
    setIngredients(null);
    if (!branchId) {
      setError("Select a branch.");
      return;
    }
    const items = lines
      .filter((l) => (l.product_id || l.product_name?.trim()) && Number(l.qty) > 0)
      .map((l) =>
        l.product_id
          ? { product_id: l.product_id, qty: Number(l.qty) }
          : { product_name: l.product_name.trim(), qty: Number(l.qty) }
      );
    if (!items.length) {
      setError("Add at least one product with quantity.");
      return;
    }
    setLoading(true);
    try {
      const res = await calculateProductionPlan(branchId, items);
      setIngredients(res.ingredients);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Calculation failed.");
    } finally {
      setLoading(false);
    }
  };

  const reqNum = (s: string) => Number(s) || 0;
  const onHandNum = (s: string) => Number(s) || 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Production Planner</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight dark:text-white">What-If: Raw Material Requirements</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Enter target sales per product; the system explodes the BOM and shows required ingredients vs. current stock.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Branch</span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Target date</span>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">AI predicted sales</span>
            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700">
                {aiPredicted != null ? aiPredicted.toLocaleString() : "—"}
              </span>
              <button
                type="button"
                onClick={handleUseAiPrediction}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Use AI
              </button>
            </div>
          </label>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Products & quantities</span>
            <button
              type="button"
              onClick={addLine}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              + Add line
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  value={line.product_id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      updateLine(i, "product_name", "");
                      updateLine(i, "product_id", undefined as unknown as number);
                    } else {
                      const p = products.find((pr) => pr.id === Number(v));
                      if (p) {
                        updateLine(i, "product_id", p.id);
                        updateLine(i, "product_name", p.name);
                      }
                    }
                  }}
                >
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  placeholder="Qty"
                  value={line.qty || ""}
                  onChange={(e) => updateLine(i, "qty", e.target.value)}
                />
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="rounded-lg px-2 py-1 text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
          <textarea
            className="mt-1 min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            placeholder="Optional notes for this production plan"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleCalculate}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            {loading ? "Calculating…" : "Calculate requirements"}
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
            {error}
          </div>
        )}
      </div>

      {ingredients && ingredients.length > 0 && (
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Required ingredients (vs. stock)</h2>
            <button
              type="button"
              onClick={exportToCsv}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Export CSV
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {ingredients.map((ing) => {
              const req = reqNum(ing.required_qty);
              const onHand = onHandNum(ing.on_hand);
              const pct = req > 0 ? Math.min(100, (onHand / req) * 100) : 100;
              const isShort = onHand < req;
              return (
                <div key={ing.ingredient_id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-600">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{ing.ingredient_name}</span>
                    <span className="tabular-nums text-slate-600 dark:text-slate-400">
                      Need: {ing.required_qty} {ing.unit_code} · On hand: {ing.on_hand} {ing.unit_code}
                    </span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isShort ? "bg-amber-500 dark:bg-amber-600" : "bg-emerald-500 dark:bg-emerald-600"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {isShort && (
                    <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Short by {(req - onHand).toFixed(2)} {ing.unit_code}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ingredients && ingredients.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
          No ingredients found. Ensure products have recipes (BOM) in Recipe & Inventory Management.
        </div>
      )}
    </div>
  );
}
