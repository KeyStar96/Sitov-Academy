#!/usr/bin/env python3
"""Real PostgREST regression tests, exclusively against the disposable VPS clone.

Run on the VPS, after applying the canonical migrations to the validation clone:
    python3 canonical-rest.py

Requires Python 3.9+, Docker and the three explicitly named clone containers.
No application environment, GoTrue login, production endpoint, or mail worker is
used. JWTs come from the clone REST container and never leave this process. The
REST endpoint must read back a fresh SQL-only clone identity before any REST
mutation is allowed. Extra QA courses are removed in finally; all other fixtures
stay in the disposable clone for diagnosis. Only aggregate results are printed.
"""

import base64
import datetime as dt
import hashlib
import hmac
import json
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from zoneinfo import ZoneInfo

DATABASE = "sitov-canonical-validation"
REST_CONTAINER = "sitov-canonical-rest"
REST_URL = "http://127.0.0.1:19080/rest/v1/"
PRIVATE_COURSE = "2d4bf352-4840-4213-8cfc-6a6ed6aa1e1d"
EXPECTED_SLUGS = [
    "deutsch-level-1", "deutsch-level-2", "deutsch-level-3",
    "sprechtraining-montag", "sprechtraining-dienstag", "sprechtraining-mittwoch",
    "deutsch-a1-1-online", "deutsch-b1-online", "privatunterricht-online",
]


def ensure(condition, message):
    if not condition:
        raise AssertionError(message)


def docker_json(name):
    result = subprocess.run(["docker", "inspect", name], capture_output=True, text=True)
    ensure(result.returncode == 0, "Required disposable clone container is missing")
    return json.loads(result.stdout)[0]


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def sql(statement):
    result = subprocess.run(
        ["docker", "exec", "-i", DATABASE, "psql", "-X", "-qAt", "-v",
         "ON_ERROR_STOP=1", "-U", "restore_admin", "-d", "postgres"],
        input=statement, capture_output=True, text=True,
    )
    # Deliberately omit raw SQL/stdout/stderr from errors and public reports.
    ensure(result.returncode == 0, "Clone fixture SQL failed")
    return result.stdout.strip()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise AssertionError("Clone REST redirects are forbidden")


