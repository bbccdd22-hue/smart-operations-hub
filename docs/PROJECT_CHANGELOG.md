# سجل تغييرات المشروع | Project Changelog
# Smart Operations Hub

**آخر تحديث:** 2026-02-17

---

## ملخص ما تم إنجازه

هذا الملف يوثق جميع الميزات والتعديلات التي تم تنفيذها في Smart Operations Hub.

---

## 1. نظام الصلاحيات (SAIF)

| العنصر | الوصف |
|--------|-------|
| **Super Admin** | سيف (SAIF) هو المدير الأعلى الوحيد – اسم المستخدم بالأحرف الكبيرة `SAIF` |
| **الأدوار** | Owner, General Manager, Brand Manager, Branch Supervisor, External Accountant |
| **الحماية** | إخفاء أزرار التعديل والحذف عن غير SAIF في: شجرة الحسابات، صفحة المستخدمين |
| **سجل الرقابة** | صفحة Activity Log مقتصرة على SAIF فقط |

**الملفات الرئيسية:**
- `backend/core/permissions.py` – التحقق من الصلاحيات
- `backend/org/views.py` – حماية واجهات API
- `frontend/src/components/AdminRoute.tsx` – حماية المسارات

---

## 2. دمج لوحة الإدارة والإعدادات

| العنصر | الوصف |
|--------|-------|
| **Admin Hub** | لوحة تحكم موحدة تحت `/admin-hub` |
| **التبويبات** | إدارة الكيانات | الحسابات والرقابة | الإعدادات التشغيلية |
| **المحتويات** | Brands, Branches | Users, Roles, Activity Log | Taxes, Payment Methods, System Options |

**الملفات الرئيسية:**
- `frontend/src/pages/AdminHubPage.tsx`
- `frontend/src/layouts/AdminHubLayout.tsx`
- `frontend/src/config/navConfig.tsx` – رابط واحد إلى `/admin-hub`

---

## 3. توحيد حساب SAIF

| العنصر | الوصف |
|--------|-------|
| **أمر الترحيل** | `python manage.py migrate_saif_to_SAIF` لتحويل `saif` → `SAIF` |
| **الحماية** | منع تعديل أو حذف حساب SAIF |
| **التحقق** | منع إنشاء حساب باسم `saif` (صغير) |

**الملفات الرئيسية:**
- `backend/org/management/commands/migrate_saif_to_SAIF.py`
- `backend/org/views.py` – حماية المستخدم SAIF

---

## 4. نظام صلاحيات الأدوار (Role Permissions)

| العنصر | الوصف |
|--------|-------|
| **النموذج** | `RolePermissionConfig` لتخزين صلاحيات الأدوار |
| **الصلاحيات** | `view_financial_reports`, `upload_files`, `view_activity_log`, `edit_chart_of_accounts` |
| **API** | `GET/PATCH /api/org/role-permissions/<role>/` |
| **دمج المستخدم** | الصلاحيات تُرسل في `auth/me` ضمن حقل `permissions` |
| **واجهة الإدارة** | زر "إدارة الصلاحيات" في Roles Page (SAIF فقط) |

**الملفات الرئيسية:**
- `backend/org/models.py` – RolePermissionConfig
- `backend/org/urls.py` – role-permissions API
- `frontend/src/components/PermissionsModal.tsx`
- `frontend/src/pages/RolesPage.tsx`

---

## 5. استقرار السيرفرات

| العنصر | الوصف |
|--------|-------|
| **Django** | استخدام `--noreload` لتفادي مشاكل مراقبة الملفات على Windows |
| **start_all.bat** | تشغيل Backend و Frontend بنافذتين منفصلتين مع VITE_API_BASE |
| **التوثيق** | `docs/SERVER_STABILITY.md` – تشخيص وحل مشاكل التوقف |

**الملفات الرئيسية:**
- `start_all.bat`
- `docs/SERVER_STABILITY.md`

---

## 6. قاعدة Cursor للتشغيل

| العنصر | الوصف |
|--------|-------|
| **القاعدة** | `.cursor/rules/startup-and-run.mdc` |
| **الغرض** | توثيق طريقة التشغيل الصحيحة بشكل دائم للذكاء الاصطناعي |
| **alwaysApply** | نعم – تُطبّق في كل جلسة |

---

## 7. هيكل التشغيل الموصى به

```
1. تشغيل: start_all.bat
2. Backend:   http://127.0.0.1:8000  (--noreload)
3. Frontend:  http://localhost:5173
4. تسجيل الدخول: SAIF / كلمة المرور
```

**أمر إنشاء المالك (أول تشغيل):**
```bash
cd backend && python manage.py create_owner SAIF 123
```

---

## 8. مراجع سريعة

| الملف | الغرض |
|-------|--------|
| `docs/SERVER_STABILITY.md` | استقرار السيرفرات |
| `docs/SAIF_RESTORE_POINT_v2.md` | نقطة استعادة النظام المالي |
| `docs/PROJECT_CHANGELOG.md` | هذا الملف – سجل التغييرات |
| `.cursor/rules/startup-and-run.mdc` | قواعد تشغيل المشروع |

---

تم حفظ جميع التغييرات بنجاح.
