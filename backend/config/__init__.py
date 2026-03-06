# Load Celery app when Django starts (worker needs this)
# Fails gracefully if celery/redis not installed
try:
    from .celery import app as celery_app

    __all__ = ("celery_app",)
except ImportError:
    celery_app = None
    __all__ = ()
