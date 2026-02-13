# Generated migration for DailySale.average_order (متوسط الطلب)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('imports', '0004_add_daily_sale_order_count'),
    ]

    operations = [
        migrations.AddField(
            model_name='dailysale',
            name='average_order',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='متوسط الطلب / Average Order - pre-calculated from Excel, DO NOT compute',
                max_digits=14,
                null=True,
            ),
        ),
    ]
