# نقطة استعادة نظام سيف المالي (v1.0)
# Saif Financial System – Restore Point

**تاريخ الإنشاء / Created:** 2026-02-17  
**الحالة / Status:** مكتمل وآمن / Complete & Secure

---

## 1. وصف النظام / System Metadata

| المفتاح / Key     | القيمة / Value                                                                 |
|-------------------|-------------------------------------------------------------------------------|
| Owner             | سيف / Saif                                                                    |
| Total Accounts    | 240 (دليل رسمي – الشجرة المحاسبية)                                            |
| Languages         | Arabic (RTL) / English                                                        |
| Remote Access     | مفعّل / Enabled                                                               |

### المميزات المفعّلة / Active Features

- **Tree View (+/-)** – شجرة الحسابات بتوسيع/طي تفاعلي
- **Live Search** – بحث فوري مع فتح تلقائي للأبناء وتمييز النتائج
- **Excel Uploader** – رفع أرصدة من ملف إكسل ومطابقتها مع الدليل
- **P&L Reports** – تقرير الأرباح والخسائر (إيرادات 04، مصاريف 05، صافي الربح)

---

## 2. هيكل الدليل المحاسبي / Chart Structure

- **الأقسام / Parts:** 4 batches (الأصول، الالتزامات وحقوق الملكية، الإيرادات، المصاريف)
- **البنية / Structure:** Hierarchical – المستويات 1 إلى 5
- **الـ Seed:** `python manage.py seed_chart_of_accounts`

---

## 3. مواقع المحركات في الكود / Engine Locations

| المحرك / Engine | المسار / Path | الوظيفة |
|-----------------|---------------|---------|
| **Display**     | `frontend/src/pages/ChartOfAccountsPage.tsx` | `TreeBranch` – عرض الشجرة |
| **Search**      | `ChartOfAccountsPage.tsx` – `searchQuery`, `matchedCodes`, `parentsToExpand` | `saifTreeSearch` منطق البحث |
| **Upload**      | `frontend/src/pages/BalanceUploadPage.tsx` | `parseExcelToBalances()` → `importChartBalances()` |
| **Reporting**   | `frontend/src/pages/reports/ProfitLossReport.tsx` | `renderProfitLossReport` – بطاقات + جدول المصاريف |

---

## 4. API نقاط النهاية / API Endpoints

| Endpoint | Method | الوظيفة |
|----------|--------|---------|
| `/api/accounting/chart/` | GET | قائمة الحسابات (مع balance) |
| `/api/accounting/chart/import-balances/` | POST | رفع أرصدة `{ "balances": { "01": 1000, ... } }` |

---

## 5. إرشادات الاستعادة / Restore Instructions

1. **تشغيل Backend:**
   ```bash
   cd backend && python manage.py migrate && python manage.py runserver
   ```

2. **تعبئة الدليل (إن لم يكن موجوداً):**
   ```bash
   python manage.py seed_chart_of_accounts
   ```

3. **تشغيل Frontend:**
   ```bash
   cd frontend && npm run dev
   ```

4. **الربط:** الشجرة تستخدم `getChildren()` لربط الأبناء بالآباء آلياً (longest prefix match).

5. **الأيقونات:** النظام يستخدم SVG icons مدمجة – لا حاجة لـ FontAwesome.

---

## 6. المسارات الرئيسية / Key Routes

| Route | التقرير |
|-------|---------|
| `/finance` | مركز التقارير المالية |
| `/finance/chart-of-accounts` | FIN-006 – دليل الشجرة المحاسبية |
| `/finance/balance-upload` | FIN-007 – تحديث الأرصدة |
| `/finance/profit-loss` | FIN-008 – تقرير الأرباح والخسائر |

---

🛡️ **تم تفعيل نقطة الاستعادة.. نظام سيف المالي في أمان.**
