import pytest

from apps.activity.models import ActivityLog

pytestmark = pytest.mark.django_db


def test_company_crud_is_audited(admin_a, api_client_for):
    client = api_client_for(admin_a)

    company_id = client.post("/api/v1/companies/", {"name": "Audit Co"}, format="json").json()["data"]["id"]
    client.patch(f"/api/v1/companies/{company_id}/", {"industry": "Travel"}, format="json")
    client.delete(f"/api/v1/companies/{company_id}/")

    logs = list(ActivityLog.objects.order_by("id"))
    assert [log.action for log in logs] == ["CREATE", "UPDATE", "DELETE"]
    for log in logs:
        assert log.user == admin_a
        assert log.organization_id == admin_a.organization_id
        assert log.model_name == "Company"
        assert log.object_id == company_id
    assert logs[1].changes == {"industry": {"from": "", "to": "Travel"}}


def test_contact_crud_is_audited(admin_a, company_a, api_client_for):
    client = api_client_for(admin_a)

    contact_id = client.post(
        "/api/v1/contacts/",
        {"company": company_a.id, "full_name": "Eve", "email": "eve@example.com"},
        format="json",
    ).json()["data"]["id"]
    client.patch(f"/api/v1/contacts/{contact_id}/", {"role": "CTO"}, format="json")
    client.delete(f"/api/v1/contacts/{contact_id}/")

    logs = ActivityLog.objects.filter(model_name="Contact", object_id=contact_id).order_by("id")
    assert [log.action for log in logs] == ["CREATE", "UPDATE", "DELETE"]


def test_update_without_changes_is_not_logged(manager_a, company_a, api_client_for):
    api_client_for(manager_a).patch(f"/api/v1/companies/{company_a.id}/", {"name": company_a.name}, format="json")
    assert not ActivityLog.objects.exists()


def test_deleting_company_logs_each_contact(admin_a, contact_a, api_client_for):
    api_client_for(admin_a).delete(f"/api/v1/companies/{contact_a.company_id}/")

    actions = set(ActivityLog.objects.values_list("model_name", "action"))
    assert actions == {("Company", "DELETE"), ("Contact", "DELETE")}


def test_failed_requests_are_not_logged(staff_a, company_a, api_client_for):
    api_client_for(staff_a).delete(f"/api/v1/companies/{company_a.id}/")
    assert not ActivityLog.objects.exists()


def test_activity_log_api_filters(admin_a, company_a, api_client_for):
    client = api_client_for(admin_a)
    client.post("/api/v1/companies/", {"name": "Filter Co"}, format="json")
    client.patch(f"/api/v1/companies/{company_a.id}/", {"country": "Spain"}, format="json")

    updates = client.get("/api/v1/activity-logs/?action=UPDATE").json()["data"]
    assert len(updates) == 1
    assert updates[0]["user"]["email"] == admin_a.email

    by_user = client.get(f"/api/v1/activity-logs/?user={admin_a.id}").json()["data"]
    assert len(by_user) == 2


def test_activity_log_is_immutable_and_read_only(admin_a, api_client_for):
    client = api_client_for(admin_a)
    client.post("/api/v1/companies/", {"name": "Immutable Co"}, format="json")
    log = ActivityLog.objects.get()

    with pytest.raises(ValueError):
        log.save()
    with pytest.raises(ValueError):
        log.delete()
    assert client.delete(f"/api/v1/activity-logs/{log.id}/").status_code == 405
    assert client.post("/api/v1/activity-logs/", {}, format="json").status_code == 405
