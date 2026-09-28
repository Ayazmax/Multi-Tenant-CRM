import pytest

from apps.activity.models import ActivityLog
from apps.crm.models import Company

pytestmark = pytest.mark.django_db


def test_company_list_only_contains_own_organization(admin_a, company_a, company_b, api_client_for):
    response = api_client_for(admin_a).get("/api/v1/companies/")

    ids = [c["id"] for c in response.json()["data"]]
    assert ids == [company_a.id]


@pytest.mark.parametrize("method", ["get", "patch", "put", "delete"])
def test_foreign_company_is_not_found(method, admin_a, company_b, api_client_for):
    client = api_client_for(admin_a)
    response = getattr(client, method)(f"/api/v1/companies/{company_b.id}/", {"name": "Hijacked"}, format="json")

    assert response.status_code == 404
    company_b.refresh_from_db()
    assert company_b.name == "Beta Tours"
    assert company_b.is_deleted is False


@pytest.mark.parametrize("method", ["get", "patch", "delete"])
def test_foreign_contact_is_not_found(method, admin_a, contact_b, api_client_for):
    response = getattr(api_client_for(admin_a), method)(f"/api/v1/contacts/{contact_b.id}/", {}, format="json")
    assert response.status_code == 404


def test_contact_list_only_contains_own_organization(admin_a, contact_a, contact_b, api_client_for):
    response = api_client_for(admin_a).get("/api/v1/contacts/")
    assert [c["id"] for c in response.json()["data"]] == [contact_a.id]


def test_filtering_contacts_by_foreign_company_returns_nothing(admin_a, contact_b, api_client_for):
    response = api_client_for(admin_a).get(f"/api/v1/contacts/?company={contact_b.company_id}")

    assert response.status_code == 200
    assert response.json()["data"] == []


def test_cannot_attach_contact_to_foreign_company(admin_a, company_b, api_client_for):
    response = api_client_for(admin_a).post(
        "/api/v1/contacts/",
        {"company": company_b.id, "full_name": "Mallory", "email": "mallory@example.com"},
        format="json",
    )

    assert response.status_code == 400
    assert "company" in response.json()["errors"]


def test_organization_is_assigned_server_side(admin_a, org_b, api_client_for):
    response = api_client_for(admin_a).post(
        "/api/v1/companies/", {"name": "Injected", "organization": org_b.id}, format="json"
    )

    assert response.status_code == 201
    assert Company.objects.get(pk=response.json()["data"]["id"]).organization_id == admin_a.organization_id


def test_company_names_only_need_to_be_unique_within_an_organization(admin_a, company_b, api_client_for):
    response = api_client_for(admin_a).post("/api/v1/companies/", {"name": company_b.name}, format="json")
    assert response.status_code == 201


def test_activity_logs_are_isolated(admin_a, admin_b, api_client_for):
    api_client_for(admin_b).post("/api/v1/companies/", {"name": "B Corp"}, format="json")

    response = api_client_for(admin_a).get("/api/v1/activity-logs/")

    assert response.json()["data"] == []
    assert ActivityLog.objects.filter(organization=admin_b.organization).count() == 1


def test_dashboard_counts_only_own_organization(admin_a, company_a, company_b, contact_b, api_client_for):
    stats = api_client_for(admin_a).get("/api/v1/dashboard/").json()["data"]["stats"]

    assert stats["companies"] == 1
    assert stats["contacts"] == 0


def test_organization_members_are_isolated(admin_a, admin_b, api_client_for):
    emails = [u["email"] for u in api_client_for(admin_a).get("/api/v1/users/").json()["data"]]
    assert emails == [admin_a.email]
