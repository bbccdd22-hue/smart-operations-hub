# Decimal Precision Migration Guide

This guide describes how to gradually migrate existing `DecimalField` definitions to use the standardized precision from `config.constants`.

## Constants

```python
from config.constants import DECIMAL_MAX_DIGITS, DECIMAL_PLACES, DECIMAL_PRECISION

# DECIMAL_MAX_DIGITS = 20
# DECIMAL_PLACES = 10
# DECIMAL_PRECISION = (20, 10)  # (max_digits, decimal_places)
```

Use for:
- Monetary amounts (sales, costs, revenue)
- Exchange rates
- Percentages and ratios where high precision is required
- Any new `DecimalField` involving money or rates

## Migration Strategy (No Big-Bang Change)

**Do NOT** alter all existing `DecimalField`s in one pass. That would require many migrations across `accounting`, `inventory`, `shifts`, `imports`, etc., and risks data truncation or rounding issues.

### Step 1: New Models Only
- All **new** models use `DECIMAL_MAX_DIGITS` and `DECIMAL_PLACES` (or `*DECIMAL_PRECISION`).
- Example: `currencies.ExchangeRate`, any new financial tables.

### Step 2: Incremental Migration (When Touching a Model)
When you modify an existing model (e.g. add a field, change logic), consider:
1. If the field is monetary/exchange-related, create a migration that alters it:
   ```python
   # In migration operations:
   migrations.AlterField(
       model_name='SomeModel',
       name='amount',
       field=models.DecimalField(max_digits=20, decimal_places=10, ...),
   ),
   ```
2. Ensure application code handles the new precision (typically no change needed; Python Decimal handles it).

### Step 3: Validation
- Run tests after each migration.
- For fields that may have values near the old limits (e.g. `max_digits=10, decimal_places=2`), verify no data exceeds 8 integer digits before migration. If it does, plan a data backfill or accept truncation.

### Models to Migrate (When Ready)
Prioritize by impact:
1. `accounting.*` – journal lines, settlements, chart accounts
2. `inventory.*` – cost, price, profit fields
3. `shifts.*` – shift closing totals
4. `imports.*` – sale amounts, revenue
5. Others with monetary fields

### Example Migration
```python
# migrations/00XX_alter_somemodel_amount_precision.py
from django.db import migrations, models
from config.constants import DECIMAL_MAX_DIGITS, DECIMAL_PLACES

class Migration(migrations.Migration):
    dependencies = [
        ('accounting', '00XX_previous_migration'),
    ]

    operations = [
        migrations.AlterField(
            model_name='journalentryline',
            name='amount',
            field=models.DecimalField(max_digits=DECIMAL_MAX_DIGITS, decimal_places=DECIMAL_PLACES, ...),
        ),
    ]
```

### Backward Compatibility
- Reading/writing via Django ORM and `Decimal` works transparently.
- Frontend or APIs that format numbers may need to adjust display precision (e.g. 2–4 decimal places for display while storing 10).
- SQL reporting: ensure `ROUND()` or truncation where human-readable output is expected.
