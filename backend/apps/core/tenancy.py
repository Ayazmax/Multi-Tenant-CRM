"""Request-scoped tenant context."""

from contextvars import ContextVar

_current_organization = ContextVar("current_organization", default=None)


def get_current_organization():
    return _current_organization.get()


def set_current_organization(organization):
    return _current_organization.set(organization)


def reset_current_organization(token):
    _current_organization.reset(token)
