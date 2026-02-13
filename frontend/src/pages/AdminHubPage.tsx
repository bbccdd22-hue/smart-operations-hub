import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const CARD_CLASS =
  "glass-card flex flex-col gap-2 rounded-xl p-5 transition hover:border-emerald-400/40";

export default function AdminHubPage() {
  const { t } = useTranslation();

  const cards = [
    { key: "users", to: "/admin-hub/users", icon: "👥" },
    { key: "roles", to: "/admin-hub/roles", icon: "🔐" },
    { key: "branches", to: "/admin-hub/branches", icon: "🏪" },
    { key: "brands", to: "/admin-hub/brands", icon: "🏷️" },
    { key: "taxes", to: "/admin-hub/taxes", icon: "📊" },
    { key: "paymentMethods", to: "/admin-hub/payment-methods", icon: "💳" },
    { key: "notificationSettings", to: "/admin-hub/notification-settings", icon: "🔔" },
    { key: "smartUpload", to: "/admin-hub/smart-upload", icon: "📤" },
  ] as const;

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          {t("adminDashboard")}
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {t("adminHubSubtitle")}
        </p>
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
              <div className="font-semibold text-white/95">
                {t(c.key)}
              </div>
              <div className="text-xs text-white/50">
                {t("manageSettings")}
              </div>
            </motion.div>
          </Link>
        ))}
      </motion.div>
    </div>
  );
}
