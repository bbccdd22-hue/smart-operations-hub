import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import AnimatedBackground from "../components/AnimatedBackground";

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { login, loading, error } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const isRTL = i18n.language === "ar";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    try {
      await login(username.trim(), password);
      navigate("/dashboard");
    } catch {
      // Error shown in context
    }
  };

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="relative flex min-h-screen items-center justify-center px-4"
    >
      <AnimatedBackground />
      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="glass-card rounded-3xl p-8 [color:var(--glass-text)]">
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => i18n.changeLanguage(isRTL ? "en" : "ar")}
              className="glass-btn rounded-lg px-3 py-1.5 text-xs [color:var(--glass-text-muted)] hover:[color:var(--glass-text)]"
            >
              {isRTL ? "EN" : "عربي"}
            </button>
          </div>
          <div className="mb-6 flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/20" />
          </div>
          <h1 className="text-center text-2xl font-bold tracking-tight">
            {t("appName")}
          </h1>
          <p className="mt-2 text-center text-sm [color:var(--glass-text-muted)]">
            {isRTL ? "تسجيل الدخول إلى لوحة التحكم" : "Sign in to your dashboard"}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-rose-500/20 px-4 py-3 text-sm text-rose-200"
              >
                {error}
              </motion.div>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-medium [color:var(--glass-text-muted)]">
                {t("username")}
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                className="glass-input w-full rounded-xl px-4 py-3 outline-none transition"
                placeholder={isRTL ? "أدخل اسم المستخدم" : "Enter username"}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium [color:var(--glass-text-muted)]">
                {t("password")}
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="glass-input w-full rounded-xl px-4 py-3 outline-none transition"
                placeholder={isRTL ? "أدخل كلمة المرور" : "Enter password"}
              />
            </label>

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "…" : t("signIn")}
            </button>
          </form>

          <p className="mt-6 text-center text-xs [color:var(--glass-text-subtle)]">
            {isRTL ? "للوصول عبر الشبكة المحلية أو الأنفاق الآمنة" : "Access via local network or secure tunnels"}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
