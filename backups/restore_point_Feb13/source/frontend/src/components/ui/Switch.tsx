/**
 * iOS Glassmorphism-style toggle switch.
 * Active: #34C759 (iOS Green) with backdrop blur + frost. Inactive: semi-transparent dark grey.
 * Label (نشط/غير نشط) can appear inside the track or beside it.
 */
import { useTranslation } from "react-i18next";

type Props = {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  /** Show "نشط" / "غير نشط" label—inside track when checked, beside switch when unchecked */
  showLabel?: boolean;
  /** Optional aria-label for accessibility */
  "aria-label"?: string;
};

export default function Switch({
  checked,
  onChange,
  disabled = false,
  showLabel = false,
  "aria-label": ariaLabel,
}: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const activeLabel = lang === "ar" ? "نشط" : t("active");
  const inactiveLabel = lang === "ar" ? "غير نشط" : t("inactive");

  const THUMB_INSET = 2; // Thumb stays 2px from left/right edges
  const THUMB_SIZE = 20; // Slightly smaller than track height for clear containment

  return (
    <div className="inline-flex items-center justify-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onChange}
        dir="ltr"
        className="relative inline-flex h-8 w-14 shrink-0 cursor-pointer touch-manipulation items-center overflow-hidden rounded-full border-0 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur-md min-w-[56px]"
        style={{
          padding: 0,
          boxSizing: "border-box",
          ...(checked
            ? {
                backgroundColor: "rgba(52, 199, 89, 0.95)",
                boxShadow:
                  "inset 0 1px 2px rgba(255,255,255,0.3), inset 0 0 0 1px rgba(255,255,255,0.15)",
                WebkitBackdropFilter: "blur(8px)",
                backdropFilter: "blur(8px)",
              }
            : {
                backgroundColor: "rgba(62, 62, 62, 0.85)",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)",
                WebkitBackdropFilter: "blur(6px)",
                backdropFilter: "blur(6px)",
              }),
        }}
      >
        {showLabel && checked && (
          <span
            className="absolute left-4 text-[11px] font-medium leading-none text-white"
            style={{ textShadow: "0 1px 1px rgba(0,0,0,0.2)" }}
          >
            {activeLabel}
          </span>
        )}
        <span
          className="pointer-events-none absolute top-1/2 h-5 w-5 shrink-0 -translate-y-1/2 rounded-full bg-white transition-all duration-200"
          style={{
            width: THUMB_SIZE,
            left: checked ? "auto" : THUMB_INSET,
            right: checked ? THUMB_INSET : "auto",
            boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
          }}
        />
      </button>
      {showLabel && !checked && (
        <span className="text-xs font-medium text-white/50">{inactiveLabel}</span>
      )}
    </div>
  );
}
