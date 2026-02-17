/**
 * Prep List export – PDF and Excel. Data matches exactly what is shown on screen.
 */
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { ProductionPlanIngredient } from "./api";

/** Amiri TTF for Arabic/RTL support in PDF - loaded once and cached */
let amiriFontBase64: string | null = null;

async function loadAmiriFont(): Promise<string | null> {
  if (amiriFontBase64) return amiriFontBase64;
  try {
    const url = "https://cdn.jsdelivr.net/gh/aliftype/amiri@main/fonts/ttf/Amiri-Regular.ttf";
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    amiriFontBase64 = btoa(binary);
    return amiriFontBase64;
  } catch {
    return null;
  }
}

function addAmiriToDoc(doc: jsPDF): boolean {
  try {
    if (!amiriFontBase64) return false;
    doc.addFileToVFS("Amiri-Regular.ttf", amiriFontBase64);
    doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    return true;
  } catch {
    return false;
  }
}

export type PrepItemExport = {
  sku: string;
  productName: string;
  predictedQty: number;
};

export type ExportOption = "products_only" | "ingredients_only" | "full";

function parseProductFromDisplay(displayName: string): { sku: string; productName: string } {
  const beforePipe = displayName.split("|")[0]?.trim() ?? "";
  const sep = " - ";
  if (beforePipe.includes(sep)) {
    const idx = beforePipe.indexOf(sep);
    return {
      sku: beforePipe.slice(0, idx).trim(),
      productName: beforePipe.slice(idx + sep.length).trim(),
    };
  }
  return { sku: "", productName: beforePipe };
}

export function exportPrepListPDF(
  items: PrepItemExport[],
  ingredients: ProductionPlanIngredient[] | null,
  option: ExportOption,
  meta: { branchName: string; forecastPeriod: string; createdAt: string }
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 20;

  doc.setFontSize(14);
  doc.text("Prep List Report", 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.text(`Branch: ${meta.branchName}`, 14, y);
  y += 6;
  doc.text(`Forecast Period: ${meta.forecastPeriod}`, 14, y);
  y += 6;
  doc.text(`Created: ${meta.createdAt}`, 14, y);
  y += 12;

  if (option === "products_only" || option === "full") {
    doc.setFontSize(11);
    doc.text("Product Forecast", 14, y);
    y += 8;
    doc.setFontSize(9);
    doc.text("SKU", 14, y);
    doc.text("Product Name", 45, y);
    doc.text("Predicted Qty", 140, y);
    y += 6;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y - 2, 196, y - 2);
    y += 4;
    for (const row of items) {
      doc.text(row.sku || "—", 14, y);
      doc.text(row.productName, 45, y);
      doc.text(String(row.predictedQty), 140, y);
      y += 6;
    }
    y += 8;
  }

  if (option === "ingredients_only" || option === "full") {
    if (ingredients && ingredients.length > 0) {
      doc.setFontSize(11);
      doc.text("Ingredient Totals (Raw Materials)", 14, y);
      y += 8;
      doc.setFontSize(9);
      doc.text("Ingredient", 14, y);
      doc.text("Required Qty", 100, y);
      doc.text("Unit", 130, y);
      doc.text("On Hand", 150, y);
      y += 6;
      doc.line(14, y - 2, 196, y - 2);
      y += 4;
      for (const row of ingredients) {
        const namePart =
          row.ingredient_name_ar?.trim()
            ? `${row.ingredient_name} | ${row.ingredient_name_ar}`
            : row.ingredient_name;
        const rmCode = row.serial_code?.trim() || "";
        const nameDisplay = rmCode ? `${rmCode} - ${namePart}` : namePart;
        const workableDisplay = row.workable_display_en || row.workable_display_ar;
        const qtyNum = row.display_qty != null ? parseFloat(row.display_qty) : NaN;
        const unitLabel =
          row.display_unit_label ?? row.display_unit_code ?? row.unit_code;
        const standardUnit =
          unitLabel && Number.isFinite(qtyNum) && qtyNum >= 2
            ? (unitLabel || "").replace(/\bBottle\b/, "Bottles")
            : unitLabel ?? row.unit_code;
        const qtyVal =
          row.display_qty != null && unitLabel
            ? String(row.display_qty)
            : String(row.required_qty);
        const unitVal = workableDisplay || standardUnit;
        doc.text(nameDisplay, 14, y);
        doc.text(qtyVal, 100, y);
        doc.text(unitVal, 130, y);
        doc.text(String(row.on_hand), 150, y);
        y += 6;
      }
    } else if (option === "ingredients_only") {
      doc.text("No ingredient data available. Run search and select products with recipes.", 14, y);
    }
  }

  doc.save(`prep-list-${meta.createdAt.replace(/[/:]/g, "-")}.pdf`);
}

