import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth, isOperationsUser } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import AnimatedBackground from "../components/AnimatedBackground";

/** Clear any stored auth/token data from old network – fixes 403 after IP change */
function clearStaleAuthState() {
  try {
    ["localStorage", "sessionStorage"].forEach((store) => {
      const s = store === "localStorage" ? localStorage : sessionStorage;
      const keys: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k && /auth|token|session|user|csrf/i.test(k)) keys.push(k);
      }
      keys.forEach((k) => s.removeItem(k));
    });
  } catch {
    /* ignore */
  }
}

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { login, loading, error } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const isRTL = i18n.language === "ar";
  const { dark, toggleTheme } = useTheme();

  useEffect(() => {
    clearStaleAuthState();
  }, []);

  useEffect(() => {
    document.title = isRTL ? "تسجيل الدخول" : "Login";
    return () => { document.title = "Smart Operations Hub"; };
  }, [isRTL]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    try {
      const user = await login(username.trim(), password);
      if (user) {
        navigate("/", { replace: true });
      }
    } catch {
      // Error shown in context
    }
  };

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="relative flex min-h-screen min-h-[100dvh] items-center justify-center px-2 py-4 sm:px-4 sm:py-8 md:px-6 md:py-12"
      style={{ fontFamily: "Inter, Lexend, Tajawal, system-ui, sans-serif" }}
    >
      <AnimatedBackground />
      <motion.div
        className="relative z-10 w-full max-w-[440px] shrink-0"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Glassmorphism – 25px blur, Emerald gradient border glow */}
        <div
          className="overflow-hidden rounded-[28px] p-4 sm:p-6 md:p-8"
          style={{
            background: dark ? "rgba(15, 23, 42, 0.58)" : "rgba(248, 250, 252, 0.65)",
            backdropFilter: "blur(25px)",
            WebkitBackdropFilter: "blur(25px)",
            border: dark
              ? "1px solid rgba(16, 185, 129, 0.25)"
              : "1px solid rgba(16, 185, 129, 0.3)",
            boxShadow: dark
              ? "0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 28px rgba(16,185,129,0.15), 0 0 0 1px rgba(16,185,129,0.2)"
              : "0 8px 32px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.6) inset, 0 0 28px rgba(16,185,129,0.12), 0 0 0 1px rgba(16,185,129,0.15)",
          }}
        >
          <div className="mb-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
              title={dark ? "Light mode" : "Dark mode"}
              aria-label={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? "☀️" : "🌙"}
            </button>
            <button
              type="button"
              onClick={() => i18n.changeLanguage(isRTL ? "en" : "ar")}
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
            >
              {isRTL ? "EN" : "عربي"}
            </button>
          </div>
          <form onSubmit={handleSubmit} className="mt-4 space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-200"
              >
                {error}
              </motion.div>
            )}

            <label className="block">
              <span
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-400"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {t("username")}
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                className="login-aqua-input w-full min-h-[48px] rounded-2xl px-4 py-3.5 text-base text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 dark:text-slate-100"
                placeholder={isRTL ? "أدخل اسم المستخدم" : "Enter username"}
              />
            </label>

            <label className="block">
              <span
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-400"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {t("password")}
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="login-aqua-input w-full min-h-[48px] rounded-2xl px-4 py-3.5 text-base text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 dark:text-slate-100"
                placeholder={isRTL ? "أدخل كلمة المرور" : "Enter password"}
              />
            </label>

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full min-h-[48px] rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "…" : t("signIn")}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
            {isRTL ? "للوصول عبر الشبكة المحلية أو الأنفاق الآمنة" : "Access via local network or secure tunnels"}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
