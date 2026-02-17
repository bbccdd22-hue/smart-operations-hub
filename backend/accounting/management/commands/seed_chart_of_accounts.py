"""
Seed دليل الشجرة المحاسبية الرسمية – نظام سيف المالي [2026-02-17]
الدفعة (1) من (4) – الحسابات 1–60
"""
from django.core.management.base import BaseCommand

from accounting.models import ChartAccount


def _map_type(t: str) -> str:
    if "تحليلي" in (t or ""):
        return "تحليلي"
    return "رئيسي"


def _map_statement(s: str) -> str:
    s = (s or "").strip()
    if "الدخل" in s or "قائمة الدخل" in s:
        return "قائمة الدخل"
    return "المركز المالي"


# الدفعة (1) – نظام سيف المالي
SAIF_CHART_PART_1 = [
    {"id": "01", "ar": "الأصول", "en": "Assets", "lvl": 1, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "01101", "ar": "الأصول المتداولة", "en": "Current Assets", "lvl": 2, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "011011", "ar": "النقدية", "en": "Cash", "lvl": 3, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "01101101", "ar": "نقدية - الرئيسية", "en": "Cash - Main", "lvl": 4, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "0110110101", "ar": "نقدية الرئيسية - مكة", "en": "Main cash - Makkah", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0110110102", "ar": "نقدية الرئيسية - جدة", "en": "Main cash - Jeddah", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011011102", "ar": "نقدية - الفروع", "en": "Cash - Branches", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011012", "ar": "البنوك", "en": "Banks", "lvl": 3, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "01101201", "ar": "بنك الراجحي - مدفوعات", "en": "Al Rajhi Bank - Payments", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "01101202", "ar": "بنك الراجحي - الإيرادات", "en": "Al Rajhi Bank - Revenues", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013", "ar": "المدينون والأرصدة المدينة الأخرى", "en": "Accounts Receivable & Other Debit Balances", "lvl": 3, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "01101301", "ar": "المدينون والموردون - أرصدة مدينة", "en": "Receivables & Suppliers - Debit Balances", "lvl": 4, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "0110130101", "ar": "المدينون", "en": "Receivables", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0110130102", "ar": "الموردون - أرصدة مدينة", "en": "Suppliers - Debit Balances", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "01101302", "ar": "العهد والمسلف", "en": "Custody and Loans", "lvl": 4, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "0110130201", "ar": "عهد الموظفين", "en": "Staff Custody", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020101", "ar": "عهدة - إبراهيم محمد عبد العزيز", "en": "Custody - Ibrahim Mohammed", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020102", "ar": "عهدة فرع الشوقية Hemi", "en": "Custody - Al-Shawqiya Branch", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020103", "ar": "عهدة - عاصم محمد بركة", "en": "Custody - Asim Mohammed", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020104", "ar": "عهدة - ممدوح فاروق عيسى", "en": "Custody - Mamdouh Farouk", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020105", "ar": "عهدة - محمد منير جودة", "en": "Custody - Mohammed Munir", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020106", "ar": "عهدة فرع الستين Hemi", "en": "Custody - Al-Sittin Branch", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020107", "ar": "عهدة فرع الزايدي Hemi", "en": "Custody - Al-Zaidi Branch", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020108", "ar": "عهدة فرع البحيرات Hemi", "en": "Custody - Al-Buhayrat Branch", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020109", "ar": "عهدة فرع العوالي Hemi", "en": "Custody - Al-Awali Branch", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020110", "ar": "عهدة فرع الشرائع Hemi", "en": "Custody - Al-Shara'i Branch", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020111", "ar": "عهدة فرع الشوقية 8 OZ", "en": "Custody - Al-Shawqiya 8 OZ", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020112", "ar": "عهدة فرع الستين 8 OZ", "en": "Custody - Al-Sittin 8 OZ", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020113", "ar": "عهدة فرع العوالي 8 OZ", "en": "Custody - Al-Awali 8 OZ", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020114", "ar": "عهدة فرع ابحر 8 OZ", "en": "Custody - Obhur 8 OZ", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020115", "ar": "عهدة - عبد الله حلمي علي", "en": "Custody - Abdullah Helmy", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020116", "ar": "عهدة - سيف الدين رجب إبراهيم", "en": "Custody - Saif Eldin Rajab", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
]

# الدفعة (2) – تكملة الأصول والالتزامات وحقوق الملكية
SAIF_CHART_PART_2 = [
    {"id": "011013020117", "ar": "عهدة - عاصم عبده سعيد محمد", "en": "Custody - Asim Abdo", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020118", "ar": "عهدة - إبراهيم محمد عبد العزيز - 2", "en": "Custody - Ibrahim Mohammed 2", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020119", "ar": "عهدة - أحمد ممدوح فاروق", "en": "Custody - Ahmed Mamdouh", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020201", "ar": "سلف - إبراهيم محمد عبد العزيز", "en": "Loan - Ibrahim Mohammed", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020202", "ar": "سلف - عاصم محمد بركة", "en": "Loan - Asim Mohammed", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020203", "ar": "سلف - ممدوح فاروق عيسى", "en": "Loan - Mamdouh Farouk", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013020204", "ar": "سلف - محمد منير جودة", "en": "Loan - Mohammed Munir", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0110130301", "ar": "مصاريف مدفوعة مقدماً", "en": "Prepaid Expenses", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0110130302", "ar": "تأمين لدى الغير", "en": "Insurance with Others", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013030201", "ar": "تأمين إيجار - فرع الشوقية Hemi", "en": "Rent Insurance - Shawqiya Hemi", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013030202", "ar": "تأمين إيجار - فرع الستين Hemi", "en": "Rent Insurance - Sittin Hemi", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013030203", "ar": "تأمين إيجار - فرع العوالي Hemi", "en": "Rent Insurance - Awali Hemi", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013030204", "ar": "تأمين إيجار - فرع البحيرات Hemi", "en": "Rent Insurance - Buhayrat Hemi", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013030205", "ar": "تأمين إيجار - فرع الزايدي Hemi", "en": "Rent Insurance - Zaidi Hemi", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013030206", "ar": "تأمين إيجار - فرع الشرائع Hemi", "en": "Rent Insurance - Shara'i Hemi", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013030207", "ar": "تأمين إيجار - فرع الشوقية 8 OZ", "en": "Rent Insurance - Shawqiya 8 OZ", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013030208", "ar": "تأمين إيجار - فرع الستين 8 OZ", "en": "Rent Insurance - Sittin 8 OZ", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013030209", "ar": "تأمين إيجار - فرع العوالي 8 OZ", "en": "Rent Insurance - Awali 8 OZ", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011013030210", "ar": "تأمين إيجار - فرع ابحر 8 OZ", "en": "Rent Insurance - Obhur 8 OZ", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "02", "ar": "الالتزامات", "en": "Liabilities", "lvl": 1, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "02101", "ar": "الموردون", "en": "Suppliers", "lvl": 2, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "0210101", "ar": "موردين تجاريين", "en": "Trade Suppliers", "lvl": 3, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "021010101", "ar": "موردين - HEMI", "en": "Suppliers - HEMI", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "021010102", "ar": "موردين - 8 OZ", "en": "Suppliers - 8 OZ", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "02102", "ar": "الأرصدة الدائنة الأخرى", "en": "Other Credit Balances", "lvl": 2, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "0210201", "ar": "مصاريف مستحقة", "en": "Accrued Expenses", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0210202", "ar": "أرصدة دائنة - أخرى", "en": "Other Credit Balances", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "03", "ar": "حقوق الملكية", "en": "Equity", "lvl": 1, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "03101", "ar": "رأس المال", "en": "Capital", "lvl": 2, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "0310101", "ar": "رأس المال - الشركاء", "en": "Partners Capital", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "03102", "ar": "جاري الشركاء", "en": "Partners Current Account", "lvl": 2, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "03103", "ar": "أرباح وخسائر العام", "en": "Profit and Loss of the year", "lvl": 2, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
]

# الدفعة (3) – الإيرادات وتكلفة النشاط والأجور
SAIF_CHART_PART_3 = [
    {"id": "04", "ar": "الإيرادات", "en": "Revenue", "lvl": 1, "type": "مستوي رئيسي", "stat": "قائمة الدخل"},
    {"id": "04101", "ar": "إيرادات مبيعات", "en": "Sales Revenue", "lvl": 2, "type": "مستوي رئيسي", "stat": "قائمة الدخل"},
    {"id": "0410101", "ar": "إيرادات مبيعات - HEMI", "en": "Sales Revenue - HEMI", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0410102", "ar": "إيرادات مبيعات - 8 OZ", "en": "Sales Revenue - 8 OZ", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "04102", "ar": "إيرادات أخرى", "en": "Other Revenue", "lvl": 2, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05", "ar": "المصاريف", "en": "Expenses", "lvl": 1, "type": "مستوي رئيسي", "stat": "قائمة الدخل"},
    {"id": "05101", "ar": "تكلفة النشاط", "en": "Activity Cost", "lvl": 2, "type": "مستوي رئيسي", "stat": "قائمة الدخل"},
    {"id": "0510101", "ar": "مشتريات خامات", "en": "Raw Material Purchases", "lvl": 3, "type": "مستوي رئيسي", "stat": "قائمة الدخل"},
    {"id": "051010101", "ar": "مشتريات خامات - HEMI", "en": "Raw Material - HEMI", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051010102", "ar": "مشتريات خامات - 8 OZ", "en": "Raw Material - 8 OZ", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05102", "ar": "مصاريف تشغيلية", "en": "Operating Expenses", "lvl": 2, "type": "مستوي رئيسي", "stat": "قائمة الدخل"},
    {"id": "0510201", "ar": "مصاريف تشغيل - مكة", "en": "Operating Exp - Makkah", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510202", "ar": "مصاريف تشغيل - جدة", "en": "Operating Exp - Jeddah", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103", "ar": "مصاريف إدارية وعمومية", "en": "G&A Expenses", "lvl": 2, "type": "مستوي رئيسي", "stat": "قائمة الدخل"},
    {"id": "0510301", "ar": "مصاريف ضيافة ونظافة - الادارة", "en": "Hospitality & Cleaning - Admin", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510302", "ar": "مصاريف أدوات كتابية ومكتبية - الادارة", "en": "Stationery & Office Supplies", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510303", "ar": "مصاريف بريد وهاتف وإنترنت - الادارة", "en": "Post, Phone & Internet", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510304", "ar": "مصاريف رسوم حكومية ورخص - الادارة", "en": "Gov Fees & Licenses", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510305", "ar": "مصاريف كهرباء ومياه - الادارة", "en": "Electricity & Water - Admin", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510306", "ar": "مصاريف اشتراكات وعضوية - الادارة", "en": "Subscriptions & Membership", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510307", "ar": "مصاريف تأمين طبي - الادارة", "en": "Medical Insurance - Admin", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510308", "ar": "مصروف أجور، رواتب - الادارة", "en": "Salaries and Wages – Management", "lvl": 3, "type": "مستوي رئيسي", "stat": "قائمة الدخل"},
    {"id": "051030801", "ar": "رواتب أساسية - الادارة", "en": "Basic Salaries - Admin", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030802", "ar": "بدل سكن - الادارة", "en": "Housing Allowance - Admin", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030803", "ar": "بدل مواصلات - الادارة", "en": "Transportation Allowance - Admin", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030804", "ar": "بدل اتصالات - الادارة", "en": "Communication Allowance - Admin", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030805", "ar": "أجر إضافي - الادارة", "en": "Overtime - Admin", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510309", "ar": "مصروف تأمينات اجتماعية - الادارة", "en": "Social Insurance - Management", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510310", "ar": "مصروف نهاية الخدمة - الادارة", "en": "Exp.EOS - Management", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510311", "ar": "مصروف بدل أجازة - الادارة", "en": "Exp.Vacation – Management", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
]

# الدفعة (4) – مصاريف السيارات، الصيانة، والختام
SAIF_CHART_PART_4 = [
    {"id": "0510312", "ar": "مصروف سفر وانتقالات - الادارة", "en": "Travel & Transportation - Management", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510313", "ar": "مصروف إيجار سيارة - الادارة", "en": "Rent Car – Management", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510314", "ar": "مصروف بنزين - الإدارة", "en": "Car Petrol – Management", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031401", "ar": "بنزين سيارة - سيف الدين رجب", "en": "Car Petrol - Saif Eldin", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031402", "ar": "بنزين سيارة - ممدوح فاروق", "en": "Car Petrol - Mamdouh Farouk", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031403", "ar": "بنزين سيارة - إبراهيم محمد", "en": "Car Petrol - Ibrahim Mohammed", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510315", "ar": "مصروف صيانة سيارة - الادارة", "en": "Car Maintenance – Management", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031501", "ar": "صيانة سيارة - سيف الدين رجب", "en": "Car Maint - Saif Eldin", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031502", "ar": "صيانة سيارة - ممدوح فاروق", "en": "Car Maint - Mamdouh Farouk", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510316", "ar": "مصروف صيانة عامة", "en": "General Maintenance", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031601", "ar": "صيانة مباني ومرافق", "en": "Building Maintenance", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031602", "ar": "صيانة أجهزة تكييف", "en": "AC Maintenance", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510317", "ar": "مصاريف تسويق وإعلان", "en": "Marketing & Advertising", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510318", "ar": "مصاريف بنكية", "en": "Bank Charges", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510319", "ar": "مصاريف تدريب وتطوير", "en": "Training & Development", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510320", "ar": "مصاريف استشارية وقانونية", "en": "Legal & Consulting Fees", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510321", "ar": "مصاريف نثرية متفرقة", "en": "Miscellaneous Expenses", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05104", "ar": "مصاريف غير تشغيلية", "en": "Non-Operating Expenses", "lvl": 2, "type": "مستوي رئيسي", "stat": "قائمة الدخل"},
    {"id": "0510401", "ar": "خسائر بيع أصول", "en": "Loss on Sale of Assets", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05105", "ar": "الزكاة الشرعية", "en": "Zakat Expense", "lvl": 2, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
]

# الدفعة (5) – سويت بريد، توسعة الإيرادات والمصاريف (لبلوغ 240 حساب)
SAIF_CHART_PART_5 = [
    {"id": "0410103", "ar": "إيرادات مبيعات - سويت بريد", "en": "Sales Revenue - Sweet Bread", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "041010101", "ar": "إيرادات HEMI - فرع الشوقية", "en": "HEMI Revenue - Shawqiya", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "041010102", "ar": "إيرادات HEMI - فرع العوالي", "en": "HEMI Revenue - Awali", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "041010201", "ar": "إيرادات 8 OZ - فرع الستين", "en": "8 OZ Revenue - Sittin", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "041010202", "ar": "إيرادات 8 OZ - فرع مكة", "en": "8 OZ Revenue - Makkah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "041010301", "ar": "إيرادات سويت بريد - فرع العوالي", "en": "Sweet Bread Revenue - Awali", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "041010302", "ar": "إيرادات سويت بريد - فرع جدة", "en": "Sweet Bread Revenue - Jeddah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0410201", "ar": "إيرادات فوائد بنكية", "en": "Bank Interest Income", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0410202", "ar": "إيرادات استثمارية", "en": "Investment Income", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0410203", "ar": "إيرادات متنوعة", "en": "Miscellaneous Income", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051010103", "ar": "مشتريات خامات - سويت بريد", "en": "Raw Material - Sweet Bread", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051020101", "ar": "إيجار - فرع مكة", "en": "Rent - Makkah Branch", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051020102", "ar": "إيجار - فرع جدة", "en": "Rent - Jeddah Branch", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051020103", "ar": "إيجار - فرع الشوقية", "en": "Rent - Shawqiya Branch", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051020104", "ar": "إيجار - فرع العوالي", "en": "Rent - Awali Branch", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051020105", "ar": "إيجار - فرع الستين", "en": "Rent - Sittin Branch", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051020201", "ar": "كهرباء - فرع مكة", "en": "Electricity - Makkah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051020202", "ar": "كهرباء - فرع جدة", "en": "Electricity - Jeddah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051020203", "ar": "مياه - الفروع", "en": "Water - Branches", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030101", "ar": "ضيافة ونظافة - مكة", "en": "Hospitality - Makkah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030102", "ar": "ضيافة ونظافة - جدة", "en": "Hospitality - Jeddah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030201", "ar": "أدوات كتابية - مكة", "en": "Stationery - Makkah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030202", "ar": "أدوات كتابية - جدة", "en": "Stationery - Jeddah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
]

# الدفعة (6) – تفاصيل إضافية (أجور الفروع، صيانة تفصيلية، إلخ)
SAIF_CHART_PART_6 = [
    {"id": "051030301", "ar": "بريد وهاتف - مكة", "en": "Post & Phone - Makkah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030302", "ar": "بريد وهاتف - جدة", "en": "Post & Phone - Jeddah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030401", "ar": "رسوم حكومية - مكة", "en": "Gov Fees - Makkah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030402", "ar": "رسوم حكومية - جدة", "en": "Gov Fees - Jeddah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030501", "ar": "كهرباء ومياه - مكة", "en": "Utilities - Makkah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030502", "ar": "كهرباء ومياه - جدة", "en": "Utilities - Jeddah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030601", "ar": "اشتراكات - مكة", "en": "Subscriptions - Makkah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030602", "ar": "اشتراكات - جدة", "en": "Subscriptions - Jeddah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030701", "ar": "تأمين طبي - مكة", "en": "Medical Insurance - Makkah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030702", "ar": "تأمين طبي - جدة", "en": "Medical Insurance - Jeddah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051032201", "ar": "مصاريف نثرية - مكة", "en": "Misc Exp - Makkah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051032202", "ar": "مصاريف نثرية - جدة", "en": "Misc Exp - Jeddah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051032203", "ar": "مصاريف نثرية - الادارة", "en": "Misc Exp - Admin", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "011014", "ar": "مخزون", "en": "Inventory", "lvl": 3, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "01101401", "ar": "مخزون خامات", "en": "Raw Materials Inventory", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "01101402", "ar": "مخزون بضاعة تامة", "en": "Finished Goods", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0110140101", "ar": "مخزون خامات - HEMI", "en": "RM Inventory - HEMI", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0110140102", "ar": "مخزون خامات - 8 OZ", "en": "RM Inventory - 8 OZ", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0110140103", "ar": "مخزون خامات - سويت بريد", "en": "RM Inventory - Sweet Bread", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "011015", "ar": "أصول ثابتة", "en": "Fixed Assets", "lvl": 3, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "01101501", "ar": "معدات ومكائن", "en": "Equipment & Machinery", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "01101502", "ar": "مباني ومرافق", "en": "Buildings & Facilities", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "01101503", "ar": "سيارات", "en": "Vehicles", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0110150101", "ar": "معدات - فرع مكة", "en": "Equipment - Makkah", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0110150102", "ar": "معدات - فرع جدة", "en": "Equipment - Jeddah", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0110150103", "ar": "معدات - فرع الشوقية", "en": "Equipment - Shawqiya", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0110150104", "ar": "معدات - فرع العوالي", "en": "Equipment - Awali", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0110150105", "ar": "معدات - فرع الستين", "en": "Equipment - Sittin", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "02103", "ar": "إيرادات مقدمة", "en": "Deferred Revenue", "lvl": 2, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0210301", "ar": "إيرادات مقدمة - إيجار", "en": "Deferred Rent", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "03104", "ar": "أرباح محتجزة", "en": "Retained Earnings", "lvl": 2, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0310401", "ar": "أرباح محتجزة - سنة سابقة", "en": "Retained - Prior Year", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
]

# الدفعة (7) – استكمال 240 حساب (توسيع تفاصيل الفروع والعلامات)
SAIF_CHART_PART_7 = [
    {"id": "051031603", "ar": "صيانة مباني - مكة", "en": "Build Maint - Makkah", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031604", "ar": "صيانة مباني - جدة", "en": "Build Maint - Jeddah", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031701", "ar": "مصاريف تسويق - مكة", "en": "Marketing - Makkah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031702", "ar": "مصاريف تسويق - جدة", "en": "Marketing - Jeddah", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031801", "ar": "مصاريف بنكية - الراجحي", "en": "Bank Charges - Rajhi", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031802", "ar": "مصاريف بنكية - أخرى", "en": "Bank Charges - Other", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031901", "ar": "تدريب - الموظفين", "en": "Training - Staff", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031902", "ar": "تدريب - الإدارة", "en": "Training - Management", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051032001", "ar": "استشارات قانونية", "en": "Legal Consulting", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051032002", "ar": "استشارات محاسبية", "en": "Accounting Consulting", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "01101203", "ar": "بنك الأهلي - مدفوعات", "en": "Al Ahli Bank - Payments", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "01101204", "ar": "بنك الأهلي - الإيرادات", "en": "Al Ahli Bank - Revenues", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "01101304", "ar": "مستحقات أخرى", "en": "Other Receivables", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0110130401", "ar": "مستحقات - ضريبة", "en": "Tax Receivables", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0110130402", "ar": "مستحقات - عملاء", "en": "Customer Receivables", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "021010103", "ar": "موردين - سويت بريد", "en": "Suppliers - Sweet Bread", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0210203", "ar": "ضريبة مستحقة", "en": "Tax Payable", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "04101010101", "ar": "إيرادات HEMI الشوقية - يومية", "en": "HEMI Shawqiya Daily", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "04101010102", "ar": "إيرادات HEMI الشوقية - أسبوعية", "en": "HEMI Shawqiya Weekly", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "04101010201", "ar": "إيرادات HEMI العوالي - يومية", "en": "HEMI Awali Daily", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "04101010202", "ar": "إيرادات HEMI العوالي - أسبوعية", "en": "HEMI Awali Weekly", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "04101020101", "ar": "إيرادات 8 OZ الستين - يومية", "en": "8OZ Sittin Daily", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "04101020102", "ar": "إيرادات 8 OZ الستين - أسبوعية", "en": "8OZ Sittin Weekly", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "04101020201", "ar": "إيرادات 8 OZ مكة - يومية", "en": "8OZ Makkah Daily", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "04101020202", "ar": "إيرادات 8 OZ مكة - أسبوعية", "en": "8OZ Makkah Weekly", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "04101030101", "ar": "إيرادات سويت بريد العوالي - يومية", "en": "SB Awali Daily", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "04101030102", "ar": "إيرادات سويت بريد العوالي - أسبوعية", "en": "SB Awali Weekly", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "04101030201", "ar": "إيرادات سويت بريد جدة - يومية", "en": "SB Jeddah Daily", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "04101030202", "ar": "إيرادات سويت بريد جدة - أسبوعية", "en": "SB Jeddah Weekly", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05101010101", "ar": "مشتريات خامات HEMI - الشوقية", "en": "RM HEMI Shawqiya", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05101010102", "ar": "مشتريات خامات HEMI - العوالي", "en": "RM HEMI Awali", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05101010201", "ar": "مشتريات خامات 8 OZ - الستين", "en": "RM 8OZ Sittin", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05101010202", "ar": "مشتريات خامات 8 OZ - مكة", "en": "RM 8OZ Makkah", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05101010301", "ar": "مشتريات خامات سويت بريد - العوالي", "en": "RM SB Awali", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05101010302", "ar": "مشتريات خامات سويت بريد - جدة", "en": "RM SB Jeddah", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080101", "ar": "رواتب أساسية - الشوقية", "en": "Basic Salaries Shawqiya", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080102", "ar": "رواتب أساسية - العوالي", "en": "Basic Salaries Awali", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080103", "ar": "رواتب أساسية - الستين", "en": "Basic Salaries Sittin", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080104", "ar": "رواتب أساسية - مكة", "en": "Basic Salaries Makkah", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080105", "ar": "رواتب أساسية - جدة", "en": "Basic Salaries Jeddah", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080201", "ar": "بدل سكن - الشوقية", "en": "Housing Shawqiya", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080202", "ar": "بدل سكن - العوالي", "en": "Housing Awali", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080203", "ar": "بدل سكن - الستين", "en": "Housing Sittin", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080204", "ar": "بدل سكن - مكة", "en": "Housing Makkah", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080205", "ar": "بدل سكن - جدة", "en": "Housing Jeddah", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510501", "ar": "الزكاة - سنة جارية", "en": "Zakat Current Year", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0510502", "ar": "الزكاة - تسوية", "en": "Zakat Settlement", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "011016", "ar": "استهلاك واهلاك متراكم", "en": "Accumulated Depreciation", "lvl": 3, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "01101601", "ar": "اهلاك معدات", "en": "Depreciation Equipment", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "01101602", "ar": "اهلاك مباني", "en": "Depreciation Buildings", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "01101603", "ar": "اهلاك سيارات", "en": "Depreciation Vehicles", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "02104", "ar": "قروض وقروض طويلة", "en": "Loans & Long-term Debt", "lvl": 2, "type": "مستوي رئيسي", "stat": "قائمة المركز المالي"},
    {"id": "0210401", "ar": "قروض بنكية قصيرة", "en": "Short-term Bank Loans", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "0210402", "ar": "قروض بنكية طويلة", "en": "Long-term Bank Loans", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة المركز المالي"},
    {"id": "05103080301", "ar": "بدل مواصلات - الشوقية", "en": "Transport Shawqiya", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080302", "ar": "بدل مواصلات - العوالي", "en": "Transport Awali", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080303", "ar": "بدل مواصلات - الستين", "en": "Transport Sittin", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080401", "ar": "بدل اتصالات - الشوقية", "en": "Comm Allow Shawqiya", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080402", "ar": "بدل اتصالات - العوالي", "en": "Comm Allow Awali", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080501", "ar": "أجر إضافي - الشوقية", "en": "Overtime Shawqiya", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080502", "ar": "أجر إضافي - العوالي", "en": "Overtime Awali", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "05103080503", "ar": "أجر إضافي - الستين", "en": "Overtime Sittin", "lvl": 5, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030901", "ar": "تأمينات اجتماعية - الشوقية", "en": "Soc Insurance Shawqiya", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051030902", "ar": "تأمينات اجتماعية - العوالي", "en": "Soc Insurance Awali", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031001", "ar": "نهاية خدمة - الشوقية", "en": "EOS Shawqiya", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031002", "ar": "نهاية خدمة - العوالي", "en": "EOS Awali", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031101", "ar": "بدل أجازة - الشوقية", "en": "Vacation Exp Shawqiya", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031102", "ar": "بدل أجازة - العوالي", "en": "Vacation Exp Awali", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "051031103", "ar": "بدل أجازة - الستين", "en": "Vacation Exp Sittin", "lvl": 4, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0410301", "ar": "خصم مبيعات", "en": "Sales Discounts", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
    {"id": "0410302", "ar": "مردودات مبيعات", "en": "Sales Returns", "lvl": 3, "type": "مستوي تحليلي", "stat": "قائمة الدخل"},
]

SEED_DATA = []
for row in SAIF_CHART_PART_1 + SAIF_CHART_PART_2 + SAIF_CHART_PART_3 + SAIF_CHART_PART_4 + SAIF_CHART_PART_5 + SAIF_CHART_PART_6 + SAIF_CHART_PART_7:
    SEED_DATA.append({
        "code": row["id"],
        "name_ar": (row["ar"] or "").strip(),
        "name_en": (row["en"] or "").strip(),
        "level": row["lvl"],
        "type": _map_type(row.get("type")),
        "statement": _map_statement(row.get("stat")),
    })


class Command(BaseCommand):
    help = "Seed Chart of Accounts – نظام سيف المالي"

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="Clear existing before seed")

    def handle(self, *args, **options):
        if options.get("clear") and ChartAccount.objects.exists():
            ChartAccount.objects.all().delete()
            self.stdout.write("Cleared existing accounts.")

        created = 0
        by_code = {}

        # ترتيب حسب طول الكود (الأب قبل الابن)
        sorted_items = sorted(SEED_DATA, key=lambda x: (len(x["code"]), x["code"]))

        for item in sorted_items:
            code = item["code"]
            if ChartAccount.objects.filter(code=code).exists():
                continue

            parent = None
            for length in range(len(code) - 1, 0, -1):
                parent_code = code[:length]
                parent = by_code.get(parent_code) or ChartAccount.objects.filter(code=parent_code).first()
                if parent:
                    break

            acc = ChartAccount.objects.create(
                code=code,
                name_ar=item["name_ar"],
                name_en=item["name_en"],
                level=item["level"],
                parent=parent,
                account_type=item.get("type", "تحليلي"),
                statement=item.get("statement", "المركز المالي"),
            )
            by_code[code] = acc
            created += 1

        self.stdout.write(self.style.SUCCESS(f"Seeded {created} chart account(s)."))
