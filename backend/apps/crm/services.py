from django.db import transaction

from apps.activity.services import AuditedServiceMixin
from apps.core.services import TenantModelService

from .models import Company, Contact


class ContactService(AuditedServiceMixin, TenantModelService):
    model = Contact


class CompanyService(AuditedServiceMixin, TenantModelService):
    model = Company

    @classmethod
    def create(cls, *, user, organization, data):
        data = {k: v for k, v in data.items() if k != "remove_logo"}
        return super().create(user=user, organization=organization, data=data)

    @classmethod
    @transaction.atomic
    def update(cls, *, user, instance, data):
        data = dict(data)
        remove_logo = data.pop("remove_logo", False)
        if remove_logo and "logo" not in data:
            data["logo"] = None

        previous_logo = instance.logo.name if instance.logo else None
        instance = super().update(user=user, instance=instance, data=data)

        current_logo = instance.logo.name if instance.logo else None
        if previous_logo and previous_logo != current_logo:
            storage = instance.logo.storage
            transaction.on_commit(lambda: storage.delete(previous_logo))
        return instance

    @classmethod
    @transaction.atomic
    def delete(cls, *, user, instance):
        # Soft-delete child contacts individually so each gets its own audit entry.
        for contact in instance.contacts.all():
            ContactService.delete(user=user, instance=contact)
        super().delete(user=user, instance=instance)
