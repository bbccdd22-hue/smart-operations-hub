# UUID for SystemErrorLog – منع التخمين في روابط API

import uuid

from django.db import migrations, models


def gen_uuids(apps, schema_editor):
    SystemErrorLog = apps.get_model("org", "SystemErrorLog")
    for obj in SystemErrorLog.objects.all():
        obj.uuid = uuid.uuid4()
        obj.save(update_fields=["uuid"])


class Migration(migrations.Migration):

    dependencies = [
        ("org", "0020_add_admin_notification_reference_and_alerts"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemerrorlog",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, null=True),
        ),
        migrations.RunPython(gen_uuids),
        migrations.AlterField(
            model_name="systemerrorlog",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
