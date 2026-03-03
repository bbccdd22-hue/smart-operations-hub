import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  fetchUserDetail,
  updateUser,
  deleteUser,
  fetchBrands,
  fetchBranches,
  branchDisplayName,
  type UserDetail,
  type Brand,
  type Branch,
} from "../lib/api";
import UserEditModal from "../components/UserEditModal";
import Switch from "../components/ui/Switch";

export default function UserProfilePage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [togglingId, setTogglingId] = useState(false);

  const loadUser = () => {
    if (!id) return;
    setLoading(true);
    fetchUserDetail(Number(id))
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUser();
    fetchBrands().then((r) => setBrands(Array.isArray(r) ? r : [])).catch(() => setBrands([]));
    fetchBranches().then((r) => setBranches(Array.isArray(r) ? r : [])).catch(() => setBranches([]));
  }, [id]);

  const handleToggleActive = async () => {
    if (!user || user.username === "SAIF") return;
    setTogglingId(true);
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      loadUser();
    } finally {
      setTogglingId(false);
    }
  };

  const handleDelete = async (userId: number) => {
    try {
      await deleteUser(userId);
      navigate("/admin-hub/users");
    } catch {
      // error
    }
  };

  const roleLabel = (r: string) => {
    if (r === "owner") return t("owner");
    if (r === "brand_manager") return t("manager");
    return t("staff");
  };

  const lang = i18n.language;
  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username
    : "";
  const isSAIF = user?.username === "SAIF";

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <p className="text-white/70">User not found</p>
        <Link to="/admin-hub/users" className="mt-4 inline-block text-emerald-400 hover:underline">
          ← Back to Users
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] space-y-6">
      <div>
        <Link to="/admin-hub/users" className="text-sm text-white/70 hover:text-white">
          ← {t("users")}
        </Link>
      </div>

      {/* Profile Header - Frosted Glass */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden rounded-2xl p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#7c3aed]/30 text-2xl font-bold text-white">
              {(displayName || user.username).charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{displayName || user.username}</h1>
              <p className="mt-1 text-white/70">{user.email || "—"}</p>
              <p className="mt-0.5 text-sm text-white/60">{user.phone || "—"}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-lg bg-white/10 px-2 py-1 text-sm text-white/90">
                  {roleLabel(user.role)}
                </span>
                {!isSAIF && (
                  <Switch
                    checked={user.is_active}
                    onChange={handleToggleActive}
                    disabled={!!togglingId}
                    showLabel
                  />
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="glass-btn flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white/90 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {t("editUser")}
            </button>
            <button
              type="button"
              className="glass-btn flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white/90 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {t("changePassword")}
            </button>
            <Link
              to="/admin-hub/notification-settings"
              className="glass-btn flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white/90 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538.214 1.055.595 1.43L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {t("notifications")}
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Data Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card rounded-2xl p-6"
      >
        <h2 className="mb-4 text-lg font-semibold text-white">Profile Info</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs text-white/50">{t("email")}</div>
            <div className="font-medium text-white/95">{user.email || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-white/50">{t("phone")}</div>
            <div className="font-medium text-white/95">{user.phone || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-white/50">{t("employeeId")}</div>
            <div className="font-medium text-white/95">{user.employee_id || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-white/50">{t("lastLogin")}</div>
            <div className="font-medium text-white/95">
              {user.last_login
                ? new Date(user.last_login).toLocaleString(lang === "ar" ? "ar-SA" : "en")
                : "—"}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Roles & Branches */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{t("roles")}</h2>
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              {t("editRoles")}
            </button>
          </div>
          <div className="mt-4">
            <span className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/90">
              {roleLabel(user.role)}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{t("branches")}</h2>
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              {t("editBranches")}
            </button>
          </div>
          <div className="mt-4">
            {user.branch ? (
              <div className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/90">
                {branchDisplayName(user.branch as Branch, lang)} ({user.brand?.name})
              </div>
            ) : (
              <p className="text-sm text-white/50">No branch assigned</p>
            )}
          </div>
        </motion.div>
      </div>

      <UserEditModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={loadUser}
        onDelete={!isSAIF ? handleDelete : undefined}
        user={user}
        brands={brands}
        branches={branches}
        updateUser={updateUser}
      />
    </div>
  );
}
