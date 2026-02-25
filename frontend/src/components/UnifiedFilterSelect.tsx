/**
 * UnifiedFilterSelect – قائمة منسدلة موحدة للبراندات والفروع
 * تصميم حديث: حواف دائرية، ظلال عائمة، شريط بحث، تحديد الكل/إلغاء
 * يدعم الوضع الليلي كاملاً
 */
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { brandDisplayName, branchDisplayName } from "../lib/api";
import type { Brand, Branch } from "../lib/api";

/** أيقونة العلامة التجارية */
function BrandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 6.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

/** أيقونة الفرع */
function BranchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
    </svg>
  );
}

export type UnifiedFilterSelectMode = "brand" | "branch";

type Props =
  | {
      mode: "brand";
      items: Brand[];
      selected: string[];
      onChange: (slugs: string[]) => void;
      label?: string;
      placeholder?: string;
      submittedBranchIds?: never;
      selectionMode?: "multi";
      disabled?: boolean;
      triggerClassName?: string;
    }
  | {
      mode: "brand";
      items: Brand[];
      selected: string | "";
      onChange: (slug: string | "") => void;
      label?: string;
      placeholder?: string;
      submittedBranchIds?: never;
      selectionMode: "single";
      disabled?: boolean;
      triggerClassName?: string;
    }
  | {
      mode: "branch";
      items: Branch[];
      selected: number[];
      onChange: (ids: number[]) => void;
      label?: string;
      placeholder?: string;
      submittedBranchIds?: number[];
      selectionMode?: "multi";
      disabled?: boolean;
      triggerClassName?: string;
    }
  | {
      mode: "branch";
      items: Branch[];
      selected: number | "";
      onChange: (id: number | "") => void;
      label?: string;
      placeholder?: string;
      submittedBranchIds?: never;
      selectionMode: "single";
      disabled?: boolean;
      triggerClassName?: string;
    };

const MAX_DROPDOWN_HEIGHT = 240;
const DROPDOWN_WIDTH = 280;
const DROPDOWN_WIDTH_MIN = 200;

