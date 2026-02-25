# UUID for StockTransfer – منع التخمين في روابط API

import uuid

from django.db import migrations, models


def gen_uuids(apps, schema_editor):
    StockTransfer = apps.get_model("inventory", "StockTransfer")
    for obj in StockTransfer.objects.all():
        obj.uuid = uuid.uuid4()
        obj.save(update_fields=["uuid"])


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0014_add_ingredient_linked_product"),
    ]

    operations = [
        migrations.AddField(
            model_name="stocktransfer",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, null=True),
        ),
        migrations.RunPython(gen_uuids),
        migrations.AlterField(
            model_name="stocktransfer",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
