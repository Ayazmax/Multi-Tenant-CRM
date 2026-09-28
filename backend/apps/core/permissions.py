from rest_framework.permissions import BasePermission

from .constants import ADMIN_ROLES, ALL_ROLES, EDITOR_ROLES

DEFAULT_ROLE_PERMISSIONS = {
    "list": ALL_ROLES,
    "retrieve": ALL_ROLES,
    "create": ALL_ROLES,
    "update": EDITOR_ROLES,
    "partial_update": EDITOR_ROLES,
    "destroy": ADMIN_ROLES,
}


class IsOrganizationMember(BasePermission):
    """The user must belong to an organization, and objects must belong to it too."""

    message = "You do not have access to this organization's data."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.organization_id)

    def has_object_permission(self, request, view, obj):
        return getattr(obj, "organization_id", None) == request.user.organization_id


class RoleBasedPermission(BasePermission):
    """
    Authorizes each viewset action against the user's role.

    Views may override the matrix with a ``role_permissions`` mapping of
    ``action -> allowed roles``. Actions missing from the matrix are denied.
    """

    message = "Your role does not allow this action."

    def has_permission(self, request, view):
        action = getattr(view, "action", None)
        if action is None:
            action = request.method.lower()
        matrix = getattr(view, "role_permissions", DEFAULT_ROLE_PERMISSIONS)
        allowed_roles = matrix.get(action)
        if allowed_roles is None:
            return False
        return getattr(request.user, "role", None) in allowed_roles
