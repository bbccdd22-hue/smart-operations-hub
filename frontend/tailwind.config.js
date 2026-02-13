/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Tajawal", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Arial", "Noto Sans Arabic", "sans-serif"]
      }
    }
  },
  plugins: []
};

