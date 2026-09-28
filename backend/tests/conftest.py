import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Organization, User
from apps.core.constants import Role
from apps.crm.models import Company, Contact

PASSWORD = "Str0ng!Pass"


@pytest.fixture
def org_a(db):
    return Organization.objects.create(name="Org A", subscription_plan=Organization.SubscriptionPlan.PRO)


@pytest.fixture
def org_b(db):
    return Organization.objects.create(name="Org B")


@pytest.fixture
def make_user(db):
    def _make(organization, role=Role.STAFF, email=None):
        email = email or f"{role}-{organization.pk}@example.com"
        return User.objects.create_user(email=email, password=PASSWORD, organization=organization, role=role)

    return _make


@pytest.fixture
def api_client_for():
    def _client(user):
        client = APIClient()
        token = RefreshToken.for_user(user).access_token
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client

    return _client


@pytest.fixture
def admin_a(org_a, make_user):
    return make_user(org_a, Role.ADMIN)


@pytest.fixture
def manager_a(org_a, make_user):
    return make_user(org_a, Role.MANAGER)


@pytest.fixture
def staff_a(org_a, make_user):
    return make_user(org_a, Role.STAFF)


@pytest.fixture
def admin_b(org_b, make_user):
    return make_user(org_b, Role.ADMIN)


@pytest.fixture
def company_a(org_a):
    return Company.objects.create(organization=org_a, name="Alpha Travel", industry="Travel", country="UK")


@pytest.fixture
def company_b(org_b):
    return Company.objects.create(organization=org_b, name="Beta Tours", industry="Tours", country="France")


@pytest.fixture
def contact_a(company_a):
    return Contact.objects.create(
        organization=company_a.organization,
        company=company_a,
        full_name="Alice Smith",
        email="alice@alpha.example",
        phone="12345678",
    )


@pytest.fixture
def contact_b(company_b):
    return Contact.objects.create(
        organization=company_b.organization,
        company=company_b,
        full_name="Bob Martin",
        email="bob@beta.example",
    )


@pytest.fixture
def image_file():
    def _image(name="logo.png", size=(16, 16), fmt="PNG"):
        buffer = io.BytesIO()
        Image.new("RGB", size, "blue").save(buffer, fmt)
        return SimpleUploadedFile(name, buffer.getvalue(), content_type=f"image/{fmt.lower()}")

    return _image
