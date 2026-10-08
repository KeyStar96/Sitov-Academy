#!/usr/bin/env python3
"""Inventory/prune verified Sitov Academy releases; default is a dry run.

Only sibling Git-revision directories in a real ``sitov-releases`` directory
are candidates. The current symlink, both service process directories, a
configurable number of older verified builds, and newer preparations are kept.
Database, Docker, backups, stored media and source-checkout paths are never
cleanup targets. Uses the same lock as deploy-release.sh.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys


REVISION = re.compile(r"[0-9a-f]{12}\Z")
COMMIT = re.compile(r"[0-9a-f]{40}\Z")
SHA256 = re.compile(r"[0-9a-f]{64}\Z")
SERVICES = ("sitov-app", "sitov-mail")
SOURCE_DIR = Path('/var/www/sitov-academy')


class CleanupRefused(Exception):
    """An uncertain safety condition must prevent deletion."""


def real_directory(value):
    path = Path(os.path.abspath(value))
    if path.is_symlink() or not path.is_dir() or path.resolve() != path:
        raise CleanupRefused(f"Directory is missing or uses a symlink: {path}")
    return path


def managed_root(value):
    path = real_directory(value)
    if path.name != "sitov-releases":
        raise CleanupRefused("Managed releases directory must be named sitov-releases.")
    return path


def containing_release(root, path):
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        return None
    return parts[0] if parts and REVISION.fullmatch(parts[0]) else None


def runtime_snapshot(root, current_link, proc_root=Path("/proc")):
    link = Path(current_link)
    if not link.is_symlink():
        raise CleanupRefused("Current application path is not a symlink.")
    try:
        active = link.resolve(strict=True)
    except (OSError, RuntimeError) as error:
        raise CleanupRefused("Cannot resolve the active release symlink.") from error
    if active.parent != root or not REVISION.fullmatch(active.name) or not active.is_dir():
        raise CleanupRefused("Current release is outside the managed revision directories.")
    protected = {active.name: ["current symlink"]}
    signature = [str(active)]
    for service in SERVICES:
        try:
            result = subprocess.run(
                ["systemctl", "show", service, "--property=ActiveState",
                 "--property=MainPID", "--property=WorkingDirectory"],
                check=True, capture_output=True, text=True, timeout=10)
        except (OSError, subprocess.SubprocessError) as error:
            raise CleanupRefused(f"Cannot inspect service {service}.") from error
        properties = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
        state = properties.get("ActiveState")
        pid_text = properties.get("MainPID", "")
        if state not in ("active", "inactive", "failed") or not pid_text.isdigit():
            raise CleanupRefused(f"Service {service} has an unknown or changing runtime state.")
        if service == "sitov-app" and state != "active":
            raise CleanupRefused("Application is not active; keep releases for recovery.")
        pid = int(pid_text)
        if state == "active" and not pid:
            raise CleanupRefused(f"Active service {service} has no inspectable main process.")
        signature.append((service, state, pid))
        if pid:
            try:
                cwd = (proc_root / str(pid) / "cwd").resolve(strict=True)
            except (OSError, RuntimeError) as error:
                raise CleanupRefused(f"Cannot inspect running {service} process directory.") from error
            signature.append(str(cwd))
            release = containing_release(root, cwd)
            if release:
                protected.setdefault(release, []).append(f"running {service} process")
        working = properties.get("WorkingDirectory", "")
        if working:
            try:
                configured = Path(working).resolve(strict=True)
            except (OSError, RuntimeError) as error:
                raise CleanupRefused(f"Cannot resolve {service} working directory.") from error
            signature.append(str(configured))
            release = containing_release(root, configured)
            if release:
                protected.setdefault(release, []).append(f"configured {service} directory")
    return active, protected, signature


def plain_file(path, root, allow_source_symlink=False):
    relative = path.relative_to(root)
    try:
        resolved = path.resolve(strict=True)
    except (OSError, RuntimeError) as error:
        raise CleanupRefused(f"Missing or indirect artifact: {relative}") from error
    if allow_source_symlink:
        # Git archives may contain migration aliases linking to the canonical
        # SQL source. Match sha256sum's source-file behavior, but never let a
        # manifest link escape the release or refer to a directory.
        try:
            resolved.relative_to(root)
        except ValueError as error:
            raise CleanupRefused(f"Source artifact escapes release: {relative}") from error
        if not resolved.is_file():
            raise CleanupRefused(f"Source artifact is not a regular file: {relative}")
    elif path.is_symlink() or not path.is_file() or resolved != path:
        raise CleanupRefused(f"Missing or indirect artifact: {relative}")
    return resolved


def runtime_cache_artifact(relative):
    # Next's FileSystemCache.set writes these response payloads below server/app
    # during ISR, including *.segments/*.segment.rsc. Compiled JS, source maps,
    # JSON build manifests, BUILD_ID and runtime/source markers stay immutable.
    return relative.parts[:3] == ('.next', 'server', 'app') and relative.suffix in ('.html', '.meta', '.rsc', '.body')


def verified_release(path, allow_runtime_cache=True):
    """Use the same completed-build contract as activation, without shell input."""
    try:
        if path.is_symlink() or not path.is_dir() or path.resolve() != path:
            return False, "not a real release directory", None
        marker = path / ".sitov-prepared"
        plain_file(marker, path)
        commit = marker.read_text().strip()
        if not COMMIT.fullmatch(commit) or commit[:12] != path.name:
            return False, "preparation marker does not match revision", None
        for name in (".sitov-prepared.sha256", ".sitov-build-id", ".next/BUILD_ID",
                     ".next/required-server-files.json", "package-lock.json"):
            plain_file(path / name, path)
        if not (path / "node_modules").is_dir() or (path / "node_modules").is_symlink():
            return False, "missing local runtime dependencies", None
        for name in ("node_modules/next/package.json", "node_modules/next/dist/bin/next"):
            plain_file(path / name, path)
            if not (path / name).stat().st_size:
                return False, "empty Next.js runtime entry point", None
        build_id = (path / ".sitov-build-id").read_bytes()
        if not build_id.strip() or build_id != (path / ".next/BUILD_ID").read_bytes():
            return False, "build identity mismatch", None
        manifest = (path / ".sitov-prepared.sha256").read_text().splitlines()
        if not manifest:
            return False, "empty preparation manifest", None
        seen = set()
        for line in manifest:
            digest, separator, name = line.partition("  ")
            relative = Path(name)
            if not separator or not SHA256.fullmatch(digest) or relative.is_absolute() or ".." in relative.parts:
                return False, "unsafe preparation manifest entry", None
            if name in seen:
                return False, "duplicate preparation manifest entry", None
            seen.add(name)
            artifact = path / relative
            first = relative.parts[0] if relative.parts else ""
            source_link = first not in (".next", "node_modules", ".env.local") and not first.startswith(".sitov-")
            artifact = plain_file(artifact, path, allow_source_symlink=source_link)
            if allow_runtime_cache and runtime_cache_artifact(relative):
                continue
            checksum = hashlib.sha256()
            with artifact.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    checksum.update(chunk)
            calculated = checksum.hexdigest()
            if calculated != digest:
                return False, "preparation artifact checksum mismatch", None
        if not {".sitov-build-id", ".sitov-mail-was-running", ".sitov-runtime.env",
                ".next/BUILD_ID", ".next/required-server-files.json", "package-lock.json"}.issubset(seen):
            return False, "preparation manifest is missing required artifacts", None
        return True, "completed build and immutable artifact checksums verified", marker.stat().st_mtime_ns
    except (OSError, UnicodeError, CleanupRefused) as error:
        return False, str(error), None


def guard_mounts(path, device):
    """Reject all mounted subtrees, including same-device bind mounts."""
    mounts = []
    mountinfo = Path("/proc/self/mountinfo")
    if mountinfo.is_file():
        for line in mountinfo.read_text().splitlines():
            target = line.split()[4]
            target = re.sub(r"\\([0-7]{3})", lambda match: chr(int(match[1], 8)), target)
            mount = Path(target)
            if mount == path or path in mount.parents:
                mounts.append(mount)
    if mounts:
        raise CleanupRefused("Release contains a mounted filesystem.")
    if path.stat().st_dev != device or os.path.ismount(path):
        raise CleanupRefused("Release contains a mounted filesystem.")


def release_size(path, device):
    """Native du avoids millions of Python stat calls; never follows symlinks."""
    guard_mounts(path, device)
    command = ['du', '--summarize', '--one-file-system', '--block-size=1', '--', str(path)] if sys.platform.startswith('linux') else ['du', '-skx', str(path)]
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True, timeout=120)
        number, separator, target = result.stdout.strip().partition('\t')
        if not separator or not number.isdigit() or target != str(path):
            raise CleanupRefused('Unexpected release size response.')
        return int(number) * (1 if sys.platform.startswith('linux') else 1024)
    except (OSError, subprocess.SubprocessError) as error:
        raise CleanupRefused('Cannot measure release disk usage.') from error


def reviewed_release(path, source_dir, active_time):
    """Explicit retirement only: known old Git revision and completed runtime."""
    try:
        for name in ('.next/BUILD_ID', '.next/required-server-files.json', 'package.json', 'package-lock.json',
                     'node_modules/next/package.json', 'node_modules/next/dist/bin/next'):
            if not plain_file(path / name, path).stat().st_size:
                return False, 'reviewed release lacks completed runtime', None
        marker = path / '.sitov-prepared'
        marker_present = marker.exists() or marker.is_symlink()
        timestamp = plain_file(marker if marker_present else path / '.next/BUILD_ID', path).stat().st_mtime_ns
        if timestamp >= active_time:
            return False, 'reviewed release is not older than active preparation', None
        commit = subprocess.run(['git', '-C', str(source_dir), 'rev-parse', '--verify', path.name + '^{commit}'],
                                check=True, capture_output=True, text=True, timeout=10).stdout.strip()
        if not COMMIT.fullmatch(commit) or commit[:12] != path.name:
            return False, 'reviewed revision is not a known Git commit', None
        tracked = set(subprocess.run(['git', '-C', str(source_dir), 'ls-tree', '--name-only', commit],
                                     check=True, capture_output=True, text=True, timeout=10).stdout.splitlines())
        extra = {'.next', 'node_modules', '.env.local', '.sitov-prepared', '.sitov-prepared.sha256',
                 '.sitov-build-id', '.sitov-mail-was-running', '.sitov-runtime.env', 'tsconfig.tsbuildinfo'}
        if not {'app', 'package.json', 'package-lock.json'}.issubset(tracked) or not (path / 'app').is_dir() or (path / 'app').is_symlink():
            return False, 'reviewed release lacks the archived application source', None
        if {entry.name for entry in path.iterdir()} - tracked - extra:
            return False, 'reviewed release contains unclassified top-level data', None
        if marker_present and marker.read_text().strip() != commit:
            return False, 'reviewed preparation identity does not match Git', None
        return True, 'explicitly reviewed completed legacy release', timestamp
    except (OSError, UnicodeError, CleanupRefused, subprocess.SubprocessError):
        return False, 'reviewed release identity/runtime could not be established', None


def inventory(root, active, protected, rollback_count, reviewed=(), source_dir=SOURCE_DIR, sizes=None):
    rows = []
    active_valid, _, active_time = verified_release(active)
    if not active_valid:
        raise CleanupRefused("Active release cannot be verified; preserve all recovery builds.")
    for path in sorted(root.iterdir()):
        info = path.lstat()
        row = {"revision": path.name, "action": "keep", "reasons": [], "bytes": 0}
        rows.append(row)
        if not REVISION.fullmatch(path.name) or not stat.S_ISDIR(info.st_mode) or path.is_symlink():
            row["reasons"] = ["unknown or indirect path; never removed"]
            continue
        reviewed_valid = False
        if path.name in reviewed and path.name not in protected:
            # Explicitly reviewed obsolete versions are retirement targets,
            # never rollback candidates. Do not rehash their entire historic
            # asset trees; preserve full verification for active/rollback.
            valid = False
            reviewed_valid, explanation, prepared_time = reviewed_release(path, source_dir, active_time)
        else:
            valid, explanation, prepared_time = verified_release(path)
        row["verified"] = valid
        row["prepared_time_ns"] = prepared_time
        row['reviewed_retirement'] = reviewed_valid
        row["identity"] = [info.st_dev, info.st_ino]
        try:
            if sizes is not None and path.name in sizes:
                stored = sizes[path.name]
                if stored.get('identity') != row['identity']:
                    raise CleanupRefused('Release identity differs from size inventory.')
                guard_mounts(path, root.stat().st_dev)
                row['bytes'] = stored['bytes']
                row['bytes_estimated_from_inventory'] = True
            else:
                row["bytes"] = release_size(path, root.stat().st_dev)
        except (OSError, CleanupRefused) as error:
            row['verified'] = False
            row["reasons"] = [str(error)]
            continue
        if path.name in protected:
            row["reasons"] = protected[path.name]
        elif reviewed_valid:
            row['action'] = 'remove'
            row['reasons'] = ['explicitly reviewed legacy retirement; never a rollback candidate']
        elif not valid:
            row["reasons"] = [f"unverified build; never removed: {explanation}"]
        elif prepared_time >= active_time:
            row["reasons"] = ["newer preparation; awaiting activation or review"]
        else:
            row["action"] = "remove"
            row["reasons"] = ["older verified completed build"]
    eligible = sorted((row for row in rows if row["action"] == "remove" and row.get('verified')),
                      key=lambda row: (row["prepared_time_ns"], row["revision"]), reverse=True)
    # A process still running an older release already consumes a rollback slot.
    # Keep extra protected processes even when that exceeds the configured count.
    previous_protected = sum(row.get("verified", False) and row["revision"] != active.name
                             and row.get("prepared_time_ns", active_time) < active_time
                             and row["revision"] in protected for row in rows)
    for row in eligible[:max(0, rollback_count - previous_protected)]:
        row["action"] = "keep"
        row["reasons"] = ["newest verified rollback build"]
    rollback_rows = [row for row in rows if row['action'] == 'keep' and row.get('verified') and
                     row['revision'] != active.name and row.get('prepared_time_ns', active_time) < active_time]
    if any(row['action'] == 'remove' for row in rows) and not rollback_rows:
        raise CleanupRefused('No verified rollback remains; refusing release retirement.')
    cutoff = max((row['prepared_time_ns'] for row in rollback_rows), default=0)
    for row in rows:
        if row['action'] == 'remove' and row.get('reviewed_retirement') and row['prepared_time_ns'] >= cutoff:
            row['action'] = 'keep'
            row['reasons'] = ['reviewed legacy release is not older than verified rollback']
    return rows


def apply_inventory(root, rows, current_link, signature, proc_root, source_dir=SOURCE_DIR):
    candidates = [row for row in rows if row["action"] == "remove"]
    # Validate all targets again before deleting any of them. Runtime changes,
    # mounted paths or replacements invalidate the complete reviewed plan.
    active, _, observed_signature = runtime_snapshot(root, current_link, proc_root)
    if observed_signature != signature:
        raise CleanupRefused("Application/runtime changed after inventory; retry a dry run.")
    active_time = next(row['prepared_time_ns'] for row in rows if row['revision'] == active.name)
    rollback_rows = [row for row in rows if row['action'] == 'keep' and row.get('verified') and
                     row['revision'] != active.name and row.get('prepared_time_ns', active_time) < active_time]
    if candidates and (not rollback_rows or any(not verified_release(root / row['revision'])[0] for row in rollback_rows)):
        raise CleanupRefused('Verified rollback changed after inventory; preserve every release.')
    for row in rollback_rows:
        guard_mounts(root / row['revision'], root.stat().st_dev)
    for row in candidates:
        path = root / row["revision"]
        info = path.lstat()
        if path.is_symlink() or not stat.S_ISDIR(info.st_mode) or [info.st_dev, info.st_ino] != row["identity"]:
            raise CleanupRefused("Release path changed after inventory.")
        if row.get('reviewed_retirement'):
            valid, _, timestamp = reviewed_release(path, source_dir, active_time)
            valid = valid and timestamp == row['prepared_time_ns']
        else:
            valid = verified_release(path)[0]
        if not valid:
            raise CleanupRefused("Release artifacts changed after inventory.")
        guard_mounts(path, root.stat().st_dev)
    for row in candidates:
        if runtime_snapshot(root, current_link, proc_root)[2] != signature:
            raise CleanupRefused("Application/runtime changed during cleanup; remaining builds kept.")
        path = root / row["revision"]
        info = path.lstat()
        if path.is_symlink() or [info.st_dev, info.st_ino] != row["identity"]:
            raise CleanupRefused("Release path changed during cleanup.")
        shutil.rmtree(path)
        row["action"] = "removed"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="delete only eligible, verified old releases")
    mode.add_argument("--dry-run", action="store_true", help="inventory only (the default)")
    mode.add_argument('--verify-release', type=Path, help='verify immutable activation artifacts inside the managed release directory; read-only, no lock')
    parser.add_argument("--releases-dir", default=os.environ.get("SITOV_RELEASES_DIR", "/var/www/sitov-releases"))
    parser.add_argument("--current-link", default=os.environ.get("SITOV_CURRENT_LINK", "/var/www/sitov-current"))
    parser.add_argument("--lock-file", default=os.environ.get("SITOV_DEPLOY_LOCK_FILE", "/var/lock/sitov-release.lock"))
    parser.add_argument("--keep-rollback", type=int, default=os.environ.get("SITOV_RELEASE_KEEP_ROLLBACK", "1"))
    parser.add_argument("--json", action="store_true", help="print a structured inventory")
    parser.add_argument('--retire-reviewed', action='append', default=[], metavar='REVISION', help='explicitly reviewed obsolete completed Git release; never considered a rollback')
    parser.add_argument('--source-dir', type=Path, default=SOURCE_DIR, help='Git checkout for explicit legacy revision validation')
    parser.add_argument('--size-inventory', type=Path, help='reuse byte estimates from an earlier JSON inventory with unchanged directory identities')
    args = parser.parse_args(argv)
    if args.keep_rollback < 1:
        parser.error("Keep at least one verified rollback build.")
    if any(not REVISION.fullmatch(revision) for revision in args.retire_reviewed):
        parser.error('Reviewed retirements require exact 12-character Git revisions.')
    try:
        root = managed_root(args.releases_dir)
        if args.verify_release is not None:
            path = real_directory(args.verify_release)
            if path.parent != root or not REVISION.fullmatch(path.name) or args.retire_reviewed:
                raise CleanupRefused('Verification target must be a managed revision directory.')
            valid, reason, _ = verified_release(path)
            if not valid:
                raise CleanupRefused(reason)
            print('Immutable release artifacts verified.')
            return 0
        with open(args.lock_file, "a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as error:
                raise CleanupRefused("Another deployment or cleanup operation is running.") from error
            active, protected, signature = runtime_snapshot(root, args.current_link)
            sizes = None
            if args.size_inventory:
                try:
                    stored = json.loads(args.size_inventory.read_text())
                    if stored.get('active') != active.name:
                        raise ValueError('Active identity changed')
                    sizes = {}
                    for row in stored['releases']:
                        if REVISION.fullmatch(row.get('revision', '')):
                            if row['revision'] in sizes or type(row.get('bytes')) is not int or row['bytes'] < 0 or not isinstance(row.get('identity'), list) or len(row['identity']) != 2:
                                raise ValueError('Invalid size inventory')
                            sizes[row['revision']] = row
                except (ValueError, TypeError, KeyError, AttributeError) as error:
                    raise CleanupRefused('Invalid or outdated size inventory.') from error
            rows = inventory(root, active, protected, args.keep_rollback, args.retire_reviewed, args.source_dir, sizes)
            if args.apply:
                apply_inventory(root, rows, args.current_link, signature, Path("/proc"), args.source_dir)
            total = sum(row["bytes"] for row in rows if row["action"] in ("remove", "removed"))
            report = {"mode": "apply" if args.apply else "dry-run", "active": active.name,
                      "keep_rollback": args.keep_rollback, "reclaimable_bytes": total, "releases": rows}
            if args.json:
                print(json.dumps(report, indent=2))
            else:
                for row in rows:
                    print(f"{row['action']:7} {row['revision']} {row['bytes'] / 1024**2:.1f} MiB: {'; '.join(row['reasons'])}")
                print(f"{'Freed' if args.apply else 'Reclaimable'}: {total / 1024**2:.1f} MiB")
        return 0
    except (OSError, CleanupRefused) as error:
        print(f"Release cleanup refused: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
