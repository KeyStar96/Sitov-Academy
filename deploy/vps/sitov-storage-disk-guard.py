#!/usr/bin/env python3
"""Pause public Storage writes before the shared VPS filesystem fills.

nginx reads the flag per request; reads and DELETE remain available. The guard
logs pressure to journald. It complements object quotas, including temporary
multipart files. This is not an external notification or an offsite backup.
"""
import shutil
from pathlib import Path

FLAG = Path('/run/sitov-storage-write-paused')
GIB = 1024 ** 3


def should_pause(total, free, already_paused=False):
    # Resume with headroom so borderline free space does not flap every minute.
    return free < (20 if already_paused else 15) * GIB or free / total < (0.10 if already_paused else 0.08)


def main():
    usage = shutil.disk_usage('/')
    paused = should_pause(usage.total, usage.free, FLAG.exists())
    if paused:
        if not FLAG.exists():
            FLAG.write_text('Sitov Academy: insufficient free space for public Storage writes\n')
            FLAG.chmod(0o644)
        print(f'Sitov Storage writes paused: {usage.free // GIB} GiB free', flush=True)
    else:
        if FLAG.exists():
            FLAG.unlink()
            print('Sitov Storage writes resumed', flush=True)
        if usage.free < 25 * GIB:
            print(f'Sitov disk warning: {usage.free // GIB} GiB free', flush=True)


if __name__ == '__main__':
    main()
