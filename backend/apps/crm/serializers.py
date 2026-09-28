from rest_framework import serializers

from .models import Company, Contact


class CompanySerializer(serializers.ModelSerializer):
    remove_logo = serializers.BooleanField(write_only=True, required=False, default=False)
    contacts_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "industry",
            "country",
            "logo",
            "remove_logo",
            "contacts_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "contacts_count", "created_at", "updated_at"]
        # Uniqueness is validated in validate_name with a tenant-aware message.
        validators = []

    def get_contacts_count(self, obj):
        annotated = getattr(obj, "contacts_count", None)
        return annotated if annotated is not None else obj.contacts.count()

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Company name cannot be blank.")
        queryset = Company.objects.for_organization(self.context.get("organization")).filter(name__iexact=value)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A company with this name already exists in your organization.")
        return value


class ContactSerializer(serializers.ModelSerializer):
    company = serializers.PrimaryKeyRelatedField(queryset=Company.objects.none())
    company_name = serializers.CharField(source="company.name", read_only=True)

    class Meta:
        model = Contact
        fields = [
            "id",
            "company",
            "company_name",
            "full_name",
            "email",
            "phone",
            "role",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company_name", "created_at", "updated_at"]
        validators = []

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Only companies of the caller's organization are valid choices, so a
        # foreign company id is rejected as "does not exist".
        self.fields["company"].queryset = Company.objects.for_organization(self.context.get("organization"))

    def validate_full_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Full name cannot be blank.")
        return value

    def validate_email(self, value):
        return value.strip().lower()

    def validate_phone(self, value):
        return (value or "").strip()

    def validate(self, attrs):
        company = attrs.get("company", getattr(self.instance, "company", None))
        email = attrs.get("email", getattr(self.instance, "email", None))
        if company and email:
            duplicates = Contact.objects.filter(company=company, email=email)
            if self.instance is not None:
                duplicates = duplicates.exclude(pk=self.instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError(
                    {"email": "A contact with this email already exists in this company."}
                )
        return attrs
