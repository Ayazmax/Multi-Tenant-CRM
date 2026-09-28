from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from .permissions import IsOrganizationMember, RoleBasedPermission
from .responses import success_response


class TenantScopedMixin:
    """
    Restricts every queryset to the authenticated user's organization.

    Objects from other organizations are simply not found (404), so their
    existence is never revealed.
    """

    permission_classes = [IsAuthenticated, IsOrganizationMember, RoleBasedPermission]

    def get_organization(self):
        organization = getattr(self.request, "organization", None) or getattr(
            self.request.user, "organization", None
        )
        if organization is None:
            raise PermissionDenied("No organization context for this request.")
        return organization

    def get_queryset(self):
        return super().get_queryset().for_organization(self.get_organization())

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request and self.request.user.is_authenticated:
            context["organization"] = self.get_organization()
        return context


class TenantReadOnlyViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    pass


class TenantModelViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """CRUD viewset that delegates all writes to ``service_class``."""

    service_class = None

    def perform_create(self, serializer):
        serializer.instance = self.service_class.create(
            user=self.request.user,
            organization=self.get_organization(),
            data=serializer.validated_data,
        )

    def perform_update(self, serializer):
        serializer.instance = self.service_class.update(
            user=self.request.user,
            instance=serializer.instance,
            data=serializer.validated_data,
        )

    def perform_destroy(self, instance):
        self.service_class.delete(user=self.request.user, instance=instance)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        name = instance._meta.verbose_name.capitalize()
        return success_response(message=f"{name} deleted successfully.")
