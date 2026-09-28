from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator

phone_validator = RegexValidator(
    regex=r"^\d{8,15}$",
    message="Phone number must contain only digits and be 8 to 15 digits long.",
)


def validate_image_size(file):
    max_size = settings.MAX_IMAGE_UPLOAD_SIZE
    if file.size > max_size:
        raise ValidationError(f"Image file too large. Maximum size is {max_size // (1024 * 1024)} MB.")
