import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import type { Brand, Branch } from "../lib/api";
import { branchDisplayName } from "../lib/api";
import type { UserDetail } from "../lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onDelete?: (id: number) => void;
  user: UserDetail | null;
  brands: Brand[];
  branches: Branch[];
  updateUser: (id: number, payload: Record<string, unknown>) => Promise<unknown>;
};

export default function UserEditModal({
  open,
  onClose,
  onSuccess,
  onDelete,
  user,
  brands,
  branches,
  updateUser,
}: Props) {
  const { t, i18n } = useTranslation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [loginCode, setLoginCode] = useState("");
  const [role, setRole] = useState("branch_supervisor");
  const [brandId, setBrandId] = useState<number | "">("");
  const [brandIds, setBrandIds] = useState<number[]>([]);
  const [allBrands, setAllBrands] = useState(false);
  const [branchId, setBranchId] = useState<number | "">("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lang = i18n.language;
  const isSAIF = user?.username === "SAIF";

  useEffect(() => {
    if (open && user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setEmployeeId(user.employee_id || "");
      setPreferredLanguage(user.preferred_language || "en");
      setLoginCode(user.login_code || "");
      setRole(user.role || "branch_supervisor");
      setBrandId(user.brand_id ?? "");
      setBrandIds(user.brand_ids || []);
      setAllBrands(user.all_brands || false);
      setBranchId(user.branch_id ?? "");
      setPassword("");
      setError(null);
    }
  }, [open, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        employee_id: employeeId.trim() || undefined,
        preferred_language: preferredLanguage,
        login_code: loginCode.trim() || undefined,
        role: isSAIF ? undefined : role,
      };
      if (role === "brand_manager") {
        payload.all_brands = allBrands;
        payload.brand_ids = allBrands ? [] : brandIds;
        payload.brand_id = null;
        payload.branch_id = null;
      } else {
        payload.brand_id = brandId ? Number(brandId) : null;
        payload.branch_id = branchId ? Number(branchId) : null;
      }
      if (password) payload.password = password;
      await updateUser(user.id, payload);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!user || !onDelete) return;
    if (confirm(t("deleteUser") + " " + user.username + "?")) {
      onDelete(user.id);
      onClose();
    }
  };

  if (!open || !user) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-2xl"
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">{t("editUser")}</h2>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/80">{t("name")} (EN)</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/80">{t("name")} (AR)</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                  placeholder="Last name"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t("language")}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreferredLanguage("en")}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${
                    preferredLanguage === "en"
                      ? "bg-[#7c3aed] text-white"
                      : "glass-btn text-white/80 hover:text-white"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredLanguage("ar")}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${
                    preferredLanguage === "ar"
                      ? "bg-[#7c3aed] text-white"
                      : "glass-btn text-white/80 hover:text-white"
                  }`}
                >
                  AR
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t("employeeId")}</label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t("phone")}</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder="+966..."
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t("email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t("loginCode")}</label>
              <input
                type="text"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t("changePassword")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder={t("password") + " (leave blank to keep)"}
              />
            </div>

            {!isSAIF && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/80">{t("role")}</label>
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
                {role === "brand_manager" && (
                  <>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="all_brands_edit"
                        checked={allBrands}
                        onChange={(e) => {
                          setAllBrands(e.target.checked);
                          if (e.target.checked) setBrandIds([]);
                        }}
                        className="h-4 w-4 rounded border-white/30 bg-white/10 text-[#7c3aed]"
                      />
                      <label htmlFor="all_brands_edit" className="text-sm font-medium text-white/80">
                        {t("allBrands")}
                      </label>
                    </div>
                    {!allBrands && (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-white/80">
                          {t("assignedBrands")} ({t("multiSelect")})
                        </label>
                        <select
                          multiple
                          value={brandIds.map(String)}
                          onChange={(e) => {
                            const opts = Array.from(e.target.selectedOptions, (o) => Number(o.value));
                            setBrandIds(opts);
                          }}
                          className="glass-input min-h-[100px] w-full rounded-xl px-4 py-2.5 text-white"
                        >
                          {brands.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
                {(role === "branch_supervisor" || role === "owner") && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-white/80">{t("assignedBrands")}</label>
                      <select
                        value={brandId}
                        onChange={(e) => {
                          setBrandId(e.target.value ? Number(e.target.value) : "");
                          setBranchId("");
                        }}
                        className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                      >
                        <option value="">{t("selectBrand")}</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
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
                        {(brandId ? branches.filter((b) => b.brand?.id === Number(brandId)) : branches).map((b) => (
                          <option key={b.id} value={b.id}>
                            {branchDisplayName(b, lang)} ({b.brand?.name})
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-6">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[#7c3aed] px-6 py-2.5 font-medium text-white transition hover:bg-[#6d28d9] disabled:opacity-50"
              >
                {submitting ? "…" : t("save")}
              </button>
              {onDelete && !isSAIF && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-sm text-rose-400 hover:text-rose-300 underline"
                >
                  {t("deleteUser")}
                </button>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
