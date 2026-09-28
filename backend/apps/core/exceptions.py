import logging

from django.conf import settings
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.serializers import as_serializer_error
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def _normalize(exc):
    if isinstance(exc, DjangoValidationError):
        return exceptions.ValidationError(as_serializer_error(exc))
    if isinstance(exc, Http404):
        return exceptions.NotFound()
    if isinstance(exc, DjangoPermissionDenied):
        return exceptions.PermissionDenied()
    return exc


def custom_exception_handler(exc, context):
    exc = _normalize(exc)
    response = drf_exception_handler(exc, context)

    if response is None:
        if settings.DEBUG:
            return None
        logger.exception("Unhandled API exception", exc_info=exc)
        return Response(
            {"success": False, "message": "An unexpected error occurred.", "data": None, "errors": None},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    data = response.data
    if isinstance(exc, exceptions.ValidationError):
        message = "Validation failed."
        errors = data if isinstance(data, dict) else {"non_field_errors": data}
    elif isinstance(data, dict):
        message = str(data.get("detail", "Request failed."))
        extra = {k: v for k, v in data.items() if k != "detail"}
        errors = extra or None
    else:
        message = "Request failed."
        errors = data

    response.data = {"success": False, "message": message, "data": None, "errors": errors}
    return response
