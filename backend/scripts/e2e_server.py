"""
Start an isolated backend for the Playwright end-to-end suite.

The server uses a dedicated database (``E2E_DATABASE_URL``, or ``DATABASE_URL``
with an ``_e2e`` suffix on the database name), which is created if missing,
migrated and re-seeded with the demo data on every run. The development
database is never touched.

Usage: python scripts/e2e_server.py [port]
"""

import os
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import environ  # noqa: E402
import psycopg  # noqa: E402
from psycopg import sql  # noqa: E402


def _database_name(url):
    return urlsplit(url).path.lstrip("/")


def _with_database(url, name):
    return urlunsplit(urlsplit(url)._replace(path=f"/{name}"))


def resolve_database_url():
    environ.Env.read_env(BASE_DIR / ".env")
    dev_url = environ.Env()("DATABASE_URL")
    e2e_url = os.environ.get("E2E_DATABASE_URL") or _with_database(dev_url, f"{_database_name(dev_url)}_e2e")
    if _database_name(e2e_url) == _database_name(dev_url):
        sys.exit("Refusing to run: the e2e database must differ from the development database.")
    return e2e_url


def ensure_database(url):
    name = _database_name(url)
    with psycopg.connect(_with_database(url, "postgres"), autocommit=True) as connection:
        if not connection.execute("SELECT 1 FROM pg_database WHERE datname = %s", [name]).fetchone():
            connection.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))


def main():
    port = sys.argv[1] if len(sys.argv) > 1 else "8899"
    url = resolve_database_url()
    ensure_database(url)
    os.environ["DATABASE_URL"] = url
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

    import django
    from django.core.management import call_command

    django.setup()
    call_command("migrate", interactive=False, verbosity=0)
    call_command("seed_demo", reset=True)
    call_command("runserver", port, use_reloader=False)


if __name__ == "__main__":
    main()
