from rest_framework import serializers

from .models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = [
            "id",
            "user",
            "action",
            "model_name",
            "object_id",
            "object_repr",
            "changes",
            "timestamp",
        ]
        read_only_fields = fields

    def get_user(self, obj):
        if obj.user is None:
            return {"id": None, "email": obj.user_email, "full_name": obj.user_email or "Deleted user"}
        return {
            "id": obj.user_id,
            "email": obj.user.email,
            "full_name": obj.user.get_full_name() or obj.user.email,
        }
