#!/usr/bin/env bash
set -euo pipefail
# Run on VPS as root after installing python3-venv, ffmpeg, and espeak-ng.
# Downloads only pinned public model files during setup; inference never downloads.
TTS_INSTALL_DIR="${TTS_INSTALL_DIR:-/opt/sitov-tts}"
TTS_SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v ffmpeg >/dev/null
command -v espeak-ng >/dev/null
python3 -m venv "$TTS_INSTALL_DIR/venv"
"$TTS_INSTALL_DIR/venv/bin/pip" install --disable-pip-version-check -r "$TTS_SOURCE_DIR/requirements-tts.txt"
install -d -m 755 "$TTS_INSTALL_DIR/models" "$TTS_INSTALL_DIR/licenses"
install -m 644 "$TTS_SOURCE_DIR/tts_server.py" "$TTS_INSTALL_DIR/tts_server.py"
install -m 644 "$TTS_SOURCE_DIR/tts-models.json" "$TTS_INSTALL_DIR/tts-models.json"
install -m 644 "$TTS_SOURCE_DIR/TTS_LICENSES.md" "$TTS_INSTALL_DIR/licenses/TTS_LICENSES.md"
"$TTS_INSTALL_DIR/venv/bin/python" - "$TTS_INSTALL_DIR" <<'PY'
import hashlib,json,os,sys,urllib.request
from pathlib import Path
root=Path(sys.argv[1])
manifest=json.loads((root/'tts-models.json').read_text())
for name,files in manifest['voices'].items():
    for relative,expected in files.items():
        basename=relative.rsplit('/',1)[-1]
        destination=(root/'licenses'/f'{name}.MODEL_CARD') if basename=='MODEL_CARD' else root/'models'/basename
        if destination.exists() and destination.stat().st_size==expected['size_bytes'] and hashlib.md5(destination.read_bytes()).hexdigest()==expected['md5_digest']:
            continue
        url=f"https://huggingface.co/{manifest['repository']}/resolve/{manifest['revision']}/{relative}"
        temporary=destination.with_suffix(destination.suffix+'.download')
        digest=hashlib.md5(); size=0
        try:
            with urllib.request.urlopen(url,timeout=90) as response, temporary.open('wb') as output:
                while chunk:=response.read(1024*1024):
                    size+=len(chunk)
                    if size>expected['size_bytes']: raise RuntimeError('model_download_size_mismatch')
                    output.write(chunk); digest.update(chunk)
            if size!=expected['size_bytes'] or digest.hexdigest()!=expected['md5_digest']: raise RuntimeError('model_download_checksum_mismatch')
            temporary.replace(destination)
            print('Installed',destination.name,flush=True)
        finally:
            temporary.unlink(missing_ok=True)
license_url='https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/v1.8.0/COPYING'
with urllib.request.urlopen(license_url,timeout=30) as response:
    (root/'licenses'/'Piper-GPL-3.0.txt').write_bytes(response.read())
PY
printf '%s\n' "TTS files installed at $TTS_INSTALL_DIR. Install the systemd template with the deployment's service user and environment path, then start it."
