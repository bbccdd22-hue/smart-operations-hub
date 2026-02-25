# هيكل جداول قاعدة البيانات - ERP

جميع الجداول التالية مُنشأة ومرتبطة بالمحاسبة والمخزون.

---

## 1. الموارد البشرية (HR)

### الجداول

| الجدول | الوصف | الربط المحاسبي | الربط المخزني |
|--------|-------|----------------|---------------|
| **CostCenter** | مركز تكلفة (فرع/قسم) | قيد الرواتب يوزّع على مراكز التكلفة | — |
| **Employee** | موظف (فرع، مركز تكلفة، عقود) | — | — |
| **EmployeeContract** | عقد (راتب أساسي، بدلات) | مصدر لأرقام PayrollRunLine | — |
| **AttendanceRecord** | حضور/انصراف (clock_in, clock_out, geo) | — | Branch |
| **PayrollRun** | دفعة رواتب شهرية | → **JournalEntry** | — |
| **PayrollRunLine** | سطر راتب (موظف، إجمالي، خصومات، صافي) | عبر PayrollRun.journal_entry | — |
| **LeaveRequest** | طلب إجازة | — | — |
| **SalaryAdvance** | سلفة (تُخصم من الراتب) | — | — |
| **EmployeePenalty** | جزاء (خصم من الراتب) | — | — |

### الربط المحاسبي للرواتب
عند ترحيل دفعة الرواتب يُنشأ `JournalEntry`:
- **مدين:** مصروف رواتب (052)
- **دائن:** نقدية/بنك (011)

---

## 2. المشتريات (Procurement)

### الجداول

| الجدول | الوصف | الربط المحاسبي | الربط المخزني |
|--------|-------|----------------|---------------|
| **Supplier** | مورد (ائتمان، شروط دفع) | — | — |
| **PurchaseRequest** | طلب شراء | — | — |
| **PurchaseRequestLine** | سطر طلب (Ingredient, qty) | — | → **Ingredient** |
| **PurchaseOrder** | أمر شراء (من طلب أو مباشرة) | — | — |
| **PurchaseOrderLine** | سطر أمر (Ingredient, qty, unit_price) | — | → **Ingredient** |
| **GoodsReceipt** | استلام بضاعة | → **JournalEntry** | تحديث BranchStock |
| **GoodsReceiptLine** | سطر استلام (كمية مستلمة) | — | → StockMovement |
| **SupplierInvoice** | فاتورة مورد | → **JournalEntry** | — |

### الربط المحاسبي
- **استلام بضاعة:** مدين مخزون (051) / مدين مصروف، دائن استحقاق موردين (021)
- **فاتورة/دفع:** مدين استحقاق، دائن نقدية/بنك

---

## 3. CRM والولاء

### الجداول

| الجدول | الوصف | الربط المحاسبي | الربط المخزني |
|--------|-------|----------------|---------------|
| **Customer** | عميل (tier، إجمالي صرف، زيارات) | — | — |
| **LoyaltyPointsTransaction** | حركة نقاط (اكتساب/استبدال) | — | SaleTransaction (pos) |
| **LoyaltyReward** | مكافأة بنقاط | — | FoodicsProduct |
| **LoyaltyOffer** | اشترِ X واحصل على Y / نقاط للريال | — | FoodicsProduct |
| **WalletBalance** | رصيد المحفظة المسبقة الدفع | — | — |
| **WalletTransaction** | شحن/استهلاك محفظة | → **JournalEntry** | SaleTransaction |

### الربط المحاسبي للمحفظة
- **شحن:** مدين نقدية، دائن التزام عملاء (013)
- **استهلاك:** مدين التزام عملاء، دائن إيرادات (04)

---

## 4. التصنيع / المطبخ المركزي (Manufacturing)

### الوصفات المتداخلة (في inventory)

| الجدول | الوصف |
|--------|-------|
| **Recipe** | وصفة لمنتج (yield_qty, yield_unit) |
| **RecipeLine** | سطر وصفة (Ingredient, qty, unit) |
| **Ingredient.linked_product** | مكوّن نصف مصنع → منتج له وصفة فرعية |

عند تفكيك BOM: `inventory.services.explode_recipe_requirements()` يفكك المكونات المتداخلة recursively عبر `linked_product`.

### جدول المطبخ المركزي

| الجدول | الوصف | الربط المحاسبي | الربط المخزني |
|--------|-------|----------------|---------------|
| **CentralKitchenBranch** | فرع كمطبخ مركزي | — | Branch |
| **ProductionOrder** | أمر إنتاج (منتج وسيط، كمية، total_cost) | يدوي/مستقبلي | — |
| **ProductionOrderLine** | مادة خام مطلوبة | — | → **Ingredient** |
| **InternalIndent** | طلب فرع من المطبخ | — | from_branch → to_branch |
| **InternalIndentLine** | سطر طلب (Ingredient, qty) | — | → **Ingredient** |
| **DeliveryNote** | مذكرة تسليم | — | StockTransfer |

عند إكمال أمر الإنتاج: خصم مواد خام من المخزون، إضافة المنتج الوسيط (إن وُجد في المخزون).

---

## 5. الأصول الثابتة (Assets)

### الجداول

| الجدول | الوصف | الربط المحاسبي | الربط المخزني |
|--------|-------|----------------|---------------|
| **Asset** | أصل (كود، شراء، عمر افتراضي، قيمة متبقية) | — | Branch |
| **AssetDepreciation** | إهلاك شهري | → **JournalEntry** | — |
| **MaintenanceSchedule** | جدولة صيانة (by_usage / by_days) | — | — |
| **MaintenanceTask** | مهمة صيانة | — | — |

### الربط المحاسبي للإهلاك
- **مدين:** مصروف إهلاك (055)
- **دائن:** مجمع إهلاك الأصول (026)

---

## النواة المشتركة

| الجدول | التطبيق |
|--------|---------|
| Branch, Brand, Organization | org |
| ChartAccount, JournalEntry, JournalEntryLine | accounting |
| Ingredient, FoodicsProduct, Recipe, RecipeLine, BranchStock, StockMovement | inventory |

---

## مخطط العلاقات (مبسّط)

```
Organization → Brand → Branch
     │           │        │
     │           ├────────┼── HR: Employee, AttendanceRecord, PayrollRun
     │           ├────────┼── Procurement: PO → GoodsReceipt → StockMovement
     │           ├────────┼── CRM: Customer, Wallet
     │           ├────────┼── Manufacturing: ProductionOrder, InternalIndent
     │           └────────┴── Assets: Asset, AssetDepreciation
     │
     └── accounting.JournalEntry ← PayrollRun, GoodsReceipt, SupplierInvoice,
                                   WalletTransaction, AssetDepreciation, SaleTransaction
```
