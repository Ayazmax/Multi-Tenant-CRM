from django.contrib import admin

from .models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ["timestamp", "organization", "user_email", "action", "model_name", "object_id", "object_repr"]
    list_filter = ["organization", "action", "model_name"]
    search_fields = ["object_repr", "user_email"]
    list_select_related = ["organization"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
