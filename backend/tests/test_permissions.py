import pytest

from apps.core.constants import Role

pytestmark = pytest.mark.django_db


@pytest.fixture
def user_with_role(org_a, make_user):
    def _user(role):
        return make_user(org_a, role)

    return _user


@pytest.mark.parametrize(
    "role, expected",
    [(Role.ADMIN, 201), (Role.MANAGER, 201), (Role.STAFF, 201)],
)
def test_create_company(role, expected, user_with_role, api_client_for):
    response = api_client_for(user_with_role(role)).post("/api/v1/companies/", {"name": "New Co"}, format="json")
    assert response.status_code == expected


@pytest.mark.parametrize(
    "role, expected",
    [(Role.ADMIN, 200), (Role.MANAGER, 200), (Role.STAFF, 403)],
)
def test_update_company(role, expected, company_a, user_with_role, api_client_for):
    response = api_client_for(user_with_role(role)).patch(
        f"/api/v1/companies/{company_a.id}/", {"industry": "Aviation"}, format="json"
    )
    assert response.status_code == expected


@pytest.mark.parametrize(
    "role, expected",
    [(Role.ADMIN, 200), (Role.MANAGER, 403), (Role.STAFF, 403)],
)
def test_delete_company(role, expected, company_a, user_with_role, api_client_for):
    response = api_client_for(user_with_role(role)).delete(f"/api/v1/companies/{company_a.id}/")
    assert response.status_code == expected


@pytest.mark.parametrize(
    "role, expected",
    [(Role.ADMIN, 200), (Role.MANAGER, 403), (Role.STAFF, 403)],
)
def test_delete_contact(role, expected, contact_a, user_with_role, api_client_for):
    response = api_client_for(user_with_role(role)).delete(f"/api/v1/contacts/{contact_a.id}/")
    assert response.status_code == expected


@pytest.mark.parametrize(
    "role, expected",
    [(Role.ADMIN, 200), (Role.MANAGER, 200), (Role.STAFF, 403)],
)
def test_update_contact(role, expected, contact_a, user_with_role, api_client_for):
    response = api_client_for(user_with_role(role)).patch(
        f"/api/v1/contacts/{contact_a.id}/", {"role": "CEO"}, format="json"
    )
    assert response.status_code == expected


@pytest.mark.parametrize(
    "role, expected",
    [(Role.ADMIN, 200), (Role.MANAGER, 200), (Role.STAFF, 403)],
)
def test_view_activity_logs(role, expected, user_with_role, api_client_for):
    response = api_client_for(user_with_role(role)).get("/api/v1/activity-logs/")
    assert response.status_code == expected


def test_every_role_can_read(company_a, user_with_role, api_client_for):
    for role in Role.values:
        client = api_client_for(user_with_role(role))
        assert client.get("/api/v1/companies/").status_code == 200
        assert client.get(f"/api/v1/companies/{company_a.id}/").status_code == 200


def test_permission_error_uses_standard_envelope(company_a, staff_a, api_client_for):
    body = api_client_for(staff_a).delete(f"/api/v1/companies/{company_a.id}/").json()

    assert body["success"] is False
    assert body["message"] == "Your role does not allow this action."
