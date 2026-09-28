"""Version 1 of the public API, mounted at ``/api/v1/``."""

from django.urls import include, path
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny

from apps.core.responses import success_response


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    return success_response(data={"status": "ok"})


urlpatterns = [
    path("health/", health, name="health"),
    path("", include("apps.accounts.urls")),
]
