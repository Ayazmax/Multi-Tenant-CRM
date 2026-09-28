from django.conf import settings
from django.db import models

from apps.core.models import TenantQuerySet


class ActivityLog(models.Model):
    """Immutable audit record of a create/update/delete on a tenant resource."""

    class Action(models.TextChoices):
        CREATE = "CREATE", "Create"
        UPDATE = "UPDATE", "Update"
        DELETE = "DELETE", "Delete"

    organization = models.ForeignKey(
        "accounts.Organization", on_delete=models.CASCADE, related_name="activity_logs"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="activity_logs",
    )
    # Snapshot so the log stays meaningful if the user is later removed.
    user_email = models.EmailField(blank=True)
    action = models.CharField(max_length=10, choices=Action.choices)
    model_name = models.CharField(max_length=50)
    object_id = models.PositiveBigIntegerField()
    object_repr = models.CharField(max_length=255, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    objects = models.Manager.from_queryset(TenantQuerySet)()

    class Meta:
        ordering = ["-timestamp", "-id"]
        indexes = [
            models.Index(fields=["organization", "-timestamp"], name="activity_org_time_idx"),
            models.Index(fields=["organization", "model_name", "object_id"], name="activity_org_object_idx"),
        ]

    def __str__(self):
        return f"{self.action} {self.model_name}#{self.object_id} by {self.user_email or 'system'}"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValueError("Activity log entries are immutable.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Activity log entries cannot be deleted.")
