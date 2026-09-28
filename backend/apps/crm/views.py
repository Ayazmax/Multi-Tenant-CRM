from django.db.models import Count, Q
from rest_framework.decorators import action

from apps.core.constants import ALL_ROLES
from apps.core.permissions import DEFAULT_ROLE_PERMISSIONS
from apps.core.responses import success_response
from apps.core.viewsets import TenantModelViewSet

from .filters import CompanyFilter, ContactFilter
from .models import Company, Contact
from .serializers import CompanySerializer, ContactSerializer
from .services import CompanyService, ContactService


class CompanyViewSet(TenantModelViewSet):
    """
    Companies of the current organization.

    Staff: read + create. Manager: + update. Admin: + delete (soft).
    """

    queryset = Company.objects.annotate(
        contacts_count=Count("contacts", filter=Q(contacts__is_deleted=False))
    )
    serializer_class = CompanySerializer
    service_class = CompanyService
    filterset_class = CompanyFilter
    search_fields = ["name", "industry", "country"]
    ordering_fields = ["name", "industry", "country", "created_at", "contacts_count"]
    ordering = ["-created_at"]
    role_permissions = {**DEFAULT_ROLE_PERMISSIONS, "filter_options": ALL_ROLES}

    @action(detail=False, methods=["get"], url_path="filter-options")
    def filter_options(self, request):
        companies = Company.objects.for_organization(self.get_organization())

        def distinct(field):
            return list(
                companies.exclude(**{field: ""}).order_by(field).values_list(field, flat=True).distinct()
            )

        return success_response(data={"industries": distinct("industry"), "countries": distinct("country")})


class ContactViewSet(TenantModelViewSet):
    """Contacts of the current organization. Filter by company with ``?company=<id>``."""

    queryset = Contact.objects.select_related("company").filter(company__is_deleted=False)
    serializer_class = ContactSerializer
    service_class = ContactService
    filterset_class = ContactFilter
    search_fields = ["full_name", "email", "phone", "role", "company__name"]
    ordering_fields = ["full_name", "email", "role", "created_at", "company__name"]
    ordering = ["full_name"]
