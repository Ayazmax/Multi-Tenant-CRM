import django_filters

from .models import ActivityLog


class ActivityLogFilter(django_filters.FilterSet):
    model_name = django_filters.CharFilter(lookup_expr="iexact")
    # Plain ID filter: a model-choice filter would validate against all users
    # and reveal whether an ID exists in another organization.
    user = django_filters.NumberFilter(field_name="user_id")
    date_from = django_filters.DateFilter(field_name="timestamp", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="timestamp", lookup_expr="date__lte")

    class Meta:
        model = ActivityLog
        fields = ["action", "model_name", "object_id"]
