/**
 * لوحة التحكم الموحدة – Unified Admin Dashboard
 * دمج لوحة الإدارة + الإعدادات في صفحة واحدة مع تبويبات
 * Permission matrix: سيف فقط يرى سجل الرقابة وإدارة الأدوار الكاملة
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";

const CARD_CLASS =
  "glass-card flex flex-col gap-2 rounded-xl p-5 transition hover:border-emerald-400/40";

type TabId = "entities" | "accounts" | "operational";

export default function AdminHubPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";
  const isSuperAdmin = user?.username === "SAIF";
  const isOwner = user?.role === "owner";
  const isGeneralManager = user?.role === "general_manager";
  const showAdminHub = isSuperAdmin || isOwner || isGeneralManager;

  const [activeTab, setActiveTab] = useState<TabId>("entities");

  const tabs: { id: TabId; labelAr: string; labelEn: string }[] = [
    { id: "entities", labelAr: "إدارة الكيانات", labelEn: "Entity Management" },
    { id: "accounts", labelAr: "الحسابات والرقابة", labelEn: "Accounts & Audit" },
    { id: "operational", labelAr: "الإعدادات التشغيلية", labelEn: "Operational Settings" },
  ];

  /** لوحة تحكم المالك – SAIF / Owner / GM / Full System Access */
  const canAccessCommandCenter =
    isSuperAdmin || isOwner || isGeneralManager || !!user?.permissions?.perm_full_system_access;
  const commandCenterCard: CardItem | null = canAccessCommandCenter
    ? { key: "commandCenter", to: "/admin-hub/command-center", icon: "🎯", labelKey: "ownersCommandCenter" }
    : null;
  const executiveDashboardCard: CardItem | null = canAccessCommandCenter
    ? { key: "executiveDashboard", to: "/admin-hub/executive-dashboard", icon: "📊", labelKey: "executiveDashboard" }
    : null;

  /** Section 1: إدارة الكيانات – Brands, Branches */
  const entityCards = [
    { key: "brands", to: "/admin-hub/brands", icon: "🏷️", labelKey: "brands" },
    { key: "branches", to: "/admin-hub/branches", icon: "🏪", labelKey: "branches" },
  ];

  /** Section 2: الحسابات والرقابة – Super Admin sees all; others see Users + Activity Log if permitted */
  const canViewActivityLog = isSuperAdmin || !!user?.permissions?.view_activity_log;
  const accountCards = [
    { key: "users", to: "/admin-hub/users", icon: "👥", labelKey: "users", show: showAdminHub },
    {
      key: "roles",
      to: "/admin-hub/roles",
      icon: "🔐",
      labelKey: "roles",
      show: showAdminHub,
      fullAccess: isSuperAdmin,
    },
    {
      key: "activityLog",
      to: "/admin-hub/activity-log",
      icon: "📋",
      labelAr: "سجل الرقابة",
      show: canViewActivityLog,
    },
    {
      key: "errorLogs",
      to: "/admin-hub/error-logs",
      icon: "⚠️",
      labelAr: "سجل الأخطاء",
      show: isSuperAdmin,
    },
    {
      key: "systemHeartbeat",
      to: "/admin-hub/system-heartbeat",
      icon: "💓",
      labelAr: "نبض النظام",
      show: isSuperAdmin,
    },
  ].filter((c) => c.show);

  /** Section 3: الإعدادات التشغيلية */
  const operationalCards = [
    { key: "taxes", to: "/admin-hub/taxes", icon: "📊", labelKey: "taxes" },
    { key: "paymentMethods", to: "/admin-hub/payment-methods", icon: "💳", labelKey: "paymentMethods" },
    { key: "systemOptions", to: "/admin-hub/system-options", icon: "🏙️", labelKey: "systemOptions" },
    {
      key: "notificationSettings",
      to: "/admin-hub/notification-settings",
      icon: "🔔",
      labelKey: "notificationSettings",
    },
    { key: "smartUpload", to: "/admin-hub/smart-upload", icon: "📤", labelKey: "smartUpload" },
    {
      key: "systemCodes",
      to: "/admin-hub/system-codes",
      icon: "⚙️",
      labelKey: "systemSettings",
    },
  ];

  type CardItem = { key: string; to: string; icon: string; labelKey?: string; labelAr?: string; fullAccess?: boolean };
  const ownerCards = [commandCenterCard, executiveDashboardCard].filter(Boolean) as CardItem[];
  const sectionCards: Record<TabId, CardItem[]> = {
    entities: ownerCards.length > 0 ? [...ownerCards, ...entityCards] : entityCards,
    accounts: accountCards as CardItem[],
    operational: operationalCards,
  };

  const cards = sectionCards[activeTab] ?? [];

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          {t("adminDashboard")}
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {t("adminHubSubtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div
        className="mb-6 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-[#00ffcc]/20 text-[#00ffcc]"
                : "text-white/60 hover:bg-white/10 hover:text-white/80"
            }`}
          >
            {isRTL ? tab.labelAr : tab.labelEn}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {cards.map((c, i) => {
            const label = c.labelAr ?? (c.labelKey ? t(c.labelKey) : t(c.key));
            return (
              <Link key={c.key} to={c.to}>
                <motion.div
                  className={CARD_CLASS}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="text-2xl">{c.icon}</div>
                  <div className="font-semibold text-white/95">{label}</div>
                  <div className="text-xs text-white/50">{t("manageSettings")}</div>
                </motion.div>
              </Link>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
