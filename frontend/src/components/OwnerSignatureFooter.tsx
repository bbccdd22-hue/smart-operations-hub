import { useTranslation } from "react-i18next";
import { useState } from "react";

export const FOOTER_HEIGHT = 28; /* Glass Signature – 28px slim */
const OWNER_EMAIL = "SAAL.NQ@ICLOUD.COM";
const SIDEBAR_WIDTH = 260;

export default function OwnerSignatureFooter() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [hovered, setHovered] = useState(false);

  return (
    <footer
      className="signature-footer fixed bottom-0 z-[100] hidden items-center justify-center lg:flex"
      style={{
        height: FOOTER_HEIGHT,
        left: isRTL ? 0 : SIDEBAR_WIDTH,
        right: isRTL ? SIDEBAR_WIDTH : 0,
        background: "rgba(5, 10, 20, 0.4)",
        borderTop: "1px solid rgba(0, 255, 204, 0.08)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        pointerEvents: "none",
      }}
    >
      <a
        href={`mailto:${OWNER_EMAIL}`}
        className="pointer-events-auto relative flex items-center justify-center gap-1.5 transition hover:opacity-90"
        style={{
          fontFamily: isRTL ? "'Tajawal', sans-serif" : "'Inter', sans-serif",
          color: "rgba(148, 163, 184, 0.9)",
          fontSize: "11px",
          letterSpacing: "0.03em",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="opacity-80" aria-hidden>👑</span>
        <span>{isRTL ? "بإشراف سيف" : "Directed by"}</span>
        <span
          className="font-semibold"
          style={{
            color: "#00ffcc",
            textShadow: hovered ? "0 0 12px rgba(0,255,204,0.5)" : "0 0 8px rgba(0,255,204,0.2)",
          }}
        >
          SAIF
        </span>
        {hovered && (
          <span
            className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px]"
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
          </span>
        )}
      </a>
    </footer>
  );
}
