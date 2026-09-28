from .models import ActivityLog


class ActivityLogService:
    @staticmethod
    def log(*, user, action, instance, changes=None):
        return ActivityLog.objects.create(
            organization_id=instance.organization_id,
            user=user if user and user.is_authenticated else None,
            user_email=getattr(user, "email", "") or "",
            action=action,
            model_name=instance.__class__.__name__,
            object_id=instance.pk,
            object_repr=str(instance)[:255],
            changes=changes or {},
        )


class AuditedServiceMixin:
    """Records an activity log entry for every create, update and delete."""

    @classmethod
    def after_create(cls, *, user, instance):
        super().after_create(user=user, instance=instance)
        ActivityLogService.log(user=user, action=ActivityLog.Action.CREATE, instance=instance)

    @classmethod
    def after_update(cls, *, user, instance, changes):
        super().after_update(user=user, instance=instance, changes=changes)
        ActivityLogService.log(user=user, action=ActivityLog.Action.UPDATE, instance=instance, changes=changes)

    @classmethod
    def after_delete(cls, *, user, instance):
        super().after_delete(user=user, instance=instance)
        ActivityLogService.log(user=user, action=ActivityLog.Action.DELETE, instance=instance)
