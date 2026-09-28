import os
import tempfile

os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-secret-key-not-for-production-use-0123456789")
os.environ.setdefault("USE_S3", "False")

from .base import *  # noqa: E402,F401,F403
from .base import REST_FRAMEWORK  # noqa: E402

DEBUG = False
ALLOWED_HOSTS = ["testserver", "localhost"]

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

MEDIA_ROOT = tempfile.mkdtemp(prefix="crm-test-media-")

REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {"auth": "1000/minute"},
}
