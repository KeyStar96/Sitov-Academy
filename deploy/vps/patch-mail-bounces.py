#!/usr/bin/env python3
"""Inspect Sitov bounce handling; --apply drops non-delivery reports instead of mailing them to info@.

Run on the VPS as root. Verified in the Postfix log on 2026-09-29: Supabase Auth
sends confirmation mails with envelope sender info@sitov-academy.com. When a
learner registers with a mistyped address (Gmail answers 550 5.1.1), this host
creates a "Undelivered Mail Returned to Sender" report and delivers it to the
IONOS mailbox info@. The school does not act on these reports.

This Postfix only sends mail for the app and Auth; it never receives mail for the
domain (MX is IONOS). Every message with the null sender <> that it would send out
is therefore one of its own delivery reports. `sender_dependent_default_transport_maps`
routes exactly those to the `discard` transport; all other mail keeps using
`default_transport`. The drop stays visible in the mail log (`relay=none`,
`status=sent (discarded)`), so nothing is hidden from a later investigation.

Anything unexpected aborts before a change. The backup stays root-only.
Rollback: copy the reported main.cf back, then  postfix check && systemctl reload postfix
"""
import argparse
import datetime
from pathlib import Path
import shutil
import subprocess

MAIN_CF = Path('/etc/postfix/main.cf')
MASTER_CF = Path('/etc/postfix/master.cf')
BACKUPS = Path('/root/backups/sitov-mail-bounces')
NULL_SENDER_KEY = '<>'
PARAMETER = 'sender_dependent_default_transport_maps'
TARGET = 'inline:{ <>=discard: }'


def target_value(current, lookup_key):
    """The one accepted change: from unset to the null-sender discard map."""
    if lookup_key != NULL_SENDER_KEY:
        raise RuntimeError('Unexpected empty_address_default_transport_maps_lookup_key: ' + lookup_key)
    if current not in ('', TARGET):
        raise RuntimeError(f'{PARAMETER} is already set to {current!r}; review main.cf first')
    return TARGET


def discard_transport_exists(master_cf):
    return any(line.split()[:2] == ['discard', 'unix'] and line.split()[-1] == 'discard'
               for line in master_cf.splitlines() if line.strip() and not line.startswith('#'))


def postconf(*args):
    return subprocess.run(['postconf', *args], check=True, capture_output=True, text=True).stdout.strip()


def plan():
    if not discard_transport_exists(MASTER_CF.read_text()):
        raise RuntimeError('master.cf has no discard transport; review it first')
    current = postconf('-h', PARAMETER)
    return current, target_value(current, postconf('-h', 'empty_address_default_transport_maps_lookup_key'))


def apply(target):
    backup = BACKUPS / datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup.mkdir(parents=True, mode=0o700)
    shutil.copy2(MAIN_CF, backup / MAIN_CF.name)
    subprocess.run(['postconf', '-e', f'{PARAMETER} = {target}'], check=True)
    subprocess.run(['postfix', 'check'], check=True)
    subprocess.run(['systemctl', 'reload', 'postfix'], check=True)
    return backup


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    current, target = plan()
    print(f'{PARAMETER}: {current!r} -> {target!r}')
    if current == target:
        print('Nothing to do.')
        return
    if not args.apply:
        print('Dry run. Re-run with --apply.')
        return
    print('Backup: ' + str(apply(target)))


if __name__ == '__main__':
    main()
