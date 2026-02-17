import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const CARD_CLASS =
  "page-card flex flex-col gap-2 rounded-xl p-5 transition hover:border-[var(--accent-secondary)]/40";

export default function SettingsPage() {
  const { t } = useTranslation();

  const cards = [
    { key: "taxes", to: "#", icon: "📊" },
    { key: "payments", to: "#", icon: "💳" },
    { key: "reasons", to: "#", icon: "📝" },
    { key: "branches", to: "#", icon: "🏪" },
    { key: "brands", to: "#", icon: "🏷️" },
    { key: "users", to: "/settings/users", icon: "👥" },
    { key: "roles", to: "/settings/roles", icon: "🔐" },
  ] as const;

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold [color:var(--glass-text)]">{t("settings")}</h1>
        <p className="mt-1 text-sm [color:var(--glass-text-muted)]">{t("settingsSubtitle")}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {cards.map((c, i) => (
          <Link key={c.key} to={c.to}>
            <motion.div
              className={CARD_CLASS}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <div className="text-2xl">{c.icon}</div>
              <div className="font-semibold [color:var(--glass-text)]">
                {t(c.key)}
              </div>
              <div className="text-xs [color:var(--glass-text-muted)]">{t("manageSettings")}</div>
            </motion.div>
          </Link>
        ))}
      </motion.div>
    </div>
  );
}
