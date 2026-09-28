from apps.core.constants import EDITOR_ROLES
from apps.core.viewsets import TenantReadOnlyViewSet

from .filters import ActivityLogFilter
from .models import ActivityLog
from .serializers import ActivityLogSerializer


class ActivityLogViewSet(TenantReadOnlyViewSet):
    queryset = ActivityLog.objects.select_related("user")
    serializer_class = ActivityLogSerializer
    filterset_class = ActivityLogFilter
    search_fields = ["object_repr", "user_email", "model_name"]
    ordering_fields = ["timestamp", "action", "model_name"]
    role_permissions = {"list": EDITOR_ROLES, "retrieve": EDITOR_ROLES}
