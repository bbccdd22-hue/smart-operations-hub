# نقطة استعادة نظام سيف المالي (v2.0)
# Saif Financial System – Full Restore Point

**تاريخ الإنشاء / Created:** 2026-02-11  
**الحالة / Status:** مكتمل وآمن – 240 حساب، فلاتر، رسومات، خط أحمر / Complete & Secure

---

## 1. وصف النظام / System Metadata

| المفتاح / Key     | القيمة / Value                                                                 |
|-------------------|-------------------------------------------------------------------------------|
| Owner             | سيف / Saif                                                                    |
| Total Accounts    | **240** (دليل رسمي – الشجرة المحاسبية)                                        |
| Levels            | 1–5 (04 إيرادات، 05 مصاريف)                                                   |
| Primary Color     | #10b981 (زمردي / Emerald)                                                    |
| Font (Arabic)     | Cairo                                                                         |
| Languages         | Arabic (RTL) / English                                                        |

### المميزات المفعّلة / Active Features

| Feature | العربية | Location |
|---------|---------|----------|
| Chart of Accounts (240) | دليل 240 حساب | `seed_chart_of_accounts.py` |
| Tree + Collapse/Expand | شجرة +/- | `ChartOfAccountsPage.tsx` |
| Smart Search + Auto-expand | بحث + فتح المسارات | `ChartOfAccountsPage.tsx` |
| Income Statement Filters | فلاتر (براند، فرع، مستوى، فترة) | `IncomeStatementPage.tsx` |
| % & Diff Calculation | النسب والانحراف | `calculateStatement()` |
| Smart Upload Gate | بوابة رفع (يشترط تحديد أولاً) | `IncomeStatementPage.tsx` |
| Financial Charts Dashboard | لوحة الرسومات | `FinancialChartsDashboard.tsx` |
| Red Line Budget Alerts | تنبيهات تجاوز الميزانية | `IncomeStatementPage.tsx` + Toast |

---

## 2. هيكل الدليل المحاسبي / Chart Structure

- **Seed command:** `python manage.py seed_chart_of_accounts [--clear]`
- **Parts:** 7 batches (PART_1 … PART_7)
- **Revenue (04):** إيرادات مبيعات HEMI (0410101), 8 OZ (0410102), Sweet Bread (0410103)
- **Expenses (05):** مصاريف، تكلفة النشاط، تشغيلية، إدارية، إلخ

---

## 3. مواقع المحركات / Engine Locations

| المحرك | المسار |
|--------|--------|
| Chart Seed (240) | `backend/accounting/management/commands/seed_chart_of_accounts.py` |
| Tree + Search | `frontend/src/pages/ChartOfAccountsPage.tsx` |
| Balance Upload | `frontend/src/pages/BalanceUploadPage.tsx` |
| Income Statement | `frontend/src/pages/reports/IncomeStatementPage.tsx` |
| Smart Upload Gate | `IncomeStatementPage.tsx` – `canUpload`, `processUploadFile` |
| Budget Ceilings | `IncomeStatementPage.tsx` – `BUDGET_CEILINGS` |
| Financial Charts | `frontend/src/pages/reports/FinancialChartsDashboard.tsx` |
| P&L Report | `frontend/src/pages/reports/ProfitLossReport.tsx` |

---

## 4. API Endpoints

| Endpoint | Method | الوظيفة |
|----------|--------|---------|
| `/api/accounting/chart/` | GET | قائمة الحسابات (مع balance) |
| `/api/accounting/chart/import-balances/` | POST | رفع أرصدة `{ "balances": { "code": amount } }` |

---

## 5. المسارات / Key Routes

| Route | Report |
|-------|--------|
| `/finance` | مركز التقارير المالية |
| `/finance/chart-of-accounts` | FIN-006 – دليل الشجرة |
| `/finance/balance-upload` | FIN-007 – تحديث الأرصدة |
| `/finance/profit-loss` | FIN-008 – P&L |
| `/finance/income-statement` | FIN-009 – قائمة الدخل |
| `/finance/charts-dashboard` | FIN-010 – لوحة الرسومات |

---

## 6. Design System

- **Emerald:** #10b981 (primary), #059669 (hover)
- **Font:** Cairo (Arabic), Inter, Lexend, Tajawal
- **CSS:** `frontend/src/styles.css` – `--color-emerald`, `--aqua-emerald`, `.chart-tree`, `.saif-income-report`

---

## 7. إرشادات الاستعادة / Restore Instructions

```bash
# 1. Backend
cd backend
python manage.py migrate
python manage.py seed_chart_of_accounts --clear
python manage.py runserver

# 2. Frontend
cd frontend
npm install
npm run dev
```

**Environment:** `VITE_API_BASE=http://127.0.0.1:8000/api` (optional)

---

## 8. ملفات الإعداد / Key Config Files

| File | Purpose |
|------|---------|
| `frontend/src/config/financialReports.ts` | FIN-001 … FIN-010 |
| `frontend/src/config/navConfig.ts` | Main navigation |
| `backend/accounting/models.py` | ChartAccount, balance |

---

🛡️ **تم تفعيل نقطة الاستعادة الكاملة v2.0 – نظام سيف المالي في أمان.**
