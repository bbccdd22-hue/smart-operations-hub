# UUID for ExcelUpload – منع التخمين في روابط API

import uuid

from django.db import migrations, models


def gen_uuids(apps, schema_editor):
    ExcelUpload = apps.get_model("imports", "ExcelUpload")
    for obj in ExcelUpload.objects.all():
        obj.uuid = uuid.uuid4()
        obj.save(update_fields=["uuid"])


class Migration(migrations.Migration):

    dependencies = [
        ("imports", "0008_add_upload_progress"),
    ]

    operations = [
        migrations.AddField(
            model_name="excelupload",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, null=True),
        ),
        migrations.RunPython(gen_uuids),
        migrations.AlterField(
            model_name="excelupload",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
