from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenBlacklistView, TokenObtainPairView, TokenRefreshView

from apps.core.constants import EDITOR_ROLES
from apps.core.permissions import IsOrganizationMember, RoleBasedPermission
from apps.core.responses import success_response

from .models import User
from .serializers import LoginSerializer, OrganizationMemberSerializer, UserSerializer


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        return success_response(data=response.data, message="Login successful.")


class RefreshView(TokenRefreshView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class LogoutView(TokenBlacklistView):
    """Blacklists the supplied refresh token."""

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        super().post(request, *args, **kwargs)
        return success_response(message="Logged out successfully.")


class MeView(APIView):
    permission_classes = [IsAuthenticated, IsOrganizationMember]

    def get(self, request):
        return success_response(data=UserSerializer(request.user).data)


class OrganizationMembersView(ListAPIView):
    """Members of the current user's organization (used for activity filters)."""

    serializer_class = OrganizationMemberSerializer
    permission_classes = [IsAuthenticated, IsOrganizationMember, RoleBasedPermission]
    role_permissions = {"get": EDITOR_ROLES}
    pagination_class = None
    filter_backends = []

    def get_queryset(self):
        return User.objects.filter(organization_id=self.request.user.organization_id).order_by("email")
