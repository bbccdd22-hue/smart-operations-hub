"""
Root conftest.py – shared fixtures for all test modules.
Sets mandatory env vars so tests can start without a real .env file.
"""
import os

# Must be set before settings.py is imported (it raises ImproperlyConfigured otherwise)
os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("DJANGO_DEBUG", "true")
os.environ.setdefault("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

import pytest


@pytest.fixture
def test_city(db):
    """Return a City instance suitable for tests."""
    from org.models import City
    city, _ = City.objects.get_or_create(
        name_en="TestCity",
        defaults={"name_ar": "مدينة", "is_active": True},
    )
    return city


@pytest.fixture
def test_brand(db):
    """Return a Brand instance suitable for tests."""
    from org.models import Brand
    brand, _ = Brand.objects.get_or_create(
        name="TestBrand",
        defaults={"name_ar": "تجربة", "is_active": True},
    )
    return brand


@pytest.fixture
def test_branch(db, test_brand, test_city):
    """Return a Branch instance suitable for tests."""
    from org.models import Branch
    branch, _ = Branch.objects.get_or_create(
        name="TestBranch",
        defaults={"brand": test_brand, "city": test_city, "is_active": True},
    )
    return branch


@pytest.fixture
def test_user(db):
    """Return a minimal User instance for tests."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user, _ = User.objects.get_or_create(username="test_user")
    return user
