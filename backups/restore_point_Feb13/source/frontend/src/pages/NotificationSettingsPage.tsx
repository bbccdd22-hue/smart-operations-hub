import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferenceMap,
} from "../lib/api";
import Switch from "../components/ui/Switch";

const PREF_KEYS = [
  { key: "user_profile_changes", labelKey: "userProfileChanges" },
  { key: "account_freeze_activate", labelKey: "accountFreezeActivate" },
  { key: "excel_sales_uploads", labelKey: "excelSalesUploads" },
  { key: "shift_closing_updates", labelKey: "shiftClosingUpdates" },
] as const;

export default function NotificationSettingsPage() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<NotificationPreferenceMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNotificationPreferences()
      .then((p) => {
        const defaults: NotificationPreferenceMap = {};
        PREF_KEYS.forEach(({ key }) => {
          defaults[key] = p[key] ?? true;
        });
        setPrefs(defaults);
      })
      .catch(() => setPrefs({}))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (key: string, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    try {
      await updateNotificationPreferences(next);
    } catch {
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <Link to="/admin-hub" className="text-sm text-white/70 hover:text-white">
          ← {t("adminDashboard")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">{t("notificationSettings")}</h1>
        <p className="mt-1 text-sm text-white/60">
          System & Email alerts when users change, freeze, or new Excel uploads
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card space-y-1 rounded-2xl p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-white/60">Toggle ON to receive notifications</span>
          {saving && <span className="text-xs text-emerald-400">Saving…</span>}
        </div>
        {PREF_KEYS.map(({ key, labelKey }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between rounded-xl py-4 transition hover:bg-white/5"
          >
            <div>
              <div className="font-medium text-white/95">{t(labelKey)}</div>
              <div className="text-xs text-white/50">System & Email</div>
            </div>
            <Switch
              checked={prefs[key] !== false}
              onChange={() => handleToggle(key, !(prefs[key] ?? true))}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
