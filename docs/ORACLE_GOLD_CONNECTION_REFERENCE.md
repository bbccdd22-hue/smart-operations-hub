# مرجع اتصال Oracle (GOLD) — للهجرة أو جلب البيانات

للاستخدام عند تنفيذ هجرة بيانات من نظام Oracle القديم أو جلب قراءات من خدمة GOLD.

---

## من TNSNAMES.ORA و 03_connection_info.md

### اسم الاتصال: **GOLD**

```
GOLD =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = ACCSAIF)(PORT = 1521))
    (CONNECT_DATA =
      (SERVER = DEDICATED)
      (SERVICE_NAME = orcl)
    )
  )
```

### القيم المهمة

| المعيار        | القيمة    |
|----------------|-----------|
| **Host**       | ACCSAIF   |
| **Port**       | 1521      |
| **Service Name** | orcl    |
| **Protocol**   | TCP       |

### سلسلة اتصال نموذجية

- **ODBC / .NET / Java:**  
  `Data Source=(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=ACCSAIF)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=orcl)));User Id=...;Password=...;`

- **Python (cx_Oracle / oracledb):**  
  استخدام `dsn` مكافئ أو TNS name = GOLD مع نسخ TNSNAMES.ORA إلى المسار المعتمد.

- **نسخ الملف:**  
  المجلد المرجعي: `C:\Users\kings\Desktop\saif_new\connection\TNSNAMES.ORA`

---

## ملاحظة

لا تخزّن كلمات المرور في المستودع. استخدم متغيرات بيئة أو سيرفر إعدادات آمن للاتصال بـ GOLD.
