import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.crm.models import Company

pytestmark = pytest.mark.django_db

URL = "/api/v1/companies/"


def test_soft_delete_hides_company_but_keeps_row(admin_a, company_a, api_client_for):
    client = api_client_for(admin_a)

    response = client.delete(f"{URL}{company_a.id}/")

    assert response.status_code == 200
    assert response.json()["message"] == "Company deleted successfully."
    assert client.get(f"{URL}{company_a.id}/").status_code == 404
    assert client.get(URL).json()["data"] == []
    row = Company.all_objects.get(pk=company_a.id)
    assert row.is_deleted is True and row.deleted_at is not None


def test_pagination_metadata(admin_a, org_a, api_client_for):
    Company.objects.bulk_create(Company(organization=org_a, name=f"Company {i:02}") for i in range(15))

    body = api_client_for(admin_a).get(f"{URL}?page=2&page_size=10").json()

    assert body["success"] is True
    assert len(body["data"]) == 5
    assert body["meta"]["pagination"] == {
        "count": 15,
        "page": 2,
        "page_size": 10,
        "total_pages": 2,
        "next": None,
        "previous": body["meta"]["pagination"]["previous"],
    }
    assert body["meta"]["pagination"]["previous"] is not None


def test_search_filter_and_ordering(admin_a, org_a, api_client_for):
    Company.objects.create(organization=org_a, name="Sky Air", industry="Aviation", country="UAE")
    Company.objects.create(organization=org_a, name="Sea Cruise", industry="Cruise", country="Norway")
    Company.objects.create(organization=org_a, name="Sky Hotels", industry="Hospitality", country="UAE")
    client = api_client_for(admin_a)

    assert {c["name"] for c in client.get(f"{URL}?search=sky").json()["data"]} == {"Sky Air", "Sky Hotels"}
    assert [c["name"] for c in client.get(f"{URL}?industry=cruise").json()["data"]] == ["Sea Cruise"]
    ordered = [c["name"] for c in client.get(f"{URL}?country=UAE&ordering=name").json()["data"]]
    assert ordered == ["Sky Air", "Sky Hotels"]


def test_duplicate_company_name_is_rejected_case_insensitively(admin_a, company_a, api_client_for):
    response = api_client_for(admin_a).post(URL, {"name": company_a.name.upper()}, format="json")

    assert response.status_code == 400
    assert "name" in response.json()["errors"]


def test_contacts_count_excludes_deleted_contacts(admin_a, contact_a, api_client_for):
    client = api_client_for(admin_a)
    assert client.get(f"{URL}{contact_a.company_id}/").json()["data"]["contacts_count"] == 1

    client.delete(f"/api/v1/contacts/{contact_a.id}/")
    assert client.get(f"{URL}{contact_a.company_id}/").json()["data"]["contacts_count"] == 0


def test_logo_upload_uses_tenant_prefixed_key(admin_a, image_file, api_client_for):
    response = api_client_for(admin_a).post(URL, {"name": "Logo Co", "logo": image_file()}, format="multipart")

    assert response.status_code == 201
    company = Company.objects.get(pk=response.json()["data"]["id"])
    assert company.logo.name.startswith(f"org_{admin_a.organization_id}/logos/")
    assert response.json()["data"]["logo"].endswith(company.logo.name)


def test_logo_rejects_non_images(admin_a, api_client_for):
    fake = SimpleUploadedFile("logo.png", b"definitely not an image", content_type="image/png")
    response = api_client_for(admin_a).post(URL, {"name": "Bad Logo", "logo": fake}, format="multipart")

    assert response.status_code == 400
    assert "logo" in response.json()["errors"]


def test_logo_size_limit(admin_a, image_file, api_client_for, settings):
    settings.MAX_IMAGE_UPLOAD_SIZE = 100
    response = api_client_for(admin_a).post(
        URL, {"name": "Big Logo", "logo": image_file(size=(200, 200))}, format="multipart"
    )

    assert response.status_code == 400
    assert "logo" in response.json()["errors"]


def test_remove_logo(manager_a, image_file, api_client_for):
    client = api_client_for(manager_a)
    company_id = client.post(URL, {"name": "Logo Co", "logo": image_file()}, format="multipart").json()["data"]["id"]

    response = client.patch(f"{URL}{company_id}/", {"remove_logo": True}, format="multipart")

    assert response.status_code == 200
    assert response.json()["data"]["logo"] is None


def test_filter_options(admin_a, company_a, company_b, api_client_for):
    data = api_client_for(admin_a).get(f"{URL}filter-options/").json()["data"]
    assert data == {"industries": ["Travel"], "countries": ["UK"]}
