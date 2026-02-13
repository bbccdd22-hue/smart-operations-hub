import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import type { Brand, Branch } from "../lib/api";
import { branchDisplayName } from "../lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  brands: Brand[];
  branches: Branch[];
  createUser: (p: {
    username: string;
    password: string;
    email?: string;
    role: string;
    brand_ids?: number[];
    branch_ids?: number[];
  }) => Promise<unknown>;
};

export default function AddUserModal({
  open,
  onClose,
  onSuccess,
  brands,
  branches,
  createUser,
}: Props) {
  const { t, i18n } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("branch_supervisor");
  const [brandIds, setBrandIds] = useState<number[]>([]);
  const [branchIds, setBranchIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lang = i18n.language;

  useEffect(() => {
    if (open) {
      setUsername("");
      setPassword("");
      setEmail("");
      setRole("branch_supervisor");
      setBrandIds([]);
      setBranchIds([]);
      setError(null);
    }
  }, [open]);

  const toggleBrand = (id: number) => {
    setBrandIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleBranch = (id: number) => {
    setBranchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createUser({
        username: username.trim(),
        password,
        email: email.trim() || undefined,
        role,
        brand_ids: brandIds.length ? brandIds : undefined,
        branch_ids: branchIds.length ? branchIds : undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
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
            <h2 className="text-xl font-bold text-white">{t("addUser")}</h2>
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
              <div className="rounded-lg bg-rose-500/20 px-4 py-2 text-sm text-rose-200">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">
                {t("username")} *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder="e.g. john"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">
                {t("password")} *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={1}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder="Simple password (no complexity rules)"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">
                {t("email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder="optional@email.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">
                {t("role")} *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
              >
                <option value="owner">{t("owner")}</option>
                <option value="brand_manager">{t("brandManager")}</option>
                <option value="branch_supervisor">{t("branchSupervisor")}</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">
                {t("assignedBrands")}
              </label>
              <div className="glass-card max-h-32 overflow-y-auto rounded-xl p-2">
                {brands.length === 0 ? (
                  <p className="py-2 text-center text-sm text-white/50">No brands</p>
                ) : (
                  <div className="space-y-1">
                    {brands.map((b) => (
                      <label
                        key={b.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5"
                      >
                        <input
                          type="checkbox"
                          checked={brandIds.includes(b.id)}
                          onChange={() => toggleBrand(b.id)}
                          className="rounded"
                        />
                        <span className="text-sm text-white/90">{b.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">
                {t("assignedBranches")}
              </label>
              <div className="glass-card max-h-32 overflow-y-auto rounded-xl p-2">
                {branches.length === 0 ? (
                  <p className="py-2 text-center text-sm text-white/50">No branches</p>
                ) : (
                  <div className="space-y-1">
                    {branches.map((b) => (
                      <label
                        key={b.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5"
                      >
                        <input
                          type="checkbox"
                          checked={branchIds.includes(b.id)}
                          onChange={() => toggleBranch(b.id)}
                          className="rounded"
                        />
                        <span className="text-sm text-white/90">
                          {branchDisplayName(b, lang)} ({b.brand?.name})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
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
                disabled={submitting || !username.trim() || !password}
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
