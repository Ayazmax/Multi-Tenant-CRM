from django.urls import path

from .views import LoginView, LogoutView, MeView, OrganizationMembersView, RefreshView

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("users/", OrganizationMembersView.as_view(), name="organization-members"),
]
