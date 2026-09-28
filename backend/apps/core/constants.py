from django.db import models


class Role(models.TextChoices):
    ADMIN = "admin", "Admin"
    MANAGER = "manager", "Manager"
    STAFF = "staff", "Staff"


ALL_ROLES = frozenset(Role.values)
EDITOR_ROLES = frozenset({Role.ADMIN, Role.MANAGER})
ADMIN_ROLES = frozenset({Role.ADMIN})
