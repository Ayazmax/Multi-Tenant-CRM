from .base import *  # noqa: F401,F403
from .base import REST_FRAMEWORK, env

DEBUG = env.bool("DJANGO_DEBUG", default=True)

ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:5173", "http://127.0.0.1:5173"],
)

REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_RENDERER_CLASSES": (
        *REST_FRAMEWORK.get(
            "DEFAULT_RENDERER_CLASSES", ("rest_framework.renderers.JSONRenderer",)
        ),
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
}
