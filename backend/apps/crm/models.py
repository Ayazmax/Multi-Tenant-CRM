from pathlib import Path
from uuid import uuid4

from django.core.validators import FileExtensionValidator
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from apps.core.models import TenantModel
from apps.core.validators import phone_validator, validate_image_size

ALLOWED_LOGO_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]


def company_logo_upload_to(instance, filename):
    """Tenant-prefixed, unguessable object key: ``org_<id>/logos/<uuid>.<ext>``."""
    extension = Path(filename).suffix.lower()
    return f"org_{instance.organization_id}/logos/{uuid4().hex}{extension}"


class Company(TenantModel):
    name = models.CharField(max_length=255)
    industry = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    logo = models.ImageField(
        upload_to=company_logo_upload_to,
        blank=True,
        null=True,
        validators=[FileExtensionValidator(ALLOWED_LOGO_EXTENSIONS), validate_image_size],
    )

    class Meta:
        verbose_name_plural = "companies"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "organization",
                condition=Q(is_deleted=False),
                name="unique_active_company_name_per_org",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "is_deleted", "-created_at"], name="company_org_active_idx"),
        ]

    def __str__(self):
        return self.name


class Contact(TenantModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="contacts")
    full_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=15, blank=True, validators=[phone_validator])
    role = models.CharField(max_length=100, blank=True, help_text="Job title within the company.")

    class Meta:
        ordering = ["full_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "email"],
                condition=Q(is_deleted=False),
                name="unique_active_contact_email_per_company",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "is_deleted", "company"], name="contact_org_company_idx"),
        ]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)
