import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import PermissionsModal from "../components/PermissionsModal";

const ROLES = [
  { key: "owner", icon: "👑", descKey: "roleDesc_owner" },
  { key: "generalManager", icon: "📋", descKey: "roleDesc_generalManager" },
  { key: "brandManager", icon: "🏷️", descKey: "roleDesc_brandManager" },
  { key: "branchSupervisor", icon: "🏪", descKey: "roleDesc_branchSupervisor" },
  { key: "externalAccountant", icon: "📊", descKey: "roleDesc_externalAccountant" },
] as const;

const CARD_CLASS =
  "glass-card flex flex-col gap-3 rounded-xl p-6 transition hover:border-emerald-400/40";

const ROLE_LABELS: Record<string, string> = {
  owner: "owner",
  generalManager: "generalManager",
  brandManager: "brandManager",
  branchSupervisor: "branchSupervisor",
  externalAccountant: "externalAccountant",
};

export default function RolesPage() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const { addToast } = useNotifications() ?? { addToast: () => {} };
  const isSuperAdmin = user?.username === "SAIF";

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<{ key: string; label: string } | null>(null);

  const handleManageClick = (roleKey: string, roleLabel: string) => {
    if (!isSuperAdmin) {
      addToast(t("permissionsSaifOnly"), t("permissionsSaifOnly"));
      return;
    }
    setSelectedRole({ key: roleKey, label: t(ROLE_LABELS[roleKey] ?? roleKey) });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedRole(null);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <Link
          to="/admin-hub"
          className="text-sm text-white/70 hover:text-white"
        >
          ← {t("adminDashboard")}
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
              {t(ROLE_LABELS[r.key] ?? r.key)}
            </div>
            <div className="text-xs text-white/50">{t(r.descKey)}</div>
            <button
              type="button"
              onClick={() => handleManageClick(r.key, t(ROLE_LABELS[r.key] ?? r.key))}
              className="glass-btn mt-2 w-full rounded-lg py-2 text-sm font-medium text-white/80 hover:text-white"
            >
              {t("managePermissions")}
            </button>
          </motion.div>
        ))}
      </motion.div>

      {selectedRole && (
        <PermissionsModal
          open={modalOpen}
          onClose={handleCloseModal}
          onSuccess={() => {
            addToast(t("save"), "تم حفظ الصلاحيات بنجاح");
            refresh(); // تحديث صلاحيات المستخدم الحالي فوراً
          }}
          roleKey={selectedRole.key}
          roleLabel={selectedRole.label}
        />
      )}
    </div>
  );
}
