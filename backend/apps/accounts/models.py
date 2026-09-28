from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q

from apps.core.constants import Role
from apps.core.models import TimeStampedModel

from .managers import UserManager


class Organization(TimeStampedModel):
    class SubscriptionPlan(models.TextChoices):
        BASIC = "basic", "Basic"
        PRO = "pro", "Pro"

    name = models.CharField(max_length=255, unique=True)
    subscription_plan = models.CharField(
        max_length=20, choices=SubscriptionPlan.choices, default=SubscriptionPlan.BASIC
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class User(AbstractUser):
    email = models.EmailField(unique=True)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="users",
        null=True,
        blank=True,
        help_text="Required for every non-superuser account.",
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STAFF)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        ordering = ["email"]
        constraints = [
            models.CheckConstraint(
                condition=Q(is_superuser=True) | Q(organization__isnull=False),
                name="user_requires_organization_unless_superuser",
            ),
        ]

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        if not self.username:
            self.username = self.email
        super().save(*args, **kwargs)

    @property
    def is_org_admin(self):
        return self.role == Role.ADMIN

    @property
    def is_org_manager(self):
        return self.role == Role.MANAGER
