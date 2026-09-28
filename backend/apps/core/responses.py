from rest_framework import status as http_status
from rest_framework.response import Response


def success_response(data=None, message="Request successful.", status=http_status.HTTP_200_OK, meta=None):
    payload = {"success": True, "message": message, "data": data, "errors": None}
    if meta is not None:
        payload["meta"] = meta
    return Response(payload, status=status)


def error_response(message, errors=None, status=http_status.HTTP_400_BAD_REQUEST):
    return Response({"success": False, "message": message, "data": None, "errors": errors}, status=status)
