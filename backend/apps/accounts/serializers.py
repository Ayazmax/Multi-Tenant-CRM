from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Organization, User


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name", "subscription_plan", "created_at"]
        read_only_fields = fields


class UserSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "full_name", "role", "organization"]
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.email


class OrganizationMemberSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "is_active", "date_joined"]
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.email


class LoginSerializer(TokenObtainPairSerializer):
    """Issues JWTs carrying tenant/role claims and returns the user profile."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Passwords may legitimately start or end with spaces.
        self.fields["password"].trim_whitespace = False

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["organization_id"] = user.organization_id
        token["role"] = user.role
        return token

    def validate(self, attrs):
        attrs[self.username_field] = attrs.get(self.username_field, "").strip().lower()
        data = super().validate(attrs)
        if self.user.organization_id is None:
            raise AuthenticationFailed("This account is not assigned to an organization.")
        data["user"] = UserSerializer(self.user).data
        return data
