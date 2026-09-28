from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from .tenancy import set_current_organization


class TenantJWTAuthentication(JWTAuthentication):
    """JWT authentication that also binds the user's organization to the request."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, validated_token = result
        if user.organization_id is None:
            raise AuthenticationFailed("User is not assigned to an organization.")

        organization = user.organization
        request._request.organization = organization
        set_current_organization(organization)
        return user, validated_token
