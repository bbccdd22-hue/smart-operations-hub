import { useTranslation } from "react-i18next";
import { useState } from "react";

const VERSION = "v1.0";
const OWNER_EMAIL = "SAAL.NQ@ICLOUD.COM";

export default function OwnerSignatureFooter() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [hovered, setHovered] = useState(false);

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-2 pt-4"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="signature-footer pointer-events-auto relative rounded-xl px-4 py-2.5"
        style={{
          fontFamily: isRTL ? "'Tajawal', sans-serif" : "'Inter', sans-serif",
          fontWeight: 500,
          letterSpacing: "0.01em",
        }}
      >
        <a
          href={`mailto:${OWNER_EMAIL}`}
          className="flex items-center gap-2 transition hover:opacity-90"
          style={{ color: "var(--glass-text-muted)" }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <span className="text-sm opacity-70" aria-hidden>👑</span>
          <span className="text-sm">
            {isRTL ? "بإشراف سيف" : "Directed by"}
          </span>
          <span
            className="font-semibold"
            style={{
              color: "var(--accent-primary)",
              textShadow: hovered ? "0 0 12px rgba(124,58,237,0.4)" : "none",
              transition: "text-shadow 0.2s ease",
            }}
          >
            SAIF
          </span>
          <span className="opacity-50">|</span>
          <span className="tabular-nums text-xs" style={{ color: "var(--glass-text-subtle)" }}>
            {VERSION}
          </span>
        </a>
        {hovered && (
          <div
            className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg px-3 py-2 text-xs"
            style={{
              background: "var(--glass-bg-strong)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid var(--glass-border)",
              color: "var(--glass-text)",
              boxShadow: "var(--glass-shadow)",
            }}
          >
            {OWNER_EMAIL}
          </div>
        )}
      </div>
    </footer>
  );
}