class Suite:
    def __init__(self):
        self.checks = []
        self.extra_courses = []
        self.prefix = "qa-canonical-" + uuid.uuid4().hex[:12]
        self.users = {key: str(uuid.uuid4()) for key in ("teacher", "student", "other")}
        self.opener = urllib.request.build_opener(NoRedirect, urllib.request.ProxyHandler({}))
        self.mutations_ready = False
        rest = docker_json(REST_CONTAINER)
        db = docker_json(DATABASE)
        env = dict(item.split("=", 1) for item in rest["Config"]["Env"] if "=" in item)
        ensure(urllib.parse.urlparse(env["PGRST_DB_URI"]).hostname == DATABASE,
               "REST must point exclusively at the disposable database")
        net = "sitov-canonical-validation-net"
        ensure(set(rest["NetworkSettings"]["Networks"]) == {net}
               and set(db["NetworkSettings"]["Networks"]) == {net},
               "Clone containers must use only their isolated network")
        network = json.loads(subprocess.check_output(["docker", "network", "inspect", net]))[0]
        allowed = {DATABASE, REST_CONTAINER, "sitov-canonical-meta", "sitov-canonical-proxy"}
        ensure(all(c["Name"] in allowed for c in network["Containers"].values()),
               "Unexpected service on isolated network; mail workers are forbidden")
        self.secret = env["PGRST_JWT_SECRET"].encode()
        ensure(len(self.secret) >= 32, "Clone JWT secret is unavailable")
        self.tokens = {"anon": self.jwt("anon"), "service": self.jwt("service_role")}
        for name, user_id in self.users.items():
            self.tokens[name] = self.jwt("authenticated", user_id)
        ensure(sql("SELECT current_user") == "restore_admin", "Wrong clone database identity")
        # Refuse to run while any restored network cron job could send mail.
        sql("DO $$ BEGIN IF to_regclass('cron.job') IS NOT NULL THEN "
            "IF EXISTS(SELECT 1 FROM cron.job WHERE active AND jobname<>'sitov-rate-limit-cleanup') THEN "
            "RAISE EXCEPTION 'Active cron jobs'; END IF; END IF; END $$;")

    def jwt(self, role, user_id=None):
        def encoded(obj):
            return base64.urlsafe_b64encode(json.dumps(obj, separators=(",", ":")).encode()).rstrip(b"=")
        claims = {"role": role, "iat": int(time.time()), "exp": int(time.time()) + 3600,
                  "iss": "supabase", "aud": "authenticated"}
        if user_id:
            claims["sub"] = user_id
        body = encoded({"alg": "HS256", "typ": "JWT"}) + b"." + encoded(claims)
        signature = base64.urlsafe_b64encode(hmac.new(self.secret, body, hashlib.sha256).digest()).rstrip(b"=")
        return (body + b"." + signature).decode()

    def request(self, actor, path, method="GET", data=None, expected=200, code=None):
        ensure(method == "GET" or self.mutations_ready, "REST mutation blocked before clone identity proof")
        request = urllib.request.Request(
            REST_URL + path, method=method,
            data=None if data is None else json.dumps(data).encode(),
            headers={"Authorization": "Bearer " + self.tokens[actor], "Content-Type": "application/json",
                     "Prefer": "return=representation"},
        )
        try:
            with self.opener.open(request, timeout=20) as response:
                status, body = response.status, response.read()
        except urllib.error.HTTPError as error:
            status, body = error.code, error.read()
        except (urllib.error.URLError, TimeoutError):
            raise AssertionError("Clone REST transport failed") from None
        result = json.loads(body) if body else None
        actual_code = result.get("code", "") if isinstance(result, dict) else ""
        ensure(status == expected, f"{path.split('?')[0]} expected HTTP {expected}, got {status} ({actual_code})")
        if code:
            ensure(actual_code == code, "Unexpected database error classification")
        return result

    def get(self, actor, table, **query):
        return self.request(actor, table + "?" + urllib.parse.urlencode(query, safe="(),.*:!"))

    def rpc(self, actor, function, payload, expected=200, code=None):
        return self.request(actor, "rpc/" + function, "POST", payload, expected, code)

    def passed(self, label):
        self.checks.append(label)
        print("PASS " + label, flush=True)

    def setup(self):
        for name, user_id in self.users.items():
            locale = "de" if name == "teacher" else "ru"
            metadata = json.dumps({"display_name": self.prefix + " " + name,
                                   "native_language": locale, "ui_language": locale})
            sql("INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES("
                + literal(user_id) + "," + literal(self.prefix + "." + name + "@example.test")
                + ",now()," + literal(metadata) + "::jsonb);")
        sql("UPDATE public.profiles SET role='teacher' WHERE id=" + literal(self.users["teacher"]) + ";")
        # Only a fresh, unpredictable row inserted into THIS Docker DB can pass.
        proof = self.get("service", "profiles", select="id,role,person:people(id,display_name)",
                         id="eq." + self.users["teacher"])
        ensure(len(proof) == 1 and proof[0]["id"] == self.users["teacher"]
               and proof[0]["role"] == "teacher" and isinstance(proof[0]["person"], dict)
               and proof[0]["person"]["display_name"] == self.prefix + " teacher",
               "REST endpoint did not prove it reads this disposable clone")
        self.mutations_ready = True
        self.passed("Isolated clone endpoint, synthetic identity provisioning and real one-to-one join")

    def catalog(self):
        for actor in ("anon", "service"):
            rows = self.get(actor, "courses", select="id,slug,unit_price,unit_minutes,course_schedules(*),course_translations(*)", order="sort_order")
            ensure([row["slug"] for row in rows] == EXPECTED_SLUGS, "Expected nine physical canonical courses")
            private = rows[-1]
            ensure(private["id"] == PRIVATE_COURSE and private["unit_price"] == 25
                   and private["unit_minutes"] == 45 and private["course_schedules"] == [],
                   "Private catalog quantity pricing differs")
            ensure(all(t["locale"] != "de" for row in rows for t in row["course_translations"]),
                   "German source translations are duplicated")
        self.passed("Exactly nine courses, canonical prices and relational schedules/translations via anon and service REST")

    def identity_and_registration(self):
        for name in ("student", "other"):
            claim = self.rpc(name, "claim_verified_person", {})
            ensure(claim["unresolved"] is False, "Verified QA identity was not resolved")
        student = self.get("student", "profiles", select="id,role,person:people(id,display_name,email)",
                           id="eq." + self.users["student"])[0]
        self.person_id = student["person"]["id"]
        ensure(isinstance(student["person"], dict), "Canonical person join must be an object")
        for table, filt in (("profiles", {"id": "eq." + self.users["student"]}),
                            ("people", {"id": "eq." + self.person_id})):
            ensure(self.get("other", table, select="id", **filt) == [], "Another student can read private identity")
        self.request("student", "profiles?id=eq." + self.users["student"], "PATCH", {"role": "teacher"}, 403, "42501")
        self.request("student", "people?id=eq." + self.person_id, "PATCH", {"auth_user_id": self.users["other"]}, 403, "42501")
        self.passed("Verified identity claims, other-student PII isolation and protected role/auth linkage")
        now = dt.datetime.now(ZoneInfo("Europe/Berlin")).date()
        self.month = now.replace(day=1).isoformat()
        self.next_month = (now.replace(day=28) + dt.timedelta(days=4)).replace(day=1).isoformat()
        payload = {"p_contact": {"name": self.prefix + " student", "email": student["person"]["email"]},
                   "p_course_selections": [{"course_id": PRIVATE_COURSE, "requested_units": 4}],
                   "p_start": now.isoformat(), "p_consents": {"privacy": True, "agb": True},
                   "p_locale": "ru", "p_trial": False}
        self.rpc("student", "submit_business_registration", payload, 403, "42501")
        self.booking_id = self.rpc("service", "submit_business_registration", payload)
        booking = self.get("student", "bookings", select="id,person_id,status,revision,booking_items(*),invoice_cases(*)",
                           id="eq." + self.booking_id)[0]
        ensure(booking["person_id"] == self.person_id and booking["status"] == "pending", "Wrong registration identity/status")
        self.item(booking, 4, 100)
        ensure(self.get("other", "bookings", select="id,booking_items(*)", id="eq." + self.booking_id) == [], "Another student sees a booking")
        ensure(self.get("other", "booking_items", select="id", booking_id="eq." + self.booking_id) == [], "Another student sees booking items")
        self.passed("Private registration stores four 45-minute units at €25 = €100; real nested joins obey RLS")
        before = sql("SELECT json_build_array((SELECT count(*) FROM public.people),(SELECT count(*) FROM public.bookings),(SELECT count(*) FROM private.mail_outbox));")
        for bad in (None, [], [{"course_id": PRIVATE_COURSE}], [{"course_id": PRIVATE_COURSE, "requested_units": 1.5}],
                    [{"course_id": PRIVATE_COURSE, "requested_units": "4"}], [{"course_id": PRIVATE_COURSE, "requested_units": 1001}],
                    [{"course_id": PRIVATE_COURSE, "requested_units": 4, "unit_price": 0}]):
            self.rpc("service", "submit_business_registration", {**payload, "p_course_selections": bad}, 400, "23514")
        self.rpc("service", "submit_business_registration", {**payload, "p_trial": True}, 400, "23514")
        after = sql("SELECT json_build_array((SELECT count(*) FROM public.people),(SELECT count(*) FROM public.bookings),(SELECT count(*) FROM private.mail_outbox));")
        ensure(before == after, "Invalid registration left partial data or queued mail")
        self.passed("Invalid quantities, injected prices and private trial requests roll back atomically")

    @staticmethod
    def item(booking, quantity, amount):
        ensure(len(booking["booking_items"]) == 1, "Expected one booking item")
        row = booking["booking_items"][0]
        ensure(row["requested_units"] == quantity and row["units"] == quantity
               and row["unit_price"] == 25 and row["unit_minutes"] == 45 and row["amount"] == amount,
               "Stored quantity or immutable price snapshot differs")

    def monthly_and_invoice(self):
        self.rpc("other", "confirm_business_booking", {"p_id": self.booking_id}, 403, "42501")
        self.rpc("teacher", "confirm_business_booking", {"p_id": self.booking_id}, 204)
        self.rpc("teacher", "confirm_business_booking", {"p_id": self.booking_id}, 204)
        row = self.get("teacher", "bookings", select="id,status,revision,invoice_cases(*)", id="eq." + self.booking_id)[0]
        ensure(row["status"] == "confirmed" and row["revision"] == 2
               and row["invoice_cases"]["status"] == "outstanding", "Confirmation did not create exactly one invoice case")
        self.rpc("teacher", "mark_business_invoice", {"p_booking": self.booking_id, "p_month": self.month,
                  "p_created": True, "p_reference": self.prefix}, 204)
        ensure(self.get("teacher", "invoice_cases", select="status", booking_id="eq." + self.booking_id)[0]["status"] == "created", "Invoice marking failed")
        ensure(self.get("student", "invoice_cases", select="id", booking_id="eq." + self.booking_id) == [], "Internal invoice workflow leaks to students")
        self.passed("Staff-only confirmation is idempotent and creates/marks one canonical invoice case")
        # Global preparation is allowed only when it cannot affect non-QA people.
        ensure(sql("SELECT count(*) FROM public.bookings b JOIN public.people p ON p.id=b.person_id WHERE b.status='confirmed' AND p.email NOT LIKE 'qa-canonical-%@example.test';") == "0",
               "Refusing monthly preparation with non-QA confirmed bookings")
        ensure(self.rpc("teacher", "prepare_business_month", {"p_month": self.next_month}) >= 1, "No next-month quantity was carried")
        ensure(self.rpc("teacher", "prepare_business_month", {"p_month": self.next_month}) == 0, "Month preparation is not idempotent")
        row = self.get("student", "bookings", select="id,status,revision,booking_items(*)", person_id="eq." + self.person_id,
                       target_month="eq." + self.next_month)[0]
        self.item(row, 4, 100)
        payload = {"p_month": self.next_month, "p_course_selections": [{"course_id": PRIVATE_COURSE, "requested_units": 6}],
                   "p_paused": False, "p_expected": row["id"], "p_revision": row["revision"]}
        ensure(self.rpc("student", "save_business_month", payload) == row["id"], "Monthly revision changed identity")
        updated = self.get("student", "bookings", select="id,status,revision,booking_items(*)", id="eq." + row["id"])[0]
        self.item(updated, 6, 150)
        self.rpc("student", "save_business_month", payload, 409, "PT409")
        self.rpc("other", "save_business_month", payload, 409, "PT409")
        self.rpc("student", "save_business_month", {**payload, "p_revision": updated["revision"], "p_paused": True}, 400, "23514")
        self.request("student", "booking_items?booking_id=eq." + row["id"], "PATCH", {"amount": 0}, 403, "42501")
        self.rpc("teacher", "confirm_business_booking", {"p_id": row["id"]}, 204)
        self.rpc("teacher", "mark_business_invoice", {"p_booking": row["id"], "p_month": self.next_month,
                  "p_created": True, "p_reference": self.prefix + "-next"}, 204)
        self.rpc("student", "save_business_month", {**payload, "p_revision": updated["revision"] + 1}, 400, "23514")
        self.item(self.get("student", "bookings", select="booking_items(*)", id="eq." + row["id"])[0], 6, 150)
        self.passed("Month carry/change 4→6 units, exact revision conflicts, other-student denial and issued-invoice immutability")

    def cms(self):
        payload = {"slug": self.prefix + "-course", "title": "QA disposable private course", "description": "QA",
                   "type": "online", "category": "private", "level": "C1", "unit_price": 40, "unit_minutes": 60,
                   "start_date": "", "end_date": "", "trial_lessons": False, "sort_order": 990,
                   "archived": False, "schedules": [], "translations": [{"locale": "uk", "title": "QA", "description": ""}], "exceptions": []}
        self.rpc("student", "save_business_course", {"p_data": payload}, 403, "42501")
        course_id = self.rpc("teacher", "save_business_course", {"p_data": payload})
        self.extra_courses.append(course_id)
        row = self.get("anon", "courses", select="id,unit_price,course_translations(locale)", id="eq." + course_id)[0]
        ensure(row["unit_price"] == 40 and row["course_translations"] == [{"locale": "uk"}], "Dynamic course was not published relationally")
        self.rpc("teacher", "save_business_course", {"p_data": {**payload, "id": course_id, "unit_price": 45, "archived": True}})
        ensure(self.get("anon", "courses", select="id", id="eq." + course_id) == [], "Archived course remains public")
        ensure(self.get("teacher", "courses", select="unit_price,archived_at", id="eq." + course_id)[0]["unit_price"] == 45, "Teacher cannot edit/archive course")
        self.passed("Dynamic teacher course creation, translation join, price editing, archival and student write denial")

    def trainer_permissions(self):
        self.rpc("teacher", "set_student_level_access", {"p_user_id": self.users["student"], "p_levels": ["A1.1"]}, 204)
        for trainer, table in (("vocabulary", "learning_vocabulary_cards"), ("exercises", "learning_exercises"), ("pronunciation", "learning_reading_texts")):
            units = self.get("teacher", "learning_units", select="id", level="eq.A1.1", trainer="eq." + trainer,
                             is_active="eq.true", order="sort_order,id", limit="2")
            ensure(len(units) == 2, "Need two existing published units to verify restrictions")
            grant = {"p_user_id": self.users["student"], "p_level": "A1.1", "p_trainer": trainer,
                     "p_enabled": True, "p_replace_units": True, "p_unit_ids": [units[0]["id"]]}
            self.rpc("teacher", "set_student_trainer_access", grant, 204)
            ensure(len(self.get("student", table, select="id", unit_id="eq." + units[0]["id"], limit="1")) == 1,
                   "Selected learning unit is not accessible")
            ensure(self.get("student", table, select="id", unit_id="eq." + units[1]["id"]) == [], "Unselected content leaks")
            self.rpc("student", "set_student_trainer_access", {**grant, "p_unit_ids": None}, 403, "42501")
            self.rpc("teacher", "set_student_trainer_access", {**grant, "p_unit_ids": []}, 204)
            ensure(self.get("student", table, select="id", unit_id="eq." + units[0]["id"]) == [], "Empty selection incorrectly grants all")
            self.rpc("teacher", "set_student_trainer_access", {**grant, "p_unit_ids": None}, 204)
        self.passed("Canonical UUID unit grants enforce selected/none/all for vocabulary, grammar and individual pronunciation texts")
        self.request("student", "profiles?id=eq." + self.users["student"], "PATCH", {"ui_language": "de"})
        for table in ("learning_vocabulary_cards", "learning_exercises", "learning_reading_texts", "learning_videos"):
            ensure(self.get("student", table, select="id", limit="1") == [], "German-interface trainer content is not blocked")
        ensure(len(self.get("teacher", "learning_exercises", select="id", limit="1")) == 1, "German staff CMS was blocked")
        self.passed("German learner interface blocks all trainer content while German teacher CMS remains available")

    def cleanup_catalog(self):
        for course_id in self.extra_courses:
            sql("DELETE FROM public.courses WHERE id=" + literal(course_id)
                + " AND slug=" + literal(self.prefix + "-course") + ";")
        ensure(sql("SELECT count(*) FROM public.courses") == "9", "QA catalog cleanup must restore exactly nine rows")
        self.passed("QA-only catalog cleanup restores the exact nine-course export")

    def run(self):
        self.setup()
        try:
            self.catalog()
            self.identity_and_registration()
            self.monthly_and_invoice()
            self.cms()
            self.trainer_permissions()
        finally:
            self.cleanup_catalog()
        return {"passed": len(self.checks), "checks": self.checks, "target": "isolated-clone",
                "qa_user_ids": list(self.users.values()), "catalog_rows": 9, "mail_delivery": "disabled-no-worker"}


if __name__ == "__main__":
    try:
        report = Suite().run()
        print(json.dumps(report, ensure_ascii=False, indent=2))
    except (AssertionError, KeyError, ValueError) as error:
        print("FAIL " + str(error), file=sys.stderr)
        sys.exit(1)
