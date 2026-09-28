from django.contrib import admin

from .models import Company, Contact


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ["name", "organization", "industry", "country", "is_deleted", "created_at"]
    list_filter = ["organization", "is_deleted", "industry"]
    search_fields = ["name", "industry", "country"]
    list_select_related = ["organization"]

    def get_queryset(self, request):
        return Company.all_objects.select_related("organization")


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ["full_name", "email", "company", "organization", "is_deleted", "created_at"]
    list_filter = ["organization", "is_deleted"]
    search_fields = ["full_name", "email", "company__name"]
    list_select_related = ["company", "organization"]

    def get_queryset(self, request):
        return Contact.all_objects.select_related("company", "organization")
