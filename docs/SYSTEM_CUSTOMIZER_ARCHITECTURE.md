# System Customizer – Backend Architecture (Dynamic UI/UX Engine)

## Objective

Allow viewing and editing every form/table in the system without code changes: add/remove fields, reorder via drag-and-drop, persist to DB and drive React UI from a single “Template” definition. Support multi-line detail (e.g. multiple invoices per Journal Entry).

---

## 1. Design Principles

| Principle | Choice |
|-----------|--------|
| **Schema strategy** | **Definition + value store**: Field *definitions* live in `EntityTemplate` + `DynamicFieldDefinition`. *Values* for custom fields live in `CustomFieldValue` (generic FK). No automatic ALTER TABLE on save. |
| **System vs custom fields** | **System fields**: Existing model columns; customizer only controls visibility, order, labels. **Custom fields**: Defined in DynamicFieldDefinition with `is_system=False`; values in `CustomFieldValue`. |
| **Persistence** | Saving in Customizer updates only `EntityTemplate` and `DynamicFieldDefinition`. React reads these and renders forms/tables. New “custom” fields do not change Django model schema; they use the generic value table. |
| **Multi-line / line-item** | Supported via **child templates** (e.g. `journal_entry_invoice`) and, where needed, **concrete child models** (e.g. `JournalEntryInvoice`) so one Journal Entry can have many invoices with Purchase Date, Vendor Invoice #, etc. |

---

## 2. Core Models

### 2.1 EntityTemplate

Identifies a “screen” or “form” in the system (one per module form/table).

| Field | Type | Description |
|-------|------|-------------|
| `app_label` | CharField | Django app (e.g. `accounting`, `inventory`) |
| `model_name` | CharField | Model class name (e.g. `JournalEntry`, `Product`) |
| `slug` | SlugField (unique) | Stable key for API/UI (e.g. `journal_entry`, `journal_entry_line`) |
| `template_type` | CharField | `form` \| `line_item` \| `list` |
| `name_ar` / `name_en` | CharField | Display name |
| `parent_template` | FK (self, null) | For line_item: the parent form template |
| `created_at` / `updated_at` | DateTime | Audit |

- **form**: Main entity form (e.g. Journal Entry header).
- **line_item**: Repeatable block (e.g. Journal Entry lines, or “invoices” under one entry).
- **list**: List/table view (columns to show, order).

### 2.2 DynamicFieldDefinition

One row per “field” in a template (system or custom).

| Field | Type | Description |
|-------|------|-------------|
| `template` | FK → EntityTemplate | Which form/table |
| `field_key` | CharField | Key used in API/UI (e.g. `purchase_date`, `vendor_invoice_number`). Unique per template. |
| `label_ar` / `label_en` | CharField | Labels |
| `field_type` | CharField | `text` \| `number` \| `date` \| `datetime` \| `boolean` \| `select` \| `currency` \| `foreign_key` |
| `required` | BooleanField | Required in form |
| `visible` | BooleanField | Shown in UI |
| `order` | PositiveSmallIntegerField | Display order (drag-and-drop updates this) |
| `section` | CharField (optional) | Group in UI (e.g. “Header”, “Details”) |
| `metadata` | JSONField | Options for select, max_length, help_text, etc. |
| `is_system` | BooleanField | True = existing model field (we only control order/visibility). False = custom field; value stored in CustomFieldValue. |

- **Unique constraint**: `(template, field_key)`.

### 2.3 CustomFieldValue

Stores values for **custom** fields only (when `DynamicFieldDefinition.is_system == False`).

| Field | Type | Description |
|-------|------|-------------|
| `content_type` | FK → ContentType | Entity type (e.g. JournalEntry, JournalEntryLine) |
| `object_id` | PositiveIntegerField | PK of the entity instance |
| `field_definition` | FK → DynamicFieldDefinition | Must have `is_system=False` |
| `value_text` | TextField (nullable) | For text, select value, FK display |
| `value_number` | DecimalField (nullable) | For number, currency |
| `value_date` | DateField/DateTimeField (nullable) | For date/datetime |