export function exportPrepListExcel(
  items: PrepItemExport[],
  ingredients: ProductionPlanIngredient[] | null,
  option: ExportOption,
  meta: { branchName: string; forecastPeriod: string; createdAt: string }
) {
  const wb = XLSX.utils.book_new();

  const metaSheet = XLSX.utils.aoa_to_sheet([
    ["Prep List Report"],
    [],
    ["Branch", meta.branchName],
    ["Forecast Period", meta.forecastPeriod],
    ["Created", meta.createdAt],
  ]);
  XLSX.utils.book_append_sheet(wb, metaSheet, "Report Info");

  if (option === "products_only" || option === "full") {
    const productData = [
      ["SKU", "Product Name", "Predicted Qty"],
      ...items.map((r) => [r.sku || "—", r.productName, r.predictedQty]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(productData);
    ws["!cols"] = [{ wch: 15 }, { wch: 35 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, "Product Forecast");
  }

  if (option === "ingredients_only" || option === "full") {
    const ingData =
      ingredients && ingredients.length > 0
        ? [
            ["Ingredient", "Required Qty", "Unit", "On Hand"],
            ...ingredients.map((r) => {
              const namePart =
                r.ingredient_name_ar?.trim()
                  ? `${r.ingredient_name} | ${r.ingredient_name_ar}`
                  : r.ingredient_name;
              const rmCode = r.serial_code?.trim() || "";
              const nameDisplay = rmCode ? `${rmCode} - ${namePart}` : namePart;
              const workable = r.workable_display_en || r.workable_display_ar;
              const qtyNum = r.display_qty != null ? parseFloat(r.display_qty) : NaN;
              const unitLabel =
                r.display_unit_label ?? r.display_unit_code ?? r.unit_code;
              const standardUnit =
                unitLabel && Number.isFinite(qtyNum) && qtyNum >= 2
                  ? (unitLabel || "").replace(/\bBottle\b/, "Bottles")
                  : unitLabel ?? r.unit_code;
              const qty =
                r.display_qty != null && unitLabel
                  ? String(r.display_qty)
                  : String(r.required_qty);
              const unit = workable || standardUnit;
              return [nameDisplay, qty, unit, r.on_hand];
            }),
          ]
        : [["No ingredient data. Select products with recipes."]];
    const ws = XLSX.utils.aoa_to_sheet(ingData);
    ws["!cols"] = [{ wch: 25 }, { wch: 14 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Ingredient Totals");
  }

  XLSX.writeFile(wb, `prep-list-${meta.createdAt.replace(/[/:]/g, "-")}.xlsx`);
}

/**
 * Export Daily Ingredients Prep List as PDF - matches user template (image_3cfcbd.png).
 * 4 columns: كود الصنف | Code, اسم الصنف | Item Name, الوحدة | Unit, الكمية الكلية | Total Qty
 * Total Qty format: "Package Count (Exact Amount)" e.g. "1 (1080 g)"
 */
export async function exportDailyPrepListPDF(
  ingredients: ProductionPlanIngredient[] | null,
  meta: { branchName: string; createdAt: string }
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  // Load Arabic font (Amiri) for RTL support
  await loadAmiriFont();
  const hasAmiri = addAmiriToDoc(doc);
  const pdfFont = hasAmiri ? "Amiri" : "helvetica";

  doc.setFont(pdfFont, "normal");
  doc.setFontSize(16);
  doc.text("قائمة تجهيز المكونات اليومية | Daily Ingredients Prep List", centerX, 18, {
    align: "center",
  });

  doc.setFontSize(10);
  const now = new Date();
  const dateStr = now.toLocaleDateString("ar-SA", { dateStyle: "long" });
  const timeStr = now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  doc.text(`التاريخ | Date: ${dateStr}`, centerX, 26, { align: "center" });
  doc.text(`وقت الإنشاء | Generated: ${timeStr}`, centerX, 32, { align: "center" });
  doc.text(`الفرع | Branch: ${meta.branchName}`, centerX, 38, { align: "center" });

  if (!ingredients || ingredients.length === 0) {
    doc.setFontSize(11);
    doc.text("لا توجد بيانات مكونات. قم بالبحث واختر منتجات ذات وصفات.", centerX, 50, {
      align: "center",
    });
    doc.text("No ingredient data. Run search and select products with recipes.", centerX, 58, {
      align: "center",
    });
    doc.save(`daily-prep-list-${meta.createdAt.replace(/[/:]/g, "-")}.pdf`);
    return;
  }

  // 5 columns RTL: م | كود الصنف | اسم الصنف | الوحدة | الكمية
  const headers = [["م", "كود الصنف\nCode", "اسم الصنف\nItem Name", "الوحدة\nUnit", "الكمية\nTotal Qty"]];

  const body = ingredients.map((r, idx) => {
    const itemName =
      r.ingredient_name_ar?.trim()
        ? `${r.ingredient_name} | ${r.ingredient_name_ar}`
        : r.ingredient_name;
    const unitStr = r.workable_unit_ar ?? r.workable_unit_en ?? r.display_unit_label ?? r.unit_code;
    const rawQty = parseFloat(r.workable_qty ?? r.display_qty ?? r.required_qty ?? "0") || 0;
    const pkgQty = Math.ceil(rawQty).toString();

    return [String(idx + 1), r.serial_code?.trim() || "—", itemName, unitStr, pkgQty];
  });

  autoTable(doc, {
    head: headers,
    body,
    startY: 48,
    styles: { font: pdfFont, fontSize: 9 },
    headStyles: {
      font: pdfFont,
      fillColor: [59, 130, 246],
      textColor: 255,
      halign: "center",
      valign: "middle",
    },
    bodyStyles: { font: pdfFont, halign: "right" },
    columnStyles: {
      0: { cellWidth: 14, halign: "center" },
      1: { cellWidth: 24 },
      2: { cellWidth: 60 },
      3: { cellWidth: 45 },
      4: { cellWidth: 24, halign: "center" },
    },
    margin: { left: 14, right: 14 },
    theme: "grid",
  });

  doc.save(`daily-prep-list-${meta.createdAt.replace(/[/:]/g, "-")}.pdf`);
}

export function prepItemsToExport(items: Array<{ product: { name: string; product_sku?: string }; qty: number }>): PrepItemExport[] {
  return items.map((item) => {
    const parsed = parseProductFromDisplay(item.product.name);
    return {
      sku: item.product.product_sku || parsed.sku,
      productName: parsed.productName || item.product.name,
      predictedQty: item.qty,
    };
  });
}
