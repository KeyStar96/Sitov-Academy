#!/usr/bin/env python3
"""Explicitly download the pinned free authoring models; no inference or API fees."""
import argparse
import json
import os
import shutil
from pathlib import Path
from sitov_qwen_runtime import DEFAULT_CONFIG, atomic_json, load_profile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
parser.add_argument("--models-dir", type=Path, required=True)
args = parser.parse_args()
config, _, _, fingerprint = load_profile(args.config)
root = args.models_dir.resolve()
licenses = root / 'licenses'
licenses.mkdir(parents=True, exist_ok=True)
shutil.copyfile(Path(__file__).resolve().parents[1] / 'lib/audio/models/sitov-qwen-male-de/Qwen3-TTS-LICENSE.txt', licenses / 'Qwen3-TTS-LICENSE.txt')
os.environ["HF_HOME"] = str(root / "hub-cache")
from huggingface_hub import snapshot_download
prepared = {"profileFingerprint": fingerprint, "models": {}, "licenseSource": "https://github.com/QwenLM/Qwen3-TTS/blob/022e286b98fbec7e1e916cb940cdf532cd9f488e/LICENSE"}
for label, section in (("tts", config["tts"]), ("aligner", config["alignment"])):
    destination = root / label
    print(f"Downloading {section['mlxModel']} at pinned revision {section['mlxRevision']}", flush=True)
    snapshot_download(repo_id=section["mlxModel"], revision=section["mlxRevision"], local_dir=str(destination), max_workers=4)
    prepared["models"][label] = {"model": section["mlxModel"], "revision": section["mlxRevision"], "path": str(destination)}
atomic_json(root / "sitov-prepared-models.json", prepared)
print(json.dumps(prepared, indent=2))