export default function UnifiedFilterSelect(props: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isRTL = lang === "ar";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: DROPDOWN_WIDTH });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const w = Math.min(DROPDOWN_WIDTH, Math.max(DROPDOWN_WIDTH_MIN, rect.width));
      const left = isRTL ? rect.right - w : rect.left;
      setPosition({
        top: spaceBelow >= 120 ? rect.bottom + 6 : Math.max(8, rect.top - MAX_DROPDOWN_HEIGHT - 6),
        left,
        width: w,
      });
    }
  }, [open, isRTL]);

  const isBrand = props.mode === "brand";
  const isSingle = props.selectionMode === "single";
  const items = props.items;
  const getLabel = (item: Brand | Branch): string =>
    isBrand ? brandDisplayName(item as Brand, lang) : branchDisplayName(item as Branch, lang);
  const selectedCount = isSingle
    ? (props.selected === "" || props.selected === undefined ? 0 : 1)
    : (props.selected as string[] | number[]).length;
  const displayLabel = isSingle
    ? (props.selected === "" || props.selected === undefined
        ? (props.placeholder ?? t("all"))
        : (() => {
            const found = isBrand
              ? items.find((i) => (i as Brand).slug === props.selected)
              : items.find((i) => (i as Branch).id === props.selected);
            return found ? getLabel(found) : (props.placeholder ?? t("all"));
          })())
    : selectedCount === 0
      ? (props.placeholder ?? t("all"))
      : `${selectedCount} ${t("selected")}`;

  const getValue = (item: Brand | Branch): string | number =>
    isBrand ? (item as Brand).slug : (item as Branch).id;

  const normalizedItems = items.map((item) => ({
    item,
    label: getLabel(item),
    value: getValue(item),
  }));

  const filteredItems = search.trim()
    ? normalizedItems.filter((n) =>
        n.label.toLowerCase().includes(search.trim().toLowerCase())
      )
    : normalizedItems;

  const selectAll = () => {
    if (isSingle) {
      if (isBrand) (props as { onChange: (v: string | "") => void }).onChange("");
      else (props as { onChange: (v: number | "") => void }).onChange("");
    } else {
      if (isBrand) (props as { onChange: (v: string[]) => void }).onChange(items.map((b) => (b as Brand).slug));
      else (props as { onChange: (v: number[]) => void }).onChange(items.map((b) => (b as Branch).id));
    }
  };

  const clearAll = () => {
    if (isSingle) {
      if (isBrand) (props as { onChange: (v: string | "") => void }).onChange("");
      else (props as { onChange: (v: number | "") => void }).onChange("");
    } else {
      if (isBrand) (props as { onChange: (v: string[]) => void }).onChange([]);
      else (props as { onChange: (v: number[]) => void }).onChange([]);
    }
  };

  const toggle = (value: string | number) => {
    if (isSingle) {
      if (isBrand) {
        (props as { onChange: (v: string | "") => void }).onChange(value as string);
        setOpen(false);
      } else {
        (props as { onChange: (v: number | "") => void }).onChange(value as number);
        setOpen(false);
      }
    } else {
      if (isBrand) {
        const slugs = props.selected as string[];
        const newSlugs = slugs.includes(value as string)
          ? slugs.filter((s) => s !== value)
          : [...slugs, value as string];
        (props as { onChange: (v: string[]) => void }).onChange(newSlugs);
      } else {
        const ids = props.selected as number[];
        const newIds = ids.includes(value as number)
          ? ids.filter((id) => id !== value)
          : [...ids, value as number];
        (props as { onChange: (v: number[]) => void }).onChange(newIds);
      }
    }
  };

  const isSelected = (value: string | number) =>
    isSingle
      ? props.selected === value
      : isBrand
        ? (props.selected as string[]).includes(value as string)
        : (props.selected as number[]).includes(value as number);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const h = () => setIsMobile(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        open &&
        triggerRef.current &&
        panelRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const Icon = isBrand ? BrandIcon : BranchIcon;

  const dropdownStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed" as const,
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: "70vh",
        width: "100%",
        borderRadius: "1rem 1rem 0 0",
        borderTop: "2px solid rgba(16, 185, 129, 0.3)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.2)",
      }
    : {
        position: "fixed" as const,
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: MAX_DROPDOWN_HEIGHT,
        borderRadius: 16,
        boxShadow: "0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)",
        zIndex: 9999,
      };

  const dropdownContent = (
    <motion.div
      ref={panelRef}
      initial={isMobile ? { y: "100%" } : { opacity: 0, y: -8 }}
      animate={isMobile ? { y: 0 } : { opacity: 1, y: 0 }}
      exit={isMobile ? { y: "100%" } : { opacity: 0, y: -8 }}
      transition={{ type: "tween", duration: 0.2 }}
      className="unified-filter-dropdown filter-popover filter-dropdown-high-contrast"
      data-dropdown-layer
      style={dropdownStyle}
    >
      {/* بحث + الكل/مسح – Dark Navy مع نص أبيض وتباين عالي */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-inherit px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/20 bg-slate-800/80 px-2 py-1.5">
            <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isRTL ? "بحث..." : "Search..."}
              className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-400"
              aria-label={isRTL ? "بحث" : "Search"}
              autoFocus
            />
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={selectAll}
              className="rounded px-1.5 py-1 text-[10px] font-medium text-[#10B981] hover:bg-[#10B981]/20"
            >
              {t("all")}
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded px-1.5 py-1 text-[10px] font-medium text-slate-300 hover:bg-white/10"
            >
              {t("clear")}
            </button>
            {isMobile && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded px-1.5 py-1 text-[10px] font-medium text-slate-300"
              >
                {t("close")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* قائمة العناصر مع شريط تمرير */}
      <div
        className="unified-filter-list dropdown-scrollable overflow-y-auto overflow-x-hidden px-1 py-1.5"
        style={{ maxHeight: isMobile ? "none" : MAX_DROPDOWN_HEIGHT - 80 }}
      >
        {filteredItems.length === 0 ? (
          <div className="py-4 text-center text-sm text-slate-400">
            {isRTL ? "لا توجد نتائج" : "No results"}
          </div>
        ) : (
          filteredItems.map(({ item, label, value }) => {
            const Row = isSingle ? "div" : "label";
            const selected = isSelected(value);
            return (
              <Row
                key={String(value)}
                role={isSingle ? "option" : undefined}
                aria-selected={isSingle ? selected : undefined}
                onClick={isSingle ? () => toggle(value) : undefined}
                onKeyDown={isSingle ? (e) => e.key === "Enter" && toggle(value) : undefined}
                tabIndex={isSingle ? 0 : undefined}
                className={`unified-filter-item flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 transition text-white hover:bg-[#10B981]/25 ${selected && isSingle ? "bg-[#10B981]/30" : ""}`}
              >
                {!isSingle && (
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggle(value)}
                    className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-[#10B981] focus:ring-[#10B981]"
                  />
                )}
                <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-sm text-white">
                  {label}
                </span>
                {isSelected(value) && isSingle && (
                  <span className="text-[#10B981]">✓</span>
                )}
                {!isBrand && "submittedBranchIds" in props && props.submittedBranchIds?.includes(value as number) && (
                  <span className="text-[#10B981]" title="✓">✓</span>
                )}
              </Row>
            );
          })
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="relative flex items-center gap-2">
      {props.label && (
        <span className="w-12 shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400">
          {props.label}
        </span>
      )}
      <button
        ref={triggerRef}
        type="button"
        disabled={"disabled" in props && props.disabled}
        onClick={() => !("disabled" in props && props.disabled) && setOpen((o) => !o)}
        className={`filter-std flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium outline-none transition dark:text-slate-200 ${"triggerClassName" in props && props.triggerClassName ? props.triggerClassName : ""} ${"disabled" in props && props.disabled ? "cursor-not-allowed opacity-60" : ""}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Icon className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
        {displayLabel}
        <svg
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[9998] bg-black/20 dark:bg-black/40"
              aria-hidden
            />
            {createPortal(dropdownContent, document.body, "unified-filter-portal")}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
