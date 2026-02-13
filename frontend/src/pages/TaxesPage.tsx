import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

export default function TaxesPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <Link
          to="/admin-hub"
          className="text-sm text-white/70 hover:text-white"
        >
          ← {t("adminDashboard")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">
          {t("taxes")}
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {t("taxesSubtitle")}
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card rounded-xl p-8 text-center"
      >
        <p className="text-white/60">
          {t("comingSoon")}
        </p>
      </motion.div>
    </div>
  );
}
