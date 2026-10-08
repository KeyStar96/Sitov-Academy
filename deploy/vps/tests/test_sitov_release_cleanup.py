#!/usr/bin/env python3
"""Temporary release trees only; never touch real systemd, processes or builds."""
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "sitov-release-cleanup.py"
SPEC = importlib.util.spec_from_file_location("sitov_release_cleanup", SCRIPT)
cleanup = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(cleanup)


class ReleaseCleanupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.home = Path(self.temporary.name).resolve()
        self.root = self.home / "sitov-releases"
        self.root.mkdir()
        self.releases = [self.make_release(f"{index:012x}", index * 1_000_000_000) for index in range(1, 5)]
        self.active = self.releases[-1]
        self.current = self.home / "sitov-current"
        self.current.symlink_to(self.active)
        self.lock = self.home / "sitov-release.lock"
        self.proc = self.home / "proc"
        self.proc.mkdir()
        (self.proc / "456").mkdir()
        (self.proc / "456/cwd").symlink_to(self.active)
        # macOS has no /proc. Keep that OS dependency in a test-only wrapper;
        # the actual command/parser, systemctl inspection and deletes execute.
        self.wrapper = self.home / "test-command.py"
        self.wrapper.write_text(
            "import importlib.util,os,pathlib,sys\n"
            "spec=importlib.util.spec_from_file_location('cleanup',os.environ['MOCK_SCRIPT'])\n"
            "module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)\n"
            "original=module.runtime_snapshot\n"
            "module.runtime_snapshot=lambda root,current,proc_root=None:original(root,current,pathlib.Path(os.environ['MOCK_PROC']))\n"
            "sys.exit(module.main(sys.argv[1:]))\n")
        self.bin = self.home / "bin"
        self.bin.mkdir()
        command = self.bin / "systemctl"
        command.write_text("#!/usr/bin/env python3\nimport os\nprint('ActiveState='+os.environ.get('MOCK_ACTIVE','active'))\nprint('MainPID='+os.environ['MOCK_PID'])\nprint('WorkingDirectory='+os.environ['SITOV_CURRENT_LINK'])\n")
        command.chmod(0o755)
        self.env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ["PATH"],
                        MOCK_PID="456", MOCK_SCRIPT=str(SCRIPT), MOCK_PROC=str(self.proc),
                        SITOV_CURRENT_LINK=str(self.current),
                        SITOV_RELEASES_DIR=str(self.root), SITOV_DEPLOY_LOCK_FILE=str(self.lock))

    def make_release(self, revision, timestamp):
        release = self.root / revision
        release.mkdir()
        (release / 'app').mkdir()
        (release / 'package.json').write_text('{}')
        (release / "node_modules").mkdir()
        (release / "node_modules/next/dist/bin").mkdir(parents=True)
        (release / "node_modules/next/package.json").write_text("{}")
        (release / "node_modules/next/dist/bin/next").write_text("runtime entry point")
        (release / ".next/server").mkdir(parents=True)
        values = {".sitov-build-id": "build\n", ".next/BUILD_ID": "build\n",
                  ".next/required-server-files.json": "{}", "package-lock.json": "{}",
                  ".sitov-mail-was-running": "true\n", ".sitov-runtime.env": "SITOV_DEPLOYMENT_ID=" + revision + "0" * 28,
                  ".next/server/app.js": "completed app"}
        manifest = []
        for name, value in values.items():
            (release / name).write_text(value)
            digest = hashlib.sha256(value.encode()).hexdigest()
            manifest.append(f"{digest}  {name}\n")
        (release / ".sitov-prepared.sha256").write_text("".join(manifest))
        marker = release / ".sitov-prepared"
        marker.write_text(revision + "0" * 28 + "\n")
        os.utime(marker, ns=(timestamp, timestamp))
        return release

    def plan(self, protected=None, keep=1):
        return cleanup.inventory(self.root, self.active,
                                 protected or {self.active.name: ["current symlink"]}, keep)

    def run_script(self, *args, **environment):
        return subprocess.run(["python3", str(self.wrapper), *args], env=dict(self.env, **environment),
                              text=True, capture_output=True)

    def test_default_dry_run_preserves_all_files_and_reports_only_older_candidates(self):
        result = self.run_script("--json")
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["mode"], "dry-run")
        self.assertEqual([row["revision"] for row in report["releases"] if row["action"] == "remove"],
                         [path.name for path in self.releases[:2]])
        self.assertTrue(all(path.exists() for path in self.releases))

    def test_apply_keeps_active_and_one_newest_verified_rollback_build(self):
        result = self.run_script("--apply", "--json")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any(path.exists() for path in self.releases[:2]))
        self.assertTrue(all(path.exists() for path in self.releases[2:]))
        self.assertEqual(self.current.resolve(), self.active)

    def test_configurable_extra_rollback_count(self):
        rows = self.plan(keep=2)
        self.assertEqual([row["revision"] for row in rows if row["action"] == "remove"],
                         [self.releases[0].name])

    def test_cannot_disable_required_rollback(self):
        for value in ("0", "-1"):
            result = self.run_script("--apply", "--keep-rollback", value)
            self.assertEqual(result.returncode, 2, result.stderr)
            self.assertTrue(all(path.exists() for path in self.releases))

    def test_corrupt_newest_rollback_is_preserved_but_not_counted_as_viable(self):
        (self.releases[2] / ".next/server/app.js").write_text("tampered")
        rows = self.plan()
        self.assertEqual([row["revision"] for row in rows if row["action"] == "remove"],
                         [self.releases[0].name])
        self.assertIn("unverified", rows[2]["reasons"][0])
        self.assertIn("rollback", rows[1]["reasons"][0])

    def test_newer_prepared_build_is_preserved_until_activation(self):
        future = self.make_release("000000000005", 5_000_000_000)
        rows = self.plan()
        self.assertEqual(next(row for row in rows if row["revision"] == future.name)["action"], "keep")

    def test_unknown_paths_symlink_releases_and_incomplete_builds_are_never_candidates(self):
        (self.root / "uploads").mkdir()
        (self.root / "unexpected.txt").write_text("keep")
        external = self.home / "outside"
        external.mkdir()
        (self.root / "abcdefabcdef").symlink_to(external)
        incomplete = self.root / "cccccccccccc"
        incomplete.mkdir()
        rows = self.plan()
        for name in ("uploads", "unexpected.txt", "abcdefabcdef", "cccccccccccc"):
            self.assertEqual(next(row for row in rows if row["revision"] == name)["action"], "keep")

    def test_symlink_inside_deleted_release_does_not_touch_external_data(self):
        media = self.home / "stored-media"
        media.mkdir()
        (media / "student.webm").write_text("real student recording")
        (self.releases[0] / "media-link").symlink_to(media)
        result = self.run_script("--apply")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((media / "student.webm").read_text(), "real student recording")

    def test_runtime_on_an_older_release_is_kept_and_counts_towards_rollback(self):
        old = self.releases[1]
        rows = self.plan(protected={self.active.name: ["current symlink"], old.name: ["running sitov-mail process"]})
        self.assertEqual(next(row for row in rows if row["revision"] == old.name)["action"], "keep")
        self.assertEqual(next(row for row in rows if row["revision"] == self.releases[2].name)["action"], "remove")

    def test_runtime_snapshot_uses_resolved_process_cwd_even_after_link_switch(self):
        pid = "789"
        (self.proc / pid).mkdir()
        (self.proc / pid / "cwd").symlink_to(self.releases[1])
        result = subprocess.CompletedProcess([], 0, f"ActiveState=active\nMainPID={pid}\nWorkingDirectory={self.current}\n", "")
        with patch.object(cleanup.subprocess, "run", return_value=result):
            active, protected, _ = cleanup.runtime_snapshot(self.root, self.current, self.proc)
        self.assertEqual(active, self.active)
        self.assertIn(self.releases[1].name, protected)

    def test_missing_runtime_process_or_transitional_state_prevents_deletion(self):
        for output in ("ActiveState=active\nMainPID=999\n", "ActiveState=activating\nMainPID=0\n"):
            result = subprocess.CompletedProcess([], 0, output, "")
            with patch.object(cleanup.subprocess, "run", return_value=result), self.assertRaises(cleanup.CleanupRefused):
                cleanup.runtime_snapshot(self.root, self.current, self.proc)

    def test_stopped_app_preserves_every_release(self):
        result = self.run_script("--apply", MOCK_ACTIVE="inactive", MOCK_PID="0")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not active", result.stderr)
        self.assertTrue(all(path.exists() for path in self.releases))

    def test_active_artifact_corruption_preserves_every_release(self):
        (self.active / ".next/server/app.js").write_text("broken")
        result = self.run_script("--apply")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Active release cannot be verified", result.stderr)
        self.assertTrue(all(path.exists() for path in self.releases))

    def test_symlink_root_or_symlink_ancestor_is_refused(self):
        alias = self.home / "alias"
        alias.symlink_to(self.home)
        with self.assertRaises(cleanup.CleanupRefused):
            cleanup.managed_root(alias / "sitov-releases")
        linked = self.home / "linked" / "sitov-releases"
        linked.parent.mkdir()
        linked.symlink_to(self.root)
        with self.assertRaises(cleanup.CleanupRefused):
            cleanup.managed_root(linked)

    def test_broad_or_unknown_directory_is_refused(self):
        with self.assertRaises(cleanup.CleanupRefused):
            cleanup.managed_root(self.home)
        with self.assertRaises(cleanup.CleanupRefused):
            cleanup.managed_root("/")

    def test_current_link_outside_managed_root_is_refused(self):
        self.current.unlink()
        self.current.symlink_to(self.home)
        result = self.run_script("--apply")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("outside", result.stderr)
        self.assertTrue(all(path.exists() for path in self.releases))

    def test_manifest_traversal_absolute_and_symlink_artifacts_are_unverified(self):
        release = self.releases[0]
        manifest = release / ".sitov-prepared.sha256"
        original = manifest.read_text()
        for name in ("../outside", "/etc/passwd"):
            manifest.write_text(original + "0" * 64 + "  " + name + "\n")
            self.assertFalse(cleanup.verified_release(release)[0])
        manifest.write_text(original)
        artifact = release / ".next/server/app.js"
        artifact.unlink()
        artifact.symlink_to(self.active / ".next/server/app.js")
        self.assertFalse(cleanup.verified_release(release)[0])

    def add_source_link(self, release, target):
        (release / "supabase/migrations").mkdir(parents=True)
        alias = release / "supabase/migrations/20261002211653_sitov_daily_quests.sql"
        alias.symlink_to(target)
        if alias.is_file():
            checksum = hashlib.sha256(alias.read_bytes()).hexdigest()
        else:
            checksum = "0" * 64
        with (release / ".sitov-prepared.sha256").open("a") as manifest:
            manifest.write(f"{checksum}  {alias.relative_to(release)}\n")
        return alias

    def test_internal_git_source_symlink_is_verified_and_can_be_cleaned(self):
        release = self.releases[0]
        (release / "db/migrations").mkdir(parents=True)
        canonical = release / "db/migrations/061_sitov_daily_quests.sql"
        canonical.write_text("select 'Sitov Academy';\n")
        self.add_source_link(release, "../../db/migrations/061_sitov_daily_quests.sql")
        self.assertTrue(cleanup.verified_release(release)[0])
        result = self.run_script("--apply")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(release.exists())
        self.assertTrue(self.active.exists())

    def test_source_symlink_outside_release_is_unverified_even_with_matching_hash(self):
        outside = self.home / "external-migration.sql"
        outside.write_text("select 'preserve external data';\n")
        self.add_source_link(self.releases[0], outside)
        valid, reason, _ = cleanup.verified_release(self.releases[0])
        self.assertFalse(valid)
        self.assertIn("escapes release", reason)

    def test_source_symlink_into_other_release_is_unverified(self):
        self.add_source_link(self.releases[0], self.active / "package-lock.json")
        self.assertFalse(cleanup.verified_release(self.releases[0])[0])

    def test_dangling_or_looped_source_symlink_is_unverified(self):
        alias = self.add_source_link(self.releases[0], "missing.sql")
        self.assertFalse(cleanup.verified_release(self.releases[0])[0])
        alias.unlink()
        alias.symlink_to(alias.name)
        self.assertFalse(cleanup.verified_release(self.releases[0])[0])

    def test_build_and_runtime_marker_symlinks_inside_release_remain_unverified(self):
        release = self.releases[0]
        for name in (".next/server/app.js", ".sitov-runtime.env", ".sitov-mail-was-running"):
            artifact = release / name
            original = artifact.read_bytes()
            target = release / "source-file.txt"
            target.write_bytes(original)
            artifact.unlink()
            artifact.symlink_to(target)
            self.assertFalse(cleanup.verified_release(release)[0], name)
            artifact.unlink()
            artifact.write_bytes(original)

    def test_runtime_change_after_inventory_refuses_before_any_removal(self):
        rows = self.plan()
        with patch.object(cleanup, "runtime_snapshot", return_value=(self.active, {}, ["changed"])), self.assertRaises(cleanup.CleanupRefused):
            cleanup.apply_inventory(self.root, rows, self.current, ["original"], self.proc)
        self.assertTrue(all(path.exists() for path in self.releases))

    def test_path_replacement_after_inventory_refuses_before_any_removal(self):
        rows = self.plan()
        candidate = self.releases[1]
        renamed = self.home / "old-directory"
        candidate.rename(renamed)
        self.make_release(candidate.name, 2_000_000_000)
        with patch.object(cleanup, "runtime_snapshot", return_value=(self.active, {}, ["same"])), self.assertRaises(cleanup.CleanupRefused):
            cleanup.apply_inventory(self.root, rows, self.current, ["same"], self.proc)
        self.assertTrue(all(path.exists() for path in self.releases))

    def test_artifact_change_after_inventory_refuses_before_any_removal(self):
        rows = self.plan()
        (self.releases[1] / ".next/server/app.js").write_text("modified after dry-run")
        with patch.object(cleanup, "runtime_snapshot", return_value=(self.active, {}, ["same"])), self.assertRaises(cleanup.CleanupRefused):
            cleanup.apply_inventory(self.root, rows, self.current, ["same"], self.proc)
        self.assertTrue(all(path.exists() for path in self.releases))

    def test_mounted_release_is_kept_and_not_counted_as_verified_rollback(self):
        target = self.releases[2] / ".next"
        mountinfo = Path('/proc/self/mountinfo')
        original_is_file, original_read = Path.is_file, Path.read_text
        with patch.object(Path, 'is_file', lambda path: True if path == mountinfo else original_is_file(path)), \
                patch.object(Path, 'read_text', lambda path, *args, **kwargs: f'1 0 0:1 / {target} rw - tmpfs tmpfs rw\n' if path == mountinfo else original_read(path, *args, **kwargs)):
            rows = self.plan()
        self.assertEqual(rows[2]["action"], "keep")
        self.assertIn("mounted filesystem", rows[2]["reasons"][0])
        self.assertIn("rollback", rows[1]["reasons"][0])

    def add_cached_payload(self, release):
        artifact = release / '.next/server/app/de/registration.html'
        artifact.parent.mkdir(parents=True)
        artifact.write_text('initial generated HTML')
        with (release / '.sitov-prepared.sha256').open('a') as manifest:
            manifest.write(hashlib.sha256(artifact.read_bytes()).hexdigest() + '  ' + artifact.relative_to(release).as_posix() + '\n')
        artifact.write_text('ISR revalidated HTML')
        return artifact

    def test_isr_payload_changes_are_accepted_but_immutable_code_changes_are_not(self):
        artifact = self.add_cached_payload(self.releases[0])
        self.assertTrue(cleanup.verified_release(self.releases[0])[0])
        self.assertFalse(cleanup.verified_release(self.releases[0], allow_runtime_cache=False)[0])
        (self.releases[0] / '.next/server/app.js').write_text('changed executable')
        self.assertFalse(cleanup.verified_release(self.releases[0])[0])

    def test_cached_payload_symlink_remains_rejected(self):
        artifact = self.add_cached_payload(self.releases[0])
        artifact.unlink()
        artifact.symlink_to(self.active / '.next/server/app.js')
        self.assertFalse(cleanup.verified_release(self.releases[0])[0])

    def test_verify_release_cli_is_read_only_and_refuses_outside_target(self):
        self.add_cached_payload(self.releases[0])
        result = self.run_script('--verify-release', str(self.releases[0]))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(all(path.exists() for path in self.releases))
        result = self.run_script('--verify-release', str(self.home))
        self.assertNotEqual(result.returncode, 0)

    def test_native_linux_du_measurement_uses_one_filesystem_and_no_follow(self):
        path = self.releases[0]
        result = subprocess.CompletedProcess([], 0, '123456\t' + str(path) + '\n', '')
        with patch.object(cleanup.sys, 'platform', 'linux'), patch.object(cleanup, 'guard_mounts'), \
                patch.object(cleanup.subprocess, 'run', return_value=result) as run:
            self.assertEqual(cleanup.release_size(path, path.stat().st_dev), 123456)
        self.assertEqual(run.call_args.args[0], ['du', '--summarize', '--one-file-system', '--block-size=1', '--', str(path)])

    def test_explicit_reviewed_legacy_retirement_requires_known_git_and_older_rollback(self):
        legacy = self.releases[0]
        (legacy / '.sitov-prepared.sha256').unlink()
        real_run = cleanup.subprocess.run
        def known_git(args, **kwargs):
            if args[:1] == ['git']:
                value = 'app\npackage.json\npackage-lock.json\n' if 'ls-tree' in args else legacy.name + '0' * 28 + '\n'
                return subprocess.CompletedProcess(args, 0, value, '')
            return real_run(args, **kwargs)
        self.assertEqual(self.plan()[0]['action'], 'keep')
        with patch.object(cleanup.subprocess, 'run', side_effect=known_git):
            rows = cleanup.inventory(self.root, self.active, {self.active.name: ['current']}, 1, [legacy.name], self.home)
        self.assertEqual(rows[0]['action'], 'remove')
        self.assertTrue(rows[0]['reviewed_retirement'])
        self.assertFalse(rows[0]['verified'])
        self.assertIn('rollback', rows[2]['reasons'][0])
        with patch.object(cleanup.subprocess, 'run', side_effect=lambda args, **kwargs: subprocess.CompletedProcess(args, 0, 'f' * 40 + '\n', '') if args[:1] == ['git'] else real_run(args, **kwargs)):
            rows = cleanup.inventory(self.root, self.active, {self.active.name: ['current']}, 1, [legacy.name], self.home)
        self.assertEqual(rows[0]['action'], 'keep')

    def test_reviewed_legacy_newer_than_verified_rollback_cannot_be_retired(self):
        legacy = self.releases[2]
        (legacy / '.sitov-prepared.sha256').unlink()
        real_run = cleanup.subprocess.run
        def known_git(args, **kwargs):
            value = 'app\npackage.json\npackage-lock.json\n' if 'ls-tree' in args else legacy.name + '0' * 28 + '\n'
            return subprocess.CompletedProcess(args, 0, value, '') if args[:1] == ['git'] else real_run(args, **kwargs)
        with patch.object(cleanup.subprocess, 'run', side_effect=known_git):
            rows = cleanup.inventory(self.root, self.active, {self.active.name: ['current']}, 1, [legacy.name], self.home)
        self.assertEqual(rows[2]['action'], 'keep')
        self.assertIn('not older than verified rollback', rows[2]['reasons'][0])

    def test_reviewed_legacy_with_unclassified_data_is_preserved(self):
        legacy = self.releases[0]
        (legacy / '.sitov-prepared.sha256').unlink()
        (legacy / 'recordings').mkdir()
        real_run = cleanup.subprocess.run
        def known_git(args, **kwargs):
            value = 'app\npackage.json\npackage-lock.json\n' if 'ls-tree' in args else legacy.name + '0' * 28 + '\n'
            return subprocess.CompletedProcess(args, 0, value, '') if args[:1] == ['git'] else real_run(args, **kwargs)
        with patch.object(cleanup.subprocess, 'run', side_effect=known_git):
            rows = cleanup.inventory(self.root, self.active, {self.active.name: ['current']}, 1, [legacy.name], self.home)
        self.assertEqual(rows[0]['action'], 'keep')
        self.assertIn('unclassified', rows[0]['reasons'][0])

    def test_retained_rollback_corruption_after_inventory_blocks_all_deletion(self):
        rows = self.plan()
        (self.releases[2] / '.next/server/app.js').write_text('rollback executable changed')
        with patch.object(cleanup, 'runtime_snapshot', return_value=(self.active, {}, ['same'])), self.assertRaisesRegex(cleanup.CleanupRefused, 'rollback changed'):
            cleanup.apply_inventory(self.root, rows, self.current, ['same'], self.proc)
        self.assertTrue(all(path.exists() for path in self.releases))

    def test_reused_size_inventory_avoids_du_and_stale_identity_is_kept(self):
        rows = self.plan()
        sizes = {row['revision']: row for row in rows}
        with patch.object(cleanup, 'release_size', side_effect=AssertionError('size must be reused')):
            reused = cleanup.inventory(self.root, self.active, {self.active.name: ['current']}, 1, sizes=sizes)
        self.assertTrue(all(row['bytes_estimated_from_inventory'] for row in reused))
        sizes[self.releases[0].name]['identity'] = [1, 2]
        reused = cleanup.inventory(self.root, self.active, {self.active.name: ['current']}, 1, sizes=sizes)
        self.assertEqual(reused[0]['action'], 'keep')
        self.assertIn('identity differs', reused[0]['reasons'][0])

    def test_missing_runtime_dependencies_prevents_use_as_rollback(self):
        (self.releases[2] / "node_modules").rename(self.home / "missing-runtime")
        rows = self.plan()
        self.assertFalse(rows[2]["verified"])
        self.assertIn("rollback", rows[1]["reasons"][0])

    def test_missing_runtime_entry_point_prevents_use_as_rollback(self):
        (self.releases[2] / "node_modules/next/dist/bin/next").unlink()
        rows = self.plan()
        self.assertFalse(rows[2]["verified"])
        self.assertIn("rollback", rows[1]["reasons"][0])

    def test_shared_deploy_lock_prevents_concurrent_cleanup(self):
        with self.lock.open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = self.run_script("--apply")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Another deployment", result.stderr)
        self.assertTrue(all(path.exists() for path in self.releases))


if __name__ == "__main__":
    unittest.main()
