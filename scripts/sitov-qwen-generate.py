#!/usr/bin/env python3
"""Prepare the selected free German Qwen voice on the authoring Mac."""
import argparse
import json
import os
import sys
from pathlib import Path

from sitov_qwen_runtime import DEFAULT_CONFIG, SitovQwenBatch

parser = argparse.ArgumentParser(description=__doc__)
input_group = parser.add_mutually_exclusive_group(required=True)
input_group.add_argument("--text")
input_group.add_argument("--text-file", type=Path)
input_group.add_argument("--batch-file", "--catalog", dest="batch_file", type=Path)
parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
parser.add_argument("--model-path", type=Path, default=os.environ.get("SITOV_QWEN_MODEL_PATH"))
parser.add_argument("--aligner-path", type=Path, default=os.environ.get("SITOV_QWEN_ALIGNER_PATH"))
parser.add_argument("--output-dir", type=Path, required=True)
parser.add_argument("--output", type=Path)
parser.add_argument("--metadata", type=Path)
parser.add_argument("--rate", type=float, default=1.0)
parser.add_argument("--lock", type=Path)
parser.add_argument("--ffmpeg")
parser.add_argument("--stage", choices=["all", "synthesize", "finalize"], default="all")
parser.add_argument("--batch-size", type=int, default=1, help="Independent native ICL sequence batch size, 1–20; short catalogs can use 16 after validation.")
parser.add_argument("--continue-on-error", action="store_true", help="Record failed rows and prepare the other rows; failures still return a nonzero exit status and must not be published.")
args = parser.parse_args()
if not args.model_path or not args.aligner_path:
    parser.error("Provide locally prepared --model-path and --aligner-path; no automatic model download occurs.")
if args.batch_file:
    rows = json.loads(args.batch_file.read_text(encoding="utf-8"))
    if isinstance(rows, dict):
        rows = rows.get("rows", rows.get("entries"))
    if not isinstance(rows, list) or not rows:
        parser.error("The catalog must contain a nonempty JSON array of rows with text and optional id/output/metadata/rate.")
else:
    text = args.text if args.text is not None else args.text_file.read_text(encoding="utf-8")
    rows = [{"id": "sitov-single", "text": text, "rate": args.rate}]
    if args.output:
        rows[0]["output"] = str(args.output)
    if args.metadata:
        rows[0]["metadata"] = str(args.metadata)
runner = SitovQwenBatch(args.config, args.model_path, args.aligner_path, args.output_dir, args.lock, args.ffmpeg, args.batch_size, args.continue_on_error)
manifest = runner.run(rows, args.stage)
planned_ids = {row["id"] for row in runner.plan(rows)}
failed = [identifier for identifier in planned_ids if manifest["entries"].get(identifier, {}).get("status") == "failed"]
print(json.dumps({"manifest": str(runner.manifest_path), "entries": len(manifest["entries"]), "failed": len(failed), "profileFingerprint": runner.fingerprint}))
if failed:
    sys.exit(1)
