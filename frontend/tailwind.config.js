/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: "#F8FAFC",
        "surface-elevated": "#FFFFFF",
        charcoal: "#1E293B",
        "charcoal-muted": "#64748B",
        emerald: {
          DEFAULT: "#10B981",
          50: "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#34D399",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
          800: "#065F46",
          900: "#064E3B",
        },
      },
      fontFamily: {
        sans: ["Inter", "Lexend", "Tajawal", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        display: ["Lexend", "Inter", "sans-serif"],
      },
      borderRadius: {
        "2xl": "24px",
        "3xl": "32px",
      },
      spacing: {
        gutter: "24px",
        "gutter-lg": "32px",
      },
      boxShadow: {
        "float": "0 4px 24px rgba(0, 0, 0, 0.06)",
        "float-lg": "0 8px 32px rgba(0, 0, 0, 0.08)",
        "neumorphic": "8px 8px 16px rgba(0, 0, 0, 0.06), -8px -8px 16px rgba(255, 255, 255, 0.9)",
        "neumorphic-inset": "inset 4px 4px 8px rgba(0, 0, 0, 0.04), inset -4px -4px 8px rgba(255, 255, 255, 0.8)",
        "emerald-glow": "0 0 0 2px rgba(16, 185, 129, 0.35)",
        "emerald-glow-lg": "0 0 20px rgba(16, 185, 129, 0.3)",
      },
      backdropBlur: {
        "sidebar": "20px",
        "card": "24px",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};
