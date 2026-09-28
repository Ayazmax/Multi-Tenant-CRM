import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User

from .conftest import PASSWORD

LOGIN_URL = "/api/v1/auth/login/"

pytestmark = pytest.mark.django_db


def login(email, password=PASSWORD):
    return APIClient().post(LOGIN_URL, {"email": email, "password": password}, format="json")


def test_login_returns_tokens_and_profile(admin_a):
    response = login(admin_a.email)

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert {"access", "refresh", "user"} <= body["data"].keys()
    assert body["data"]["user"]["role"] == "admin"
    assert body["data"]["user"]["organization"]["id"] == admin_a.organization_id


def test_login_email_is_case_insensitive(admin_a):
    assert login(admin_a.email.upper()).status_code == 200


def test_login_with_wrong_password_uses_error_envelope(admin_a):
    response = login(admin_a.email, "wrong-password")

    assert response.status_code == 401
    assert response.json()["success"] is False
    assert response.json()["message"]


def test_password_whitespace_is_significant(admin_a):
    assert login(admin_a.email, f"{PASSWORD} ").status_code == 401

    admin_a.set_password(" spaced password ")
    admin_a.save()
    assert login(admin_a.email, " spaced password ").status_code == 200
    assert login(admin_a.email, "spaced password").status_code == 401


def test_user_without_organization_cannot_log_in(db):
    User.objects.create_superuser(email="root@example.com", password=PASSWORD)
    assert login("root@example.com").status_code == 401


def test_protected_endpoint_requires_token():
    response = APIClient().get("/api/v1/companies/")

    assert response.status_code == 401
    assert response.json()["success"] is False


def test_invalid_token_is_rejected(db):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
    assert client.get("/api/v1/companies/").status_code == 401


def test_me_returns_current_user(admin_a, api_client_for):
    response = api_client_for(admin_a).get("/api/v1/auth/me/")

    assert response.status_code == 200
    assert response.json()["data"]["email"] == admin_a.email


def test_refresh_and_logout_blacklists_refresh_token(admin_a):
    tokens = login(admin_a.email).json()["data"]
    client = APIClient()

    refreshed = client.post("/api/v1/auth/refresh/", {"refresh": tokens["refresh"]}, format="json")
    assert refreshed.status_code == 200
    new_refresh = refreshed.json()["data"]["refresh"]

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refreshed.json()['data']['access']}")
    assert client.post("/api/v1/auth/logout/", {"refresh": new_refresh}, format="json").status_code == 200

    reuse = APIClient().post("/api/v1/auth/refresh/", {"refresh": new_refresh}, format="json")
    assert reuse.status_code == 401
