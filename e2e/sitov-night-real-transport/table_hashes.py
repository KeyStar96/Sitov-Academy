"""Sitov Academy: bounded, read-only hashes of the pinned private QA database.

Run on the QA host beside the unchanged runtime.py. The expected file must be
bound by SHA256 and contain exactly 188 qualified table names in ``actual``.
Output contains hashes/counts only. PostgreSQL's canonical row bytes are never
reserialized or logged; MD5 is a compatibility checksum, not a security claim.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import selectors
import signal
import subprocess
import sys
import time
from contextlib import contextmanager

RUNTIME_SHA256 = "065b3c62085a4d955de9796037ff15529d01c58b723206c1edc26856bc8414f9"
NAMESPACE = "sitov-night-20261008-qa"
TABLE_COUNT = 188
MAX_ROW_BYTES = 8 * 1024 * 1024
MAX_TABLE_BYTES = 128 * 1024 * 1024
MAX_OPERATION_BYTES = 512 * 1024 * 1024
IDENTIFIER = re.compile(r"[A-Za-z_][A-Za-z0-9_]*\Z")
MD5 = re.compile(r"[0-9a-f]{32}\Z")
PSQL = ["docker", "exec", "-i", NAMESPACE + "-db", "psql", "-X",
        "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", "postgres"]
TRANSACTION = ("BEGIN READ ONLY;SET LOCAL statement_timeout=15000;"
               "SET LOCAL lock_timeout=2000;SET LOCAL work_mem=4096;"
               "SET LOCAL client_encoding='UTF8';")
INVENTORY_SQL = (TRANSACTION + "SELECT n.nspname || '.' || c.relname "
                 "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
                 "WHERE c.relkind IN ('r','p') AND n.nspname NOT IN "
                 "('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%' "
                 "ORDER BY n.nspname,c.relname;COMMIT;")


class TableHashError(RuntimeError):
    """A sanitized failure: no partial hash set may be accepted."""


def qualified_table(name):
    if not isinstance(name, str) or len(name) > 127:
        raise TableHashError("invalid table identifier")
    parts = name.split(".")
    if len(parts) != 2 or not all(IDENTIFIER.fullmatch(p) for p in parts):
        raise TableHashError("invalid table identifier")
    return '"' + parts[0] + '"."' + parts[1] + '"'


def load_expected(path, sha256):
    if not re.fullmatch(r"[0-9a-f]{64}", sha256):
        raise TableHashError("invalid expected SHA256")
    with open(path, "rb") as source:
        raw = source.read(1024 * 1024 + 1)
    if len(raw) > 1024 * 1024 or hashlib.sha256(raw).hexdigest() != sha256:
        raise TableHashError("expected file binding mismatch")
    try:
        expected = json.loads(raw)["actual"]
    except (ValueError, KeyError, TypeError):
        raise TableHashError("invalid expected file") from None
    if not isinstance(expected, dict) or len(expected) != TABLE_COUNT:
        raise TableHashError("expected inventory must contain exactly 188 tables")
    for name, digest in expected.items():
        qualified_table(name)
        if not isinstance(digest, str) or not MD5.fullmatch(digest):
            raise TableHashError("invalid expected digest")
    return expected


class RowHasher:
    """Incrementally reproduce coalesce(jsonb_agg(row)::text, '') bytes."""

    def __init__(self):
        self.md5 = hashlib.md5()
        self.sha256 = hashlib.sha256()
        self.rows = 0
        self.row_bytes = 0

    def feed(self, row):
        if not row.startswith(b"{") or not row.endswith(b"}"):
            raise TableHashError("invalid canonical row framing")
        try:
            if not isinstance(json.loads(row), dict):
                raise ValueError()
        except (UnicodeError, ValueError):
            raise TableHashError("invalid canonical JSON row") from None
        prefix = b"[" if self.rows == 0 else b", "
        for digest in (self.md5, self.sha256):
            digest.update(prefix)
            digest.update(row)
        self.rows += 1
        self.row_bytes += len(row)

    def result(self):
        md5, sha256 = self.md5.copy(), self.sha256.copy()
        if self.rows:
            md5.update(b"]")
            sha256.update(b"]")
        return {"md5": md5.hexdigest(), "sha256": sha256.hexdigest(),
                "rows": self.rows, "rowBytes": self.row_bytes}


def stream_process(command, query, consume, deadline, *, row_limit=MAX_ROW_BYTES,
                   total_limit=MAX_TABLE_BYTES):
    """Drain both pipes with a wall deadline, bounded lines, and checked exit.

    The command is internal (fixed psql in production). stderr is discarded,
    never included in errors. Even an idle child with an open pipe times out.
    """
    if time.monotonic() >= deadline:
        raise TableHashError("client deadline exceeded")
    child = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, start_new_session=True)
    selector = selectors.DefaultSelector()
    pending = bytearray()
    total = 0
    try:
        child.stdin.write(query.encode("utf-8"))
        child.stdin.close()
        for pipe in (child.stdout, child.stderr):
            os.set_blocking(pipe.fileno(), False)
            selector.register(pipe, selectors.EVENT_READ)
        while selector.get_map():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TableHashError("client deadline exceeded")
            for key, _ in selector.select(min(remaining, 0.2)):
                chunk = os.read(key.fd, 65536)
                if not chunk:
                    selector.unregister(key.fileobj)
                    continue
                total += len(chunk)
                if total > total_limit:
                    raise TableHashError("stream byte limit exceeded")
                if key.fileobj is child.stderr:
                    continue
                pending.extend(chunk)
                while True:
                    newline = pending.find(b"\n")
                    if newline < 0:
                        break
                    if newline > row_limit:
                        raise TableHashError("row byte limit exceeded")
                    row = bytes(pending[:newline])
                    del pending[:newline + 1]
                    consume(row)
                if len(pending) > row_limit:
                    raise TableHashError("row byte limit exceeded")
        if pending:
            raise TableHashError("unterminated canonical row")
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TableHashError("client deadline exceeded")
        if child.wait(timeout=remaining) != 0:
            raise TableHashError("read-only child failed")
        return total
    except subprocess.TimeoutExpired:
        raise TableHashError("client deadline exceeded") from None
    finally:
        selector.close()
        if child.poll() is None:
            os.killpg(child.pid, signal.SIGKILL)
        child.wait(timeout=2)
        for pipe in (child.stdin, child.stdout, child.stderr):
            pipe.close()


@contextmanager
def operation_timer(seconds):
    """Bound guards too, including their internal inspect/health subprocesses."""
    if not 1 <= seconds <= 180:
        raise TableHashError("operation deadline must be 1..180 seconds")
    previous = signal.getsignal(signal.SIGALRM)

    def expired(_signum, _frame):
        raise TableHashError("whole operation deadline exceeded")

    signal.signal(signal.SIGALRM, expired)
    signal.setitimer(signal.ITIMER_REAL, seconds)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)


def pinned_runtime():
    path = Path(__file__).with_name("runtime.py")
    if hashlib.sha256(path.read_bytes()).hexdigest() != RUNTIME_SHA256:
        raise TableHashError("pinned runtime binding mismatch")
    spec = importlib.util.spec_from_file_location("sitov_hash_runtime", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def runtime_guard(runtime):
    try:
        health = runtime.health()
        _, containers = runtime.scope()
        caps = {key: (d["HostConfig"]["Memory"], d["HostConfig"]["NanoCpus"])
                for key, d in containers.items()}
        expected_caps = {"db": (320, 750000000), "auth": (128, 250000000),
                         "storage": (256, 500000000), "rest": (64, 250000000),
                         "gateway": (192, 250000000)}
        if caps != {k: (m * 1024**2, cpu) for k, (m, cpu) in expected_caps.items()}:
            raise TableHashError("exact QA caps mismatch")
        if runtime.NAMESPACE != NAMESPACE or [x["http_status"] for x in health["health"]] != [200] * 3:
            raise TableHashError("QA health mismatch")
        memory_kib = int(next(line.split()[1] for line in Path("/proc/meminfo")
                              .read_text().splitlines() if line.startswith("MemAvailable:")))
        if memory_kib < 1984 * 1024:
            raise TableHashError("QA memory gate failed")
        return {"at": health["at"], "memAvailableMiB": memory_kib / 1024,
                "health": [200] * 3, "capsMiB": 960, "cpu": 2,
                "oomKilled": {k: d["State"]["OOMKilled"] for k, d in containers.items()}}
    except TableHashError:
        raise
    except Exception:
        raise TableHashError("pinned QA guard failed") from None


def validate_inventory(inventory, expected):
    if len(inventory) != TABLE_COUNT or len(set(inventory)) != len(inventory) or set(inventory) != set(expected):
        raise TableHashError("actual inventory differs from exact expected 188 tables")
    for name in inventory:
        qualified_table(name)


def collect(expected, seconds=120):
    start = time.monotonic()
    deadline = start + seconds
    with operation_timer(seconds):
        runtime = pinned_runtime()
        before = runtime_guard(runtime)
        inventory = []

        def inventory_row(row):
            if len(inventory) >= TABLE_COUNT:
                raise TableHashError("inventory count exceeded")
            try:
                inventory.append(row.decode("ascii"))
            except UnicodeError:
                raise TableHashError("invalid inventory encoding") from None

        total = stream_process(PSQL, INVENTORY_SQL, inventory_row,
                               min(deadline, time.monotonic() + 20), row_limit=127, total_limit=32768)
        validate_inventory(inventory, expected)
        tables = {}
        for name in sorted(inventory):
            hasher = RowHasher()
            query = (TRANSACTION + "SELECT to_jsonb(t)::text FROM " + qualified_table(name)
                     + " t ORDER BY to_jsonb(t)::text;COMMIT;")
            remaining_bytes = min(MAX_TABLE_BYTES, MAX_OPERATION_BYTES - total)
            if remaining_bytes <= 0:
                raise TableHashError("operation byte limit exceeded")
            total += stream_process(PSQL, query, hasher.feed,
                                    min(deadline, time.monotonic() + 20), total_limit=remaining_bytes)
            tables[name] = hasher.result()
        after = runtime_guard(runtime)
        changed = [name for name in sorted(tables) if tables[name]["md5"] != expected[name]]
        return {"operation": "READ_ONLY_CANONICAL_ROW_STREAM", "tableCount": len(tables),
                "tables": tables, "changedTables": changed, "all188Equal": not changed,
                "before": before, "after": after, "seconds": time.monotonic() - start,
                "streamBytes": total, "writes": False, "sharedCounterReset": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected-file", required=True)
    parser.add_argument("--expected-sha256", required=True)
    parser.add_argument("--seconds", type=int, default=120)
    args = parser.parse_args()
    try:
        expected = load_expected(args.expected_file, args.expected_sha256)
        result = collect(expected, args.seconds)
        result["expectedFileSha256"] = args.expected_sha256
        print(json.dumps(result, sort_keys=True))
        return 0 if result["all188Equal"] else 2
    except Exception as error:
        # Never include external exceptions, command output, credentials or rows.
        reason = str(error) if isinstance(error, TableHashError) else "hash operation failed"
        print(json.dumps({"ok": False, "error": reason}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
