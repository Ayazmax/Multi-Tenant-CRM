from .tenancy import reset_current_organization, set_current_organization


class TenantMiddleware:
    """
    Establishes the tenant context for each request.

    Session-authenticated users (e.g. Django admin) are bound here. API
    requests authenticate via JWT inside DRF, so ``TenantJWTAuthentication``
    binds the tenant once the token is validated. The context is always
    cleared when the request finishes so it can never leak between requests.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        organization = None
        if user is not None and user.is_authenticated:
            organization = getattr(user, "organization", None)

        request.organization = organization
        token = set_current_organization(organization)
        try:
            return self.get_response(request)
        finally:
            reset_current_organization(token)
