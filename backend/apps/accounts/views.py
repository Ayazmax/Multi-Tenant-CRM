from datetime import timedelta

from django.db.models import Count
from django.utils import timezone
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenBlacklistView, TokenObtainPairView, TokenRefreshView

from apps.activity.models import ActivityLog
from apps.activity.serializers import ActivityLogSerializer
from apps.core.constants import EDITOR_ROLES
from apps.core.permissions import IsOrganizationMember, RoleBasedPermission
from apps.core.responses import success_response
from apps.crm.models import Company, Contact

from .models import User
from .serializers import LoginSerializer, OrganizationMemberSerializer, OrganizationSerializer, UserSerializer


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


class DashboardView(APIView):
    """Organization overview. Recent activity is only included for Admin/Manager."""

    permission_classes = [IsAuthenticated, IsOrganizationMember]

    def get(self, request):
        organization = request.organization or request.user.organization
        companies = Company.objects.for_organization(organization)
        contacts = Contact.objects.for_organization(organization).filter(company__is_deleted=False)
        members = User.objects.filter(organization=organization, is_active=True)

        role_counts = {
            row["role"]: row["total"] for row in members.order_by().values("role").annotate(total=Count("id"))
        }
        top_industries = list(
            companies.exclude(industry="")
            .values("industry")
            .annotate(total=Count("id"))
            .order_by("-total", "industry")[:5]
        )
        recent_companies = list(
            companies.order_by("-created_at").values("id", "name", "industry", "country", "created_at")[:5]
        )

        data = {
            "organization": OrganizationSerializer(organization).data,
            "stats": {
                "companies": companies.count(),
                "contacts": contacts.count(),
                "team_members": members.count(),
            },
            "team_by_role": role_counts,
            "top_industries": top_industries,
            "recent_companies": recent_companies,
            "recent_activity": None,
        }

        if request.user.role in EDITOR_ROLES:
            logs = ActivityLog.objects.for_organization(organization).select_related("user")
            week_ago = timezone.now() - timedelta(days=7)
            data["stats"]["activity_last_7_days"] = logs.filter(timestamp__gte=week_ago).count()
            data["recent_activity"] = ActivityLogSerializer(logs[:8], many=True).data

        return success_response(data=data)
