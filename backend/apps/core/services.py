from django.db import models, transaction


def serialize_value(value):
    if isinstance(value, models.Model):
        return value.pk
    if hasattr(value, "name") and hasattr(value, "storage"):
        return value.name or None
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


class TenantModelService:
    """
    Business-logic layer for tenant-owned models.

    Views never write models directly: they hand validated data to a service,
    which is the single place where organization ownership is assigned and
    side effects (auditing, file cleanup) happen. Subclasses override the
    ``after_*`` hooks.
    """

    model = None

    @classmethod
    @transaction.atomic
    def create(cls, *, user, organization, data):
        instance = cls.model(organization=organization, **data)
        instance.save()
        cls.after_create(user=user, instance=instance)
        return instance

    @classmethod
    @transaction.atomic
    def update(cls, *, user, instance, data):
        changes = {}
        for field, new_value in data.items():
            old_value = getattr(instance, field)
            if serialize_value(old_value) != serialize_value(new_value) or hasattr(new_value, "read"):
                changes[field] = {"from": serialize_value(old_value), "to": serialize_value(new_value)}
                setattr(instance, field, new_value)

        if changes:
            instance.save()
            for field, change in changes.items():
                change["to"] = serialize_value(getattr(instance, field))
            cls.after_update(user=user, instance=instance, changes=changes)
        return instance

    @classmethod
    @transaction.atomic
    def delete(cls, *, user, instance):
        instance.soft_delete()
        cls.after_delete(user=user, instance=instance)

    @classmethod
    def after_create(cls, *, user, instance):
        pass

    @classmethod
    def after_update(cls, *, user, instance, changes):
        pass

    @classmethod
    def after_delete(cls, *, user, instance):
        pass
