/**
 * نافذة إدارة صلاحيات الأدوار – سيف فقط
 * Permissions Modal for Role Configuration
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { fetchRolePermissions, updateRolePermissions } from "../lib/api";

const PERMISSION_KEYS = [
  "view_financial_reports",
  "upload_files",
  "view_activity_log",
  "edit_chart_of_accounts",
  "perm_shift_closing",
  "perm_financial_reports",
  "perm_management_reports",
  "perm_full_system_access",
  "perm_order_forecasting",
  "perm_financial_auditor",
  "view_cost_price",
  "cancel_invoice",
  "view_customer_phone",
] as const;

const ROLE_TO_BACKEND: Record<string, string> = {
  owner: "owner",
  brandManager: "brand_manager",
  branchSupervisor: "branch_supervisor",
  generalManager: "general_manager",
  externalAccountant: "external_accountant",
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  roleKey: string;
  roleLabel: string;
};

export default function PermissionsModal({
  open,
  onClose,
  onSuccess,
  roleKey,
  roleLabel,
}: Props) {
  const { t } = useTranslation();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backendRole = ROLE_TO_BACKEND[roleKey] ?? roleKey;

  useEffect(() => {
    if (open && backendRole) {
      setError(null);
      setLoading(true);
      fetchRolePermissions(backendRole)
        .then((r) => {
          setPermissions(r.permissions || {});
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Failed to load");
        })
        .finally(() => setLoading(false));
    }
  }, [open, backendRole]);

  const handleToggle = (key: string) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateRolePermissions(backendRole, permissions);
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card w-full max-w-md rounded-2xl p-6 shadow-2xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {t("managePermissions")} – {roleLabel}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-300">{error}</div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-3">
              {PERMISSION_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 px-4 py-3 transition hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={!!permissions[key]}
                    onChange={() => handleToggle(key)}
                    className="h-5 w-5 rounded border-white/30 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-white/90">{t(`perm_${key}`)}</span>
                </label>
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {saving ? "…" : t("save")}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
