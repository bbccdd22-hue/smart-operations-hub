"""Add waste_percentage to RecipeLine for advanced recipe costing."""
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0015_add_stock_transfer_uuid"),
    ]

    operations = [
        migrations.AddField(
            model_name="recipeline",
            name="waste_percentage",
            field=models.DecimalField(
                max_digits=6,
                decimal_places=2,
                default=Decimal("0.00"),
                help_text="نسبة الهدر % (0-100). تُضاف إلى الكمية الفعلية المستهلكة.",
            ),
        ),
    ]
