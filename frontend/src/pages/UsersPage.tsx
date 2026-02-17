import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "framer-motion";
import UserModal from "../components/UserModal";
import Switch from "../components/ui/Switch";
import {
  API_BASE,
  fetchBrands,
  fetchBranches,
  createUser,
  updateUser,
  deleteUser,
  type Brand,
  type Branch,
} from "../lib/api";

type UserRow = {
  id: number;
  username: string;
  email: string;
  role: string;
  brand_id: number | null;
  branch_id: number | null;
  brand_ids?: number[];
  all_brands?: boolean;
  employee_id?: string;
  is_staff: boolean;
  is_active: boolean;
};

export default function UsersPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.username === "SAIF";
  const location = useLocation();
  const lang = i18n.language;
  const backTo = "/admin-hub";
  const backLabel = t("adminDashboard");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadUsers = () => {
    setLoading(true);
    return fetch(`${API_BASE}/org/users/`, { credentials: "include" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return [];
        return Array.isArray(data) ? data : data?.users ?? [];
      })
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
    fetchBrands().then(setBrands);
    fetchBranches().then(setBranches);
  }, []);

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingUser(null);
  };

  const handleEdit = (u: UserRow) => {
    setEditingUser(u);
    setModalOpen(true);
  };

  const handleDelete = async (id: number, username: string) => {
    if (username === "SAIF") return;
    if (!confirm(t("delete") + " " + username + "?")) return;
    setDeletingId(id);
    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch {
      // Error could be shown via toast
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (u: UserRow) => {
    if (u.username === "SAIF") return;
    setTogglingId(u.id);
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, is_active: !x.is_active } : x))
      );
    } catch {
      // Error
    } finally {
      setTogglingId(null);
    }
  };

  const roleLabel = (r: string) => {
    if (r === "owner") return t("owner");
    if (r === "brand_manager") return t("manager");
    return t("staff");
  };

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to={backTo} className="text-sm text-white/70 hover:text-white">
            ← {backLabel}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-white">{t("users")}</h1>
          <p className="mt-1 text-sm text-white/60">Manage user access and permissions</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingUser(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-[#7c3aed] px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-[#6d28d9]"
        >
          <span>+</span>
          {t("addUser")}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card overflow-hidden rounded-xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] table-fixed text-sm" dir="rtl">
            <thead>
              <tr className="glass-table-header border-b">
                <th className="w-24 shrink-0 px-4 py-3 text-right font-semibold text-white/90">
                  {lang === "ar" ? "إجراءات" : t("actions")}
                </th>
                <th className="min-w-[5rem] px-4 py-3 text-right font-semibold text-white/90">
                  {t("roles")}
                </th>
                <th className="min-w-[4rem] px-4 py-3 text-right font-semibold text-white/90">
                  {lang === "ar" ? "المعرّف" : "ID"}
                </th>
                <th className="min-w-[4rem] px-4 py-3 text-center font-semibold text-white/90">
                  {t("webAccess")}
                </th>
                <th className="min-w-[4rem] px-4 py-3 text-center font-semibold text-white/90">
                  {t("appAccess")}
                </th>
                <th className="min-w-[7rem] px-4 py-3 text-center font-semibold text-white/90">
                  {lang === "ar" ? "الحالة" : t("status")}
                </th>
                <th className="min-w-[12rem] px-4 py-3 text-right font-semibold text-white/90">
                  {lang === "ar" ? "البريد الإلكتروني" : t("email")}
                </th>
                <th className="min-w-[10rem] px-4 py-3 text-right font-semibold text-white/90">
                  {lang === "ar" ? "الاسم" : t("name")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-white/60">
                    Loading…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-white/60">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-white/5 transition hover:bg-white/5"
                  >
                    <td className="w-24 shrink-0 px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isSuperAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEdit(u)}
                              className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                              title={t("edit")}
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {u.username !== "SAIF" && (
                              <button
                                type="button"
                                onClick={() => handleDelete(u.id, u.username)}
                                disabled={deletingId === u.id}
                                className="rounded-lg p-2 text-white/60 transition hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-50"
                                title={t("delete")}
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="min-w-[5rem] px-4 py-3 text-right">
                      <span className="rounded-lg bg-white/10 px-2 py-1 text-xs text-white/80">
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td className="min-w-[4rem] px-4 py-3 text-right font-mono text-xs text-white/70">
                      {u.employee_id || "—"}
                    </td>
                    <td className="min-w-[4rem] px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                          u.is_staff ? "bg-emerald-500/30 text-emerald-200" : "bg-white/10 text-white/50"
                        }`}
                      >
                        {u.is_staff ? "✓" : "—"}
                      </span>
                    </td>
                    <td className="min-w-[4rem] px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                          u.is_active ? "bg-emerald-500/30 text-emerald-200" : "bg-white/10 text-white/50"
                        }`}
                      >
                        {u.is_active ? "✓" : "—"}
                      </span>
                    </td>
                    <td className="min-w-[7rem] px-4 py-3">
                      <div className="flex items-center justify-center">
                        {u.username === "SAIF" ? (
                          <Switch
                            checked
                            onChange={() => {}}
                            disabled
                            showLabel
                            aria-label={t("active")}
                          />
                        ) : (
                          <Switch
                            checked={u.is_active}
                            onChange={() => handleToggleActive(u)}
                            disabled={togglingId === u.id}
                            showLabel
                            aria-label={t("status")}
                          />
                        )}
                      </div>
                    </td>
                    <td className="min-w-[12rem] px-4 py-3 text-right text-white/70">
                      {u.email || "—"}
                    </td>
                    <td className="min-w-[10rem] px-4 py-3 text-right">
                      {location.pathname.startsWith("/admin-hub") ? (
                        <Link
                          to={`/admin-hub/users/${u.id}`}
                          className="font-medium text-white/95 hover:text-emerald-300 hover:underline"
                        >
                          {u.username}
                        </Link>
                      ) : (
                        <span className="font-medium text-white/95">{u.username}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <UserModal
        open={modalOpen}
        onClose={handleModalClose}
        onSuccess={loadUsers}
        brands={brands}
        branches={branches}
        editingUser={editingUser}
        createUser={createUser}
        updateUser={updateUser}
      />
    </div>
  );
}
