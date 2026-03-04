/**
 * نظام تعديل القوالب – System Customizer Dashboard
 * Lists entity templates; open one to view/edit fields (API: /api/customizer/templates/).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { API_BASE, apiHeaders } from "../lib/api";

/** Base URL for customizer API – use port 8000 if API_BASE wrongly uses 8080. */
function getCustomizerApiBase(): string {
  const base = API_BASE.replace(/:8080(\/|$)/, ":8000$1");
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

/** Backend root URL for Django admin links. */
function getBackendRoot(): string {
  const base = getCustomizerApiBase();
  if (base.startsWith("http")) return base.replace(/\/api\/?$/, "");
  return `${window.location.protocol}//${window.location.hostname}:8000`;
}

type EntityTemplate = {
  id: number;
  app_label: string;
  model_name: string;
  slug: string;
  template_type: string;
  name_ar: string;
  name_en: string;
  field_definitions: Array<{
    id: number;
    field_key: string;
    label_ar: string;
    label_en: string;
    field_type: string;
    order: number;
    visible: boolean;
    is_system: boolean;
  }>;
};

export default function SystemCustomizerPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<EntityTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = `${getCustomizerApiBase()}/customizer/templates/`;
    fetch(url, { credentials: "include", headers: apiHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then(setTemplates)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  const isRTL = document.documentElement.dir === "rtl" || document.documentElement.lang === "ar";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-900/95 dark:text-white">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/admin-hub"
          className="text-sm text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white"
        >
          ← {t("adminDashboard")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">
          {t("systemCustomizer") ?? "نظام تعديل القوالب"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/50">
          {t("systemCustomizerDesc") ?? "عرض وتعديل قوالب النماذج والجداول في النظام. الحقول والترتيب يُحفظان عبر واجهة التخصيص أو من لوحة إدارة Django."}
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-rose-700 dark:text-rose-300">
            {error === "403" || error === "401"
              ? (t("systemCustomizerAuthHint") ?? "يجب أن تكون مسجلاً كمدير نظام للوصول. جرّب من Django Admin إذا لزم الأمر.")
              : (t("systemCustomizerError") ?? "فشل تحميل القوالب.") + " " + error}
            {error === "404" && (
              <p className="mt-2 text-sm">
                {t("systemCustomizer404Hint") ?? "تأكد أن الـ Backend (Django) يعمل على المنفذ 8000. شغّل start_all_auto.bat أو START_MY_PROJECT.bat من مجلد المشروع."}
              </p>
            )}
          </div>
        )}

        {loading && (
          <div className="mt-8 flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        )}

        {!loading && !error && templates.length === 0 && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-white/10 dark:bg-white/5">
            <p className="text-slate-500 dark:text-white/60">
              {t("noTemplatesYet") ?? "لا توجد قوالب مُسجّلة بعد."}
            </p>
            <p className="mt-2 text-sm text-slate-400 dark:text-white/40">
              {t("systemCustomizerAdminHint") ?? "يمكنك إضافة قوالب وحقول من لوحة إدارة Django: القسم Customizer → Entity Templates."}
            </p>
            <a
              href={`${getBackendRoot()}/admin/customizer/entitytemplate/`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {t("openDjangoAdmin") ?? "فتح لوحة إدارة Django"}
            </a>
          </div>
        )}

        {!loading && !error && templates.length > 0 && (
          <ul className="mt-6 space-y-3">
            {templates.map((tmpl) => (
              <li
                key={tmpl.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold">
                      {isRTL ? tmpl.name_ar || tmpl.name_en : tmpl.name_en || tmpl.name_ar}
                    </span>
                    <span className="ml-2 text-slate-400 dark:text-white/40">({tmpl.slug})</span>
                  </div>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-white/10">
                    {tmpl.app_label}.{tmpl.model_name}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-white/50">
                  {tmpl.field_definitions?.length ?? 0} {t("fields") ?? "حقول"}
                </p>
                <div className="mt-3 flex gap-2">
                  <a
                    href={`${getBackendRoot()}/admin/customizer/entitytemplate/${tmpl.id}/change/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/15"
                  >
                    {t("editInAdmin") ?? "تعديل في لوحة الإدارة"}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-xs text-slate-400 dark:text-white/40">
          {t("systemCustomizerApiHint") ?? "الواجهة البرمجية: GET/PATCH /api/customizer/templates/ و /api/customizer/fields/"}
        </p>
      </div>
    </div>
  );
}
