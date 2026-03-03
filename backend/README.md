# Smart Operations Hub – Backend

Django 6.x ERP backend. Multi-brand / multi-branch.

## Quick Start (local dev)

```bash
# 1. Copy env template and fill in your values
cp ../.env.example .env

# 2. Install dependencies
python -m pip install -r requirements.txt

# 3. Apply migrations
python manage.py migrate

# 4. Create the owner account
python manage.py create_owner SAIF 123

# 5. Run the server
python manage.py runserver 0.0.0.0:8000 --noreload
```

> See `../start_all.bat` to launch both backend and frontend together.

## Running Tests

```bash
# Using pytest (recommended)
python -m pytest

# Or using Django's built-in test runner
python manage.py test
```

### Most Important Test Files

| File | What it validates |
|------|-------------------|
| `accounting/tests/test_journal_services.py` | Double-entry balance, correct account codes, idempotency, zero-amount |
| `accounting/tests/test_report_services.py` | Sales/purchase flow journal entries, account balance consistency, report aggregation |
| `shifts/tests/test_shift_closing.py` | Variance computation, denomination totals, journal entry integration (incl. network-only) |
| `inventory/tests/test_depletion_services.py` | Recipe explosion → stock depletion, idempotency, negative stock, BranchStock auto-create |
| `inventory/tests/test_inventory_transfers.py` | Branch-to-branch transfer lifecycle (departure/confirm/reject), stock conservation, idempotency |
| `hr/tests/test_payroll_accounting.py` | Payroll run creation, journal entry balance, idempotency, missing-accounts behavior |
| `pos/tests/test_pos_depletion_integration.py` | POS → inventory signal, branch flag guard, global flag guard, no-recipe warning, double-depletion prevention |

### Test Configuration

- Framework: **pytest** + **pytest-django**
- Config: `pytest.ini` in this directory
- Django settings: `config.settings` (auto-loaded)
- DB: **in-memory SQLite** (test DB created fresh each run via `--no-migrations`)
- Shared fixtures: `conftest.py` (provides `test_city`, `test_brand`, `test_branch`, `test_user`)

## Project Structure

```
backend/
├── config/               Django project settings + URLs
├── accounting/           Chart of accounts, journal entries, reconciliation
├── analytics/            Reports, dashboards, executive summary
├── core/                 Permissions, audit log, middleware, error logging
├── imports/              Excel upload + parsing pipeline
├── inventory/            Ingredients, recipes, stock movements, BOM
├── org/                  Brand, Branch, City, User management
├── procurement/          Suppliers, purchase requests/orders/invoices
├── shifts/               Shift management + digital closing
├── pos/                  POS / cashier screen
├── hr/                   Employees, attendance, payroll
├── financials/           Financial summary views
├── notifications/        Alert engine
└── ...
```

## Environment Variables

See `../.env.example` for the full list. Required variables:

| Variable | Description |
|----------|-------------|
| `DJANGO_SECRET_KEY` | **Required.** Strong random key (50+ chars). |
| `DJANGO_DEBUG` | `true` for local dev, `false` for production. |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated hostnames. |
| `FRONTEND_ORIGINS` | Comma-separated frontend URLs for CORS/CSRF (production). |
| `DATABASE_URL` | Postgres URL for production (leave blank for SQLite). |
| `POS_REALTIME_DEPLETION_ENABLED` | `true` to activate POS → inventory real-time depletion. Default: `false`. |

## POS Real-time Depletion Feature Flag

Two guards must **both** be `True` before a `SaleTransaction` triggers inventory depletion:

1. **Global flag** in settings: `POS_REALTIME_DEPLETION_ENABLED=true` (env var)
2. **Branch-level flag**: `Branch.pos_depletion_enabled=True` (set via Django Admin → Org → Branches)

When a branch has `pos_depletion_enabled=True`, Excel-based depletion is automatically **skipped**
for that branch to prevent double-counting. This allows a safe, gradual rollout:

```
Phase 1 (default): POS flag OFF  → Excel depletion runs for all branches.
Phase 2 (per-branch): Enable POS flag per branch → Excel skipped for those branches.
Phase 3 (full rollout): All branches on POS depletion → Excel depletion fully retired.
```
