import django_filters

from .models import Company, Contact


class CompanyFilter(django_filters.FilterSet):
    industry = django_filters.CharFilter(lookup_expr="iexact")
    country = django_filters.CharFilter(lookup_expr="iexact")
    has_logo = django_filters.BooleanFilter(method="filter_has_logo")
    created_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    created_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = Company
        fields = ["industry", "country"]

    def filter_has_logo(self, queryset, name, value):
        with_logo = queryset.exclude(logo__isnull=True).exclude(logo="")
        return with_logo if value else queryset.exclude(pk__in=with_logo.values("pk"))


class ContactFilter(django_filters.FilterSet):
    # Plain ID filter so a foreign company id yields an empty result, not an error.
    company = django_filters.NumberFilter(field_name="company_id")
    role = django_filters.CharFilter(lookup_expr="icontains")
    created_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    created_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = Contact
        fields = ["company", "role"]
