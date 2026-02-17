/**
 * Searchable dropdown – Aqua Glass style.
 * Arabic labels, Emerald/Slate theme, filterable options.
 */
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

export type Option = { id: number; label: string; labelAr?: string };

type Props = {
  label: string;
  labelAr: string;
  value: number | "";
  options: Option[];
  onChange: (id: number | "") => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowNone?: boolean;
};

export default function SearchableSelect({
  label,
  labelAr,
  value,
  options,
  onChange,
  placeholder,
  required,
  disabled,
  allowNone = true,
}: Props) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const displayLabel = isRTL ? labelAr : label;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((o) => {
    const q = query.toLowerCase();
    if (!q) return true;
    const en = o.label.toLowerCase();
    const ar = (o.labelAr || "").toLowerCase();
    return en.includes(q) || ar.includes(q);
  });

  const selected = options.find((o) => o.id === value);
  const displayValue = selected
    ? isRTL && selected.labelAr
      ? selected.labelAr
      : selected.label
    : "";

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-white/80">
        {displayLabel} {required && "*"}
      </label>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="aqua-glass-select w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-left text-white backdrop-blur-md transition hover:border-emerald-500/40 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
      >
        <span className={!displayValue ? "text-white/50" : ""}>
          {displayValue || placeholder}
        </span>
        <svg
          className={`absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60 transition ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="aqua-glass-dropdown absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-2xl border border-white/20 bg-white/10 py-2 backdrop-blur-xl"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}
        >
          <div className="sticky top-0 border-b border-white/10 bg-white/5 px-3 pb-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isRTL ? "بحث…" : "Search…"}
              className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-emerald-500/50"
              autoFocus
            />
          </div>
          <div className="max-h-40 overflow-y-auto py-1">
            {allowNone && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-white/70 hover:bg-emerald-500/15 hover:text-emerald-200"
              >
                — {isRTL ? "لا شيء" : "None"}
              </button>
            )}
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-emerald-500/15 hover:text-emerald-200 ${
                  value === o.id ? "bg-emerald-500/20 text-emerald-200" : "text-white/90"
                }`}
              >
                {isRTL && o.labelAr ? o.labelAr : o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