- **Unique constraint**: `(content_type, object_id, field_definition)`.
- Indexes on `(content_type, object_id)` and `(field_definition, value_text)` (for search in reports).

---

## 3. Multi-Entry / Multi-Invoice (Expense Example)

**Requirement**: One Expense Journal Entry can have multiple maintenance invoices, each with Purchase Date and Vendor Invoice #.

**Option A – Use existing JournalEntryLine**: Add optional columns to `JournalEntryLine` (e.g. `purchase_date`, `vendor_invoice_number`). Each line = one “invoice”. Customizer defines these as system fields and orders them.

**Option B – New child model (recommended)**: Add model `JournalEntryInvoice`:

| Field | Type |
|-------|------|
| `journal_entry` | FK → JournalEntry |
| `purchase_date` | DateField |
| `vendor_invoice_number` | CharField |
| `vendor_name` | CharField (optional) |
| `amount` | DecimalField |
| `notes` | TextField (optional) |

- One `JournalEntry` → many `JournalEntryInvoice`.
- Customizer has an `EntityTemplate` for `journal_entry_invoice` (template_type=`line_item`, parent=journal_entry). DynamicFieldDefinition rows for purchase_date, vendor_invoice_number, etc. (all system fields on the new model).
- UI: Journal Entry form shows a repeatable “Invoices” section; each row is a JournalEntryInvoice.

**Recommendation**: Option B for clear semantics and reporting (filter by vendor_invoice_number, purchase_date).

---

## 4. API Outline

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/customizer/templates/` | GET | List all EntityTemplates (for Customizer dashboard). |
| `/api/customizer/templates/<slug>/` | GET | Get one template and its field definitions (order, visible, labels, types). |
| `/api/customizer/templates/<slug>/` | PUT/PATCH | Update template and reorder/update fields (Save in Customizer). |
| `/api/customizer/fields/` | POST | Add new custom field to a template (creates DynamicFieldDefinition with is_system=False). |
| `/api/customizer/fields/<id>/` | PATCH/DELETE | Update or remove a custom field. |
| `/api/<app>/<model>/<id>/custom-values/` | GET/PUT | Get or set CustomFieldValue for one entity (used by entry screens). |
| Reports | - | Filter/export by custom fields: join or subquery on CustomFieldValue by field_definition and value_* (e.g. “Reference ID”). |

---

## 5. Automatic Impact (Entry screens & Reports)

- **Entry screens**: React loads `/api/customizer/templates/<slug>/` and builds the form/table from `DynamicFieldDefinition` (order, visible, type, section). For system fields, bind to existing API; for custom fields, read/write via `/api/.../custom-values/`.
- **Search/Reports**: Backend report APIs accept optional filters for custom fields (e.g. `custom_reference_id=xyz`). Query: filter on `CustomFieldValue` where `field_definition.field_key='reference_id'` and `value_text=xyz`.

---

## 6. Implementation Order

1. **Step A**: Create `customizer` app with `EntityTemplate`, `DynamicFieldDefinition`, `CustomFieldValue`; migrations; register in admin.
2. **Step B**: Customizer Dashboard in React: list templates, select module, show layout (fields + order), drag-and-drop, Save → PATCH template/fields.
3. **Step C**: Journal Entry multi-invoice: add `JournalEntryInvoice` model; EntityTemplate for it; update Journal Entry UI to show repeatable invoices and persist them.
4. **Later**: Wire entry screens to template API; add custom field filters to report APIs.

---

## 7. File Layout (Backend)

```
backend/
  customizer/
    __init__.py
    models.py          # EntityTemplate, DynamicFieldDefinition, CustomFieldValue
    admin.py           # Register models
    serializers.py     # Template + fields serialization
    views.py           # Template CRUD, field CRUD, custom-values
    urls.py
  config/
    api_urls.py        # path("customizer/", include("customizer.urls"))
  accounting/
    models.py          # + JournalEntryInvoice (Step C)
```

This document is the single source of truth for the **backend** dynamic schema. Frontend Customizer Dashboard and wiring of entry screens will follow this design.
