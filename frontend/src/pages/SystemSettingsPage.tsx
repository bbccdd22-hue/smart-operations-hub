/** System Settings – ERP hierarchy and system codes for full admin transparency */
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  SYSTEM_CODE_HIERARCHY,
  PREP_LIST_SALES_SOURCE,
  PREP_LIST_UNITS_SOURCE,
  PR1002,
  type SystemCodeNode,
} from "../lib/SystemCodes";

function TreeNode({ node, depth = 0 }: { node: SystemCodeNode; depth?: number }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const label = isRTL && node.labelAr ? node.labelAr : node.label;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="ml-0" style={{ marginInlineStart: depth * 20 }}>
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
          depth === 0 ? "bg-white/10 font-semibold" : "bg-white/5"
        }`}
      >
        <span className="shrink-0 font-mono text-sm text-emerald-400">
          {node.code.length <= 3 ? `[${node.code}]` : node.code}
        </span>
        <span className="text-white">{label}</span>
        {node.model && (
          <span className="ml-auto shrink-0 text-xs text-white/50">{node.model}</span>
        )}
      </div>
      {hasChildren && (
        <div className="mt-2 space-y-1">
          {node.children!.map((child) => (
            <TreeNode key={child.code} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SystemSettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("systemSettings")}</h1>
          <p className="mt-1 text-sm text-white/60">{t("systemSettingsSubtitle")}</p>
        </div>
        <Link
          to="/admin-hub"
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
        >
          {t("back")}
        </Link>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">{t("systemCodesHierarchy")}</h2>
        <p className="mb-6 text-sm text-white/60">{t("systemCodesDescription")}</p>

        <div className="space-y-4">
          {SYSTEM_CODE_HIERARCHY.map((group) => (
            <TreeNode key={group.code} node={group} />
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <h3 className="mb-2 font-semibold text-emerald-200">{t("prepListDataSources")}</h3>
          <p className="mb-3 text-sm text-white/80">{t("prepListDataSourcesDesc")}</p>
          <div className="space-y-2 font-mono text-sm">
            <div>
              <span className="text-emerald-400">{PR1002}</span>
              <span className="text-white/70"> (Prep List)</span>
            </div>
            <div className="ml-4">
              <span className="text-white/60">← </span>
              <span className="text-emerald-400">{PREP_LIST_SALES_SOURCE}</span>
              <span className="text-white/70"> ({t("salesData")})</span>
            </div>
            <div className="ml-4">
              <span className="text-white/60">← </span>
              <span className="text-emerald-400">{PREP_LIST_UNITS_SOURCE}</span>
              <span className="text-white/70"> ({t("inventoryUnits")})</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
