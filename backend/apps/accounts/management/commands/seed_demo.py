from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import Organization, User
from apps.activity.models import ActivityLog
from apps.core.constants import Role
from apps.crm.models import Company, Contact
from apps.crm.services import CompanyService, ContactService

DEMO_PASSWORD = "Demo@12345"

DEMO_DATA = [
    {
        "name": "Acme Travels",
        "plan": Organization.SubscriptionPlan.PRO,
        "domain": "acme.test",
        "companies": [
            ("Skyline Airways", "Aviation", "United Arab Emirates", [
                ("Sara Khan", "sara.khan@skyline.example", "971501234567", "Head of Partnerships"),
                ("Omar Haddad", "omar.haddad@skyline.example", "971509876543", "Sales Manager"),
            ]),
            ("Blue Lagoon Resorts", "Hospitality", "Maldives", [
                ("Aisha Mohamed", "aisha@bluelagoon.example", "9607771234", "Reservations Lead"),
            ]),
            ("Nordic Cruises", "Cruise", "Norway", [
                ("Lars Eriksen", "lars@nordiccruises.example", "4791234567", "Account Director"),
                ("Ingrid Berg", "ingrid@nordiccruises.example", "", "Operations"),
            ]),
            ("Safari Trails", "Tour Operator", "Kenya", []),
        ],
    },
    {
        "name": "Globex Tours",
        "plan": Organization.SubscriptionPlan.BASIC,
        "domain": "globex.test",
        "companies": [
            ("Alpine Lodges", "Hospitality", "Switzerland", [
                ("Marco Rossi", "marco@alpinelodges.example", "41791234567", "General Manager"),
            ]),
            ("Coral Coast Diving", "Tour Operator", "Australia", [
                ("Emma Clarke", "emma@coralcoast.example", "61412345678", "Owner"),
            ]),
        ],
    },
]


class Command(BaseCommand):
    help = "Seed two demo organizations with users for every role, companies and contacts."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete the existing demo organizations and their data first.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        names = [org["name"] for org in DEMO_DATA]
        existing = Organization.objects.filter(name__in=names)
        if existing.exists():
            if not options["reset"]:
                raise CommandError("Demo data already exists. Re-run with --reset to recreate it.")
            self._delete(existing)

        for spec in DEMO_DATA:
            self._seed_organization(spec)

        self.stdout.write(self.style.SUCCESS("Demo data created."))
        self.stdout.write(f"All demo users share the password: {DEMO_PASSWORD}")
        for spec in DEMO_DATA:
            self.stdout.write(f"  {spec['name']}: " + ", ".join(f"{r}@{spec['domain']}" for r in Role.values))

    def _delete(self, organizations):
        ActivityLog.objects.filter(organization__in=organizations)._raw_delete(ActivityLog.objects.db)
        for company in Company.all_objects.filter(organization__in=organizations):
            if company.logo:
                company.logo.delete(save=False)
        Contact.all_objects.filter(organization__in=organizations).delete()
        Company.all_objects.filter(organization__in=organizations).delete()
        User.objects.filter(organization__in=organizations).delete()
        organizations.delete()

    def _seed_organization(self, spec):
        organization = Organization.objects.create(name=spec["name"], subscription_plan=spec["plan"])
        users = {
            role: User.objects.create_user(
                email=f"{role}@{spec['domain']}",
                password=DEMO_PASSWORD,
                first_name=role.capitalize(),
                last_name=spec["name"].split()[0],
                organization=organization,
                role=role,
            )
            for role in Role.values
        }

        creator = users[Role.MANAGER]
        for name, industry, country, contacts in spec["companies"]:
            company = CompanyService.create(
                user=creator,
                organization=organization,
                data={"name": name, "industry": industry, "country": country},
            )
            for full_name, email, phone, job_title in contacts:
                ContactService.create(
                    user=users[Role.STAFF],
                    organization=organization,
                    data={"company": company, "full_name": full_name, "email": email, "phone": phone, "role": job_title},
                )
