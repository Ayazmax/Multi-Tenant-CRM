from rest_framework.renderers import JSONRenderer

DEFAULT_MESSAGES = {
    200: "Request successful.",
    201: "Created successfully.",
}


class StandardJSONRenderer(JSONRenderer):
    """
    Wraps every JSON response in a consistent envelope::

        {"success": bool, "message": str, "data": ..., "errors": ..., "meta": {...}}

    Responses already in envelope form (built by ``success_response``, the
    paginator or the exception handler) are passed through untouched.
    """

    def render(self, data, accepted_media_type=None, renderer_context=None):
        response = (renderer_context or {}).get("response")
        if response is None or data is None:
            return super().render(data, accepted_media_type, renderer_context)

        if not (isinstance(data, dict) and "success" in data):
            is_success = response.status_code < 400
            data = {
                "success": is_success,
                "message": DEFAULT_MESSAGES.get(response.status_code, "Request successful." if is_success else "Request failed."),
                "data": data if is_success else None,
                "errors": None if is_success else data,
            }
        return super().render(data, accepted_media_type, renderer_context)
