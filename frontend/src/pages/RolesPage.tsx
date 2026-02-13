import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

const ROLES = [
  { key: "owner", icon: "👑", descKey: "roleDesc_owner" },
  { key: "brandManager", icon: "🏷️", descKey: "roleDesc_brandManager" },
  { key: "branchSupervisor", icon: "🏪", descKey: "roleDesc_branchSupervisor" },
];

const CARD_CLASS =
  "glass-card flex flex-col gap-3 rounded-xl p-6 transition hover:border-emerald-400/40";

export default function RolesPage() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <Link
          to={location.pathname.startsWith("/admin-hub") ? "/admin-hub" : "/settings"}
          className="text-sm text-white/70 hover:text-white"
        >
          ← {location.pathname.startsWith("/admin-hub") ? t("adminDashboard") : t("settings")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">{t("roles")}</h1>
        <p className="mt-1 text-sm text-white/60">{t("rolesSubtitle")}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {ROLES.map((r, i) => (
          <motion.div
            key={r.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={CARD_CLASS}
          >
            <div className="text-3xl">{r.icon}</div>
            <div className="font-semibold text-white/95">
              {t(r.key as "owner" | "brandManager" | "branchSupervisor")}
            </div>
            <div className="text-xs text-white/50">{t(r.descKey)}</div>
            <button
              type="button"
              className="glass-btn mt-2 w-full rounded-lg py-2 text-sm font-medium text-white/80 hover:text-white"
            >
              {t("managePermissions")}
            </button>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
