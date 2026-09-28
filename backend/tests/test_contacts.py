import pytest

from apps.crm.models import Company, Contact

pytestmark = pytest.mark.django_db

URL = "/api/v1/contacts/"


def payload(company, **overrides):
    data = {"company": company.id, "full_name": "Carol White", "email": "carol@example.com", "phone": "98765432"}
    data.update(overrides)
    return data


def test_create_contact_normalizes_email(staff_a, company_a, api_client_for):
    response = api_client_for(staff_a).post(URL, payload(company_a, email="  Carol@Example.COM "), format="json")

    assert response.status_code == 201
    assert response.json()["data"]["email"] == "carol@example.com"
    assert response.json()["data"]["company_name"] == company_a.name


@pytest.mark.parametrize("email", ["not-an-email", "a@b", "@example.com", ""])
def test_invalid_email_is_rejected(email, staff_a, company_a, api_client_for):
    response = api_client_for(staff_a).post(URL, payload(company_a, email=email), format="json")

    assert response.status_code == 400
    assert "email" in response.json()["errors"]


def test_email_must_be_unique_within_company(staff_a, contact_a, api_client_for):
    response = api_client_for(staff_a).post(
        URL, payload(contact_a.company, email=contact_a.email.upper()), format="json"
    )

    assert response.status_code == 400
    assert response.json()["errors"]["email"] == ["A contact with this email already exists in this company."]


def test_same_email_allowed_in_another_company(staff_a, contact_a, org_a, api_client_for):
    other = Company.objects.create(organization=org_a, name="Other Co")
    response = api_client_for(staff_a).post(URL, payload(other, email=contact_a.email), format="json")
    assert response.status_code == 201


def test_email_can_be_reused_after_soft_delete(admin_a, contact_a, api_client_for):
    client = api_client_for(admin_a)
    assert client.delete(f"{URL}{contact_a.id}/").status_code == 200

    response = client.post(URL, payload(contact_a.company, email=contact_a.email), format="json")
    assert response.status_code == 201


def test_update_to_duplicate_email_is_rejected(manager_a, contact_a, api_client_for):
    other = Contact.objects.create(
        organization=contact_a.organization, company=contact_a.company, full_name="Dan", email="dan@example.com"
    )
    response = api_client_for(manager_a).patch(f"{URL}{other.id}/", {"email": contact_a.email}, format="json")
    assert response.status_code == 400


@pytest.mark.parametrize("phone", ["", "12345678", "123456789012345"])
def test_valid_phone_numbers(phone, staff_a, company_a, api_client_for):
    response = api_client_for(staff_a).post(URL, payload(company_a, phone=phone), format="json")
    assert response.status_code == 201


@pytest.mark.parametrize("phone", ["1234567", "1234567890123456", "12345abc", "+1234567890", "123 456 789"])
def test_invalid_phone_numbers(phone, staff_a, company_a, api_client_for):
    response = api_client_for(staff_a).post(URL, payload(company_a, phone=phone), format="json")

    assert response.status_code == 400
    assert "phone" in response.json()["errors"]


def test_phone_is_optional(staff_a, company_a, api_client_for):
    data = payload(company_a)
    del data["phone"]
    assert api_client_for(staff_a).post(URL, data, format="json").status_code == 201


def test_filter_contacts_by_company_and_search(staff_a, contact_a, org_a, api_client_for):
    other = Company.objects.create(organization=org_a, name="Other Co")
    Contact.objects.create(organization=org_a, company=other, full_name="Zed", email="zed@example.com")
    client = api_client_for(staff_a)

    by_company = client.get(f"{URL}?company={contact_a.company_id}").json()["data"]
    assert [c["id"] for c in by_company] == [contact_a.id]

    by_search = client.get(f"{URL}?search=zed").json()["data"]
    assert [c["full_name"] for c in by_search] == ["Zed"]


def test_contacts_of_deleted_company_are_hidden(admin_a, contact_a, api_client_for):
    client = api_client_for(admin_a)
    client.delete(f"/api/v1/companies/{contact_a.company_id}/")

    assert client.get(URL).json()["data"] == []
    contact_a.refresh_from_db()
    assert contact_a.is_deleted is True
