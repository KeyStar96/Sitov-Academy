#!/usr/bin/env python3
"""Build locally signed Sitov Academy Wi-Fi support without granting OS rights."""
import argparse
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import tempfile

APP_NAME = 'Sitov Academy Backup-WLAN.app'
APP_ID = 'com.sitov.backup-wifi'
AGENT_ID = APP_ID + '.network-agent'
PREVIOUS_AGENT_ID = APP_ID + '.agent'
SOURCES = Path(__file__).resolve().parent
LOCATION_REASON = ('Sitov Academy prüft ausschließlich, ob dein Mac im ausdrücklich erlaubten WLAN ist, '
                   'damit Sicherungen nie über einen Handy-Hotspot heruntergeladen werden. '
                   'Es werden keine Standortkoordinaten erfasst oder übertragen.')


def app_metadata():
    return {
        'CFBundleIdentifier': APP_ID, 'CFBundleName': 'Sitov Academy Backup-WLAN',
        'CFBundleDisplayName': 'Sitov Academy Backup-WLAN', 'CFBundleExecutable': 'sitov-wifi-permission',
        'CFBundlePackageType': 'APPL', 'CFBundleVersion': '1', 'CFBundleShortVersionString': '1.0',
        'LSMinimumSystemVersion': '13.0', 'NSHighResolutionCapable': True,
        'NSLocationUsageDescription': LOCATION_REASON,
        'NSLocationWhenInUseUsageDescription': LOCATION_REASON,
        'NSLocationAlwaysAndWhenInUseUsageDescription': LOCATION_REASON,
    }


def agent_metadata():
    return {
        'Label': AGENT_ID, 'BundleProgram': 'Contents/MacOS/sitov-wifi-permission',
        'ProgramArguments': ['sitov-wifi-permission', '--agent'],
        'MachServices': {AGENT_ID: True}, 'ProcessType': 'Background',
        'AssociatedBundleIdentifiers': [APP_ID],
    }


def run(command):
    subprocess.run(command, check=True)


def refresh_wifi_agent(app):
    """Register through the responsible app without opening UI or granting rights."""
    binary = Path(app) / 'Contents/MacOS/sitov-wifi-permission'
    result = subprocess.run([str(binary), '--refresh-agent'], check=True,
                            capture_output=True, text=True, timeout=15)
    try:
        status = json.loads(result.stdout).get('agentStatus')
    except (ValueError, AttributeError):
        raise RuntimeError('The native Wi-Fi agent returned an invalid registration result') from None
    if type(status) is not int or status not in (1, 2):
        raise RuntimeError('The native Wi-Fi agent could not be registered')
    return status


def install_wifi_support(tools, signing_identity='-'):
    """An ad-hoc local signature is the default; use a real identity when available.

    Builds before replacing the installed files. The app never changes the Wi-Fi
    allowlist. macOS Location/background approvals remain controlled by the user.
    Reinstallation of a running agent needs registration from the container app.
    """
    tools = Path(tools).expanduser().resolve()
    tools.mkdir(mode=0o700, parents=True, exist_ok=True)
    tools.chmod(0o700)
    target = tools / APP_NAME
    if target.exists() and target.is_symlink():
        raise RuntimeError('Permission app must not be a symlink')
    shared = SOURCES / 'sitov-wifi-shared.swift'
    with tempfile.TemporaryDirectory(prefix='.sitov-wifi-build-', dir=tools) as temporary:
        temporary = Path(temporary)
        bundle = temporary / APP_NAME
        executables = bundle / 'Contents/MacOS'
        agents = bundle / 'Contents/Library/LaunchAgents'
        resources = bundle / 'Contents/Resources'
        for folder in (executables, agents, resources):
            folder.mkdir(mode=0o700, parents=True, exist_ok=True)
        (bundle / 'Contents/Info.plist').write_bytes(plistlib.dumps(app_metadata()))
        (agents / (AGENT_ID + '.plist')).write_bytes(plistlib.dumps(agent_metadata()))
        # Retain the old service description solely for supported unregister.
        # macOS caches the old launch constraint when an executable's signing
        # identifier changes; the new agent label starts with the correct one.
        previous_agent = agent_metadata()
        previous_agent['Label'] = PREVIOUS_AGENT_ID
        previous_agent['MachServices'] = {PREVIOUS_AGENT_ID: True}
        (agents / (PREVIOUS_AGENT_ID + '.plist')).write_bytes(plistlib.dumps(previous_agent))
        compile_prefix = ['xcrun', 'swiftc', '-parse-as-library', '-O', '-target',
                          'arm64-apple-macosx13.0' if os.uname().machine == 'arm64' else 'x86_64-apple-macosx13.0']
        app = executables / 'sitov-wifi-permission'
        guard = temporary / 'sitov-network-guard'
        run(compile_prefix + [str(shared), str(SOURCES / 'sitov-network-state.swift'),
                              str(SOURCES / 'sitov-wifi-agent.swift'),
                              str(SOURCES / 'sitov-wifi-permission-app.swift'), '-o', str(app)])
        run(compile_prefix + [str(shared), str(SOURCES / 'sitov-network-guard.swift'), '-o', str(guard)])
        for binary, identifier in ((guard, APP_ID + '.guard'),):
            binary.chmod(0o700)
            requirement = ['--requirements', '=designated => identifier "' + identifier + '"'] if signing_identity == '-' else []
            run(['codesign', '--force', '--sign', signing_identity, '--identifier', identifier, *requirement, str(binary)])
        app.chmod(0o700)
        requirement = ['--requirements', '=designated => identifier "' + APP_ID + '"'] if signing_identity == '-' else []
        run(['codesign', '--force', '--sign', signing_identity, '--identifier', APP_ID, *requirement, str(bundle)])
        run(['codesign', '--verify', '--deep', '--strict', str(bundle)])
        run(['codesign', '--verify', '--strict', str(guard)])
        if target.exists():
            # Preserve the prior locally built app until installation succeeds.
            previous = tools / (APP_NAME + '.previous')
            if previous.is_symlink():
                raise RuntimeError('Previous permission app must not be a symlink')
            if previous.exists():
                shutil.rmtree(previous)
            target.rename(previous)
        try:
            bundle.rename(target)
            os.replace(guard, tools / 'sitov-network-guard')
        except BaseException:
            if not target.exists() and (tools / (APP_NAME + '.previous')).exists():
                (tools / (APP_NAME + '.previous')).rename(target)
            raise
    return target


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tools', type=Path, default=Path.home() / 'Library/Application Support/Sitov Academy/Tools')
    parser.add_argument('--signing-identity', default='-')
    parser.add_argument('--open-permissions', action='store_true')
    args = parser.parse_args()
    app = install_wifi_support(args.tools, args.signing_identity)
    status = refresh_wifi_agent(app)
    if args.open_permissions:
        run(['open', str(app), '--args', '--setup'])
    print('Installed signed Sitov Academy Backup-WLAN app and refreshed its background agent')
    if status == 2:
        print('macOS background-agent approval is required in Login Items')
    print('Location permission stays controlled by macOS; existing approvals are preserved')


if __name__ == '__main__':
    main()
