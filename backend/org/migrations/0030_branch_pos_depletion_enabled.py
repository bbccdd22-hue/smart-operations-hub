from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("org", "0029_add_excel_parse_error_event_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="branch",
            name="pos_depletion_enabled",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "إذا كان True، كل SaleTransaction جديد يُطلق خصم المخزون فوراً. "
                    "لا تُفعّل إلا عند إيقاف الرفع عبر Excel لهذا الفرع."
                ),
            ),
        ),
    ]
