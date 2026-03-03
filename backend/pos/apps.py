from django.apps import AppConfig


class PosConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "pos"
    verbose_name = "POS / شاشة الكاشير"

    def ready(self):
        import pos.signals  # noqa: F401 — registers the post_save receiver
