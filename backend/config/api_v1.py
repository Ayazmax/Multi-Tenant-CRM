"""Version 1 of the public API, mounted at ``/api/v1/``."""

from django.urls import include, path
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.routers import DefaultRouter

from apps.activity.views import ActivityLogViewSet
from apps.core.responses import success_response
from apps.crm.views import CompanyViewSet, ContactViewSet

router = DefaultRouter()
router.include_root_view = False
router.register("companies", CompanyViewSet, basename="company")
router.register("contacts", ContactViewSet, basename="contact")
router.register("activity-logs", ActivityLogViewSet, basename="activity-log")


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    return success_response(data={"status": "ok"})


urlpatterns = [
    path("health/", health, name="health"),
    path("", include("apps.accounts.urls")),
    path("", include(router.urls)),
]
