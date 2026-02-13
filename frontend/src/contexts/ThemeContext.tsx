import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const THEME_KEY = "smart-ops-theme";

type ThemeContextValue = {
  dark: boolean;
  setDark: React.Dispatch<React.SetStateAction<boolean>>;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(THEME_KEY) === "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    window.dispatchEvent(new CustomEvent("theme-update", { detail: { dark } }));
  }, [dark]);

  // Sync when toggled from Admin Hub or other sources
  useEffect(() => {
    const handler = (e: CustomEvent<{ dark: boolean }>) => setDark(e.detail.dark);
    window.addEventListener("theme-update", handler as EventListener);
    return () => window.removeEventListener("theme-update", handler as EventListener);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        dark,
        setDark,
        toggleTheme: () => setDark((d) => !d),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
