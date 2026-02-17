import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import type { Brand, Branch } from "../lib/api";
import { branchDisplayName } from "../lib/api";

type UserData = {
  id?: number;
  username: string;
  email: string;
  role: string;
  brand_id: number | null;
  branch_id: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  brands: Brand[];
  branches: Branch[];
  editingUser: UserData | null;
  createUser: (p: {
    username: string;
    password: string;
    email?: string;
    role: string;
    brand_ids?: number[];
    branch_ids?: number[];
  }) => Promise<unknown>;
  updateUser: (
    id: number,
    p: Partial<{ role: string; brand_id: number | null; branch_id: number | null; password: string; email: string }>
  ) => Promise<unknown>;
};

export default function UserModal({
  open,
  onClose,
  onSuccess,
  brands,
  branches,
  editingUser,
  createUser,
  updateUser,
}: Props) {
  const { t, i18n } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("branch_supervisor");
  const [brandId, setBrandId] = useState<number | "">("");
  const [branchId, setBranchId] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lang = i18n.language;
  const isEdit = !!editingUser;

  useEffect(() => {
    if (open) {
      if (editingUser) {
        setUsername(editingUser.username);
        setPassword("");
        setEmail(editingUser.email || "");
        setRole(editingUser.role || "branch_supervisor");
        setBrandId(editingUser.brand_id ?? "");
        setBranchId(editingUser.branch_id ?? "");
      } else {
        setUsername("");
        setPassword("");
        setEmail("");
        setRole("branch_supervisor");
        setBrandId("");
        setBranchId("");
      }
      setError(null);
    }
  }, [open, editingUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit && editingUser?.id) {
        await updateUser(editingUser.id, {
          role,
          brand_id: brandId ? Number(brandId) : null,
          branch_id: branchId ? Number(branchId) : null,
          password: password || undefined,
          email: email.trim() || undefined,
        });
      } else {
        if (!password) {
          setError("Password required");
          setSubmitting(false);
          return;
        }
        await createUser({
          username: username.trim(),
          password,
          email: email.trim() || undefined,
          role,
          brand_ids: brandId ? [Number(brandId)] : undefined,
          branch_ids: branchId ? [Number(branchId)] : undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6"
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              {isEdit ? t("edit") + " " + t("users") : t("addUser")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-rose-500/20 px-4 py-2 text-sm text-rose-200">{error}</div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t("username")} *</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isEdit}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white disabled:opacity-60"
                placeholder="e.g. john"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">
                {t("password")} {isEdit ? "(leave blank to keep)" : "*"}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!isEdit}
                minLength={isEdit ? 0 : 1}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder={isEdit ? "Optional" : "Simple password (no complexity)"}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t("email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder="optional@email.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t("role")} *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
              >
                <option value="owner">{t("owner")}</option>
                <option value="brand_manager">{t("manager")}</option>
                <option value="branch_supervisor">{t("staff")}</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t("assignedBrands")}</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : "")}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
              >
                <option value="">{t("selectBrand")}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t("assignedBranches")}</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
              >
                <option value="">{t("selectBranch")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {branchDisplayName(b, lang)} ({b.brand?.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="glass-btn flex-1 rounded-xl py-2.5 font-medium text-white/80"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting || !username.trim() || (!isEdit && !password)}
                className="flex-1 rounded-xl bg-[#7c3aed] py-2.5 font-medium text-white transition hover:bg-[#6d28d9] disabled:opacity-50"
              >
                {submitting ? "…" : t("save")}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
