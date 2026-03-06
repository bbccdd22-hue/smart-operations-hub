/**
 * Login page location select – City, District, Branch Type.
 * Aqua Glass style, works on light/dark, Inter font for sharp Arabic.
 */
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { fetchCities, fetchDistricts, fetchBranchTypes } from "../lib/api";
import type { City, District, BranchType } from "../lib/api";

type Option = { id: number; label: string; labelAr?: string; code?: string };

type Props = {
  label: string;
  labelAr: string;
  value: number | "";
  options: Option[];
  onChange: (id: number | "") => void;
  placeholder?: string;
  disabled?: boolean;
  dark?: boolean;
};

function SelectInner({ label, labelAr, value, options, onChange, placeholder, disabled, dark }: Props) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const displayLabel = isRTL ? labelAr : label;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((o) => {
    const q = query.toLowerCase();
    if (!q) return true;
    return (
      o.label.toLowerCase().includes(q) ||
      (o.labelAr || "").toLowerCase().includes(q) ||
      (o.code || "").toLowerCase().includes(q)
    );
  });

  const selected = options.find((o) => o.id === value);
  const displayValue = selected
    ? isRTL && selected.labelAr
      ? selected.labelAr
      : selected.label
    : "";

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const baseInput =
    "login-aqua-select w-full min-h-[44px] rounded-2xl border px-4 py-2.5 text-left text-base outline-none transition backdrop-blur-xl";
  const lightInput =
    "border-slate-300/50 bg-white/40 text-slate-800 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";
  const darkInput =
    "border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:border-emerald-500/60 focus:ring-emerald-500/20";

  return (
    <div ref={containerRef} className="relative">
      <label
        className="mb-1.5 block text-sm font-medium"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        <span className={dark ? "text-white/90" : "text-slate-700"}>{displayLabel}</span>
      </label>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={`${baseInput} ${dark ? darkInput : lightInput} ${
          !displayValue ? (dark ? "text-white/50" : "text-slate-500") : ""
        }`}
      >
        <span>{displayValue || placeholder}</span>
        <svg
          className={`absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 transition ${open ? "rotate-180" : ""} ${
            dark ? "text-white/60" : "text-slate-500"
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-2xl border py-2 backdrop-blur-xl ${
            dark
              ? "border-white/20 bg-slate-900/95"
              : "border-slate-200/80 bg-white/95"
          }`}
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
        >
          <div className="sticky top-0 border-b px-3 pb-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isRTL ? "بحث…" : "Search…"}
              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-500 ${
                dark
                  ? "border-white/20 bg-white/10 text-white placeholder:text-white/40"
                  : "border-slate-200 bg-slate-50/80 text-slate-800 placeholder:text-slate-500"
              }`}
              autoFocus
            />
          </div>
          <div className="max-h-36 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-emerald-500/15 ${
                dark ? "text-white/70 hover:text-emerald-200" : "text-slate-600 hover:text-emerald-700"
              }`}
            >
              — {isRTL ? "لا شيء" : "None"}
            </button>
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-emerald-500/15 ${
                  value === o.id
                    ? dark
                      ? "bg-emerald-500/25 text-emerald-200"
                      : "bg-emerald-500/20 text-emerald-700"
                    : dark
                      ? "text-white/90 hover:text-emerald-200"
                      : "text-slate-800 hover:text-emerald-700"
                }`}
              >
                {isRTL && o.labelAr ? o.labelAr : o.label}
                {o.code && <span className="ml-1.5 opacity-70">[{o.code}]</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type LocationSectionProps = {
  cityId: number | "";
  districtId: number | "";
  branchTypeId: number | "";
  onCityChange: (id: number | "") => void;
  onDistrictChange: (id: number | "") => void;
  onBranchTypeChange: (id: number | "") => void;
  dark?: boolean;
};

export default function LoginLocationSelect({
  cityId,
  districtId,
  branchTypeId,
  onCityChange,
  onDistrictChange,
  onBranchTypeChange,
  dark,
}: LocationSectionProps) {
  const { t } = useTranslation();
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [branchTypes, setBranchTypes] = useState<BranchType[]>([]);

  useEffect(() => {
    fetchCities().then((r) => setCities(Array.isArray(r) ? r : [])).catch(() => setCities([]));
    fetchBranchTypes().then((r) => setBranchTypes(Array.isArray(r) ? r : [])).catch(() => setBranchTypes([]));
  }, []);

  useEffect(() => {
    if (cityId) fetchDistricts(cityId as number).then((r) => setDistricts(Array.isArray(r) ? r : [])).catch(() => setDistricts([]));
    else setDistricts([]);
  }, [cityId]);

  const cityOpts: Option[] = cities.map((c) => ({
    id: c.id,
    label: c.name_en,
    labelAr: c.name_ar,
    code: c.option_code,
  }));
  const districtOpts: Option[] = (Array.isArray(districts) ? districts : []).map((d) => ({
    id: d.id,
    label: d.name_en,
    labelAr: d.name_ar,
    code: d.option_code,
  }));
  const branchTypeOpts: Option[] = (Array.isArray(branchTypes) ? branchTypes : []).map((b) => ({
    id: b.id,
    label: b.name_en,
    labelAr: b.name_ar,
    code: b.option_code,
  }));

  return (
    <div className="space-y-4">
      <p
        className="text-xs font-medium uppercase tracking-wider opacity-80"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        <span className={dark ? "text-white/80" : "text-slate-600"}>
          {t("manageLocations")}
        </span>
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SelectInner
          label={t("city")}
          labelAr="المدينة"
          value={cityId}
          options={cityOpts}
          onChange={onCityChange}
          placeholder="Makkah / مكة"
          dark={dark}
        />
        <SelectInner
          label={t("district")}
          labelAr="الحي"
          value={districtId}
          options={districtOpts}
          onChange={onDistrictChange}
          placeholder="Al-Awali / العوالي"
          disabled={!cityId}
          dark={dark}
        />
        <SelectInner
          label={t("branchType")}
          labelAr="نوع الفرع"
          value={branchTypeId}
          options={branchTypeOpts}
          onChange={onBranchTypeChange}
          placeholder="Kiosk / كشك"
          dark={dark}
        />
      </div>
    </div>
  );
}
