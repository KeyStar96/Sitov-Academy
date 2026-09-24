#!/usr/bin/env python3
"""Inspect Sitov mail routing; --apply fixes delivery to info@ and DKIM for Auth mails.

Run on the VPS as root. Two defects, both verified in the Postfix log on 2026-09-24:

1. `mydestination` listed `sitov-academy.com`. Postfix therefore treated itself
   as the final destination for the whole domain and rejected every mail to
   info@sitov-academy.com with `550 5.1.1 User unknown in local recipient table`
   instead of delivering it to the IONOS mailbox (MX mx00/mx01.ionos.de). The
   domain is removed; `$myhostname` (mail.sitov-academy.com) and localhost stay
   local. `myorigin` becomes `$myhostname`, so unqualified system mail (cron,
   root) stays on this host instead of being sent to IONOS as root@sitov-academy.com.
2. OpenDKIM trusted only 127.0.0.1. Supabase Auth submits confirmation and
   password-reset mails from its Docker network via the 10.0.0.1:2525 listener,
   so those left unsigned (`external host [10.0.2.15] attempted to send as
   sitov-academy.com`). The Auth network is added to the TrustedHosts list.

Anything unexpected aborts before a change. Backups stay root-only.
Rollback: copy the reported backup files back, then
  postfix check && systemctl reload postfix && systemctl restart opendkim
"""
import argparse
import datetime
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

DOMAIN = 'sitov-academy.com'
AUTH_NETWORK = '10.0.2.0/24'
MAIN_CF = Path('/etc/postfix/main.cf')
MASTER_CF = Path('/etc/postfix/master.cf')
TRUSTED_HOSTS = Path('/etc/opendkim/TrustedHosts')
BACKUPS = Path('/root/backups/sitov-mail-routing')
MYORIGIN = '$myhostname'


def without_domain(mydestination):
    """Drop only the exact domain entry; keep order and every other entry."""
    entries = [entry for entry in mydestination.replace(',', ' ').split() if entry]
    kept = [entry for entry in entries if entry.lower() != DOMAIN]
    if not kept or '$myhostname' not in kept:
        raise RuntimeError('Unexpected mydestination: ' + mydestination)
    return ', '.join(kept)


def with_auth_network(trusted_hosts):
    lines = trusted_hosts.splitlines()
    if AUTH_NETWORK in (line.strip() for line in lines):
        return trusted_hosts
    return '\n'.join(lines + [AUTH_NETWORK]) + '\n'


def auth_listener_matches(master_cf):
    """The 2525 listener must still admit exactly the network we trust for signing."""
    return 'mynetworks=127.0.0.0/8,' + AUTH_NETWORK in master_cf


def postconf(name):
    return subprocess.run(['postconf', '-h', name], check=True, capture_output=True, text=True).stdout.strip()


def plan():
    if not auth_listener_matches(MASTER_CF.read_text()):
        raise RuntimeError('Auth SMTP listener no longer admits ' + AUTH_NETWORK + '; review master.cf first')
    current = {'mydestination': postconf('mydestination'), 'myorigin': postconf('myorigin')}
    target = {'mydestination': without_domain(current['mydestination']), 'myorigin': MYORIGIN}
    trusted = TRUSTED_HOSTS.read_text()
    return current, target, trusted, with_auth_network(trusted)


def write_atomically(path, content):
    info = path.stat()
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.' + path.name + '.')
    with os.fdopen(fd, 'w') as handle:
        handle.write(content)
    os.chown(temporary, info.st_uid, info.st_gid)
    os.chmod(temporary, info.st_mode & 0o7777)
    os.replace(temporary, path)


def apply(current, target, trusted, patched_trusted):
    backup = BACKUPS / datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup.mkdir(parents=True, mode=0o700)
    for source in (MAIN_CF, TRUSTED_HOSTS):
        shutil.copy2(source, backup / source.name)
    for name, value in target.items():
        if current[name] != value:
            subprocess.run(['postconf', '-e', name + ' = ' + value], check=True)
    if patched_trusted != trusted:
        write_atomically(TRUSTED_HOSTS, patched_trusted)
    subprocess.run(['postfix', 'check'], check=True)
    subprocess.run(['systemctl', 'reload', 'postfix'], check=True)
    subprocess.run(['systemctl', 'restart', 'opendkim'], check=True)
    return backup


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    current, target, trusted, patched_trusted = plan()
    for name in target:
        print(f'{name}: {current[name]!r} -> {target[name]!r}')
    print('opendkim TrustedHosts: ' + ('unchanged' if patched_trusted == trusted else '+ ' + AUTH_NETWORK))
    if current == target and patched_trusted == trusted:
        print('Nothing to do.')
        return
    if not args.apply:
        print('Dry run. Re-run with --apply.')
        return
    print('Backup: ' + str(apply(current, target, trusted, patched_trusted)))


if __name__ == '__main__':
    main()
