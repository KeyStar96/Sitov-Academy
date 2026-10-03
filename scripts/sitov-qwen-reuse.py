#!/usr/bin/env python3
"""Reuse verified existing Qwen bytes after the complete production job ends."""
import argparse
import json
from pathlib import Path
from sitov_qwen_runtime import DEFAULT_CONFIG
from sitov_qwen_reuse import recover_reuse, reuse_prepared_assets

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source-manifest", type=Path)
parser.add_argument("--target-manifest", type=Path, required=True)
parser.add_argument("--catalog", type=Path)
parser.add_argument("--lock", type=Path, required=True)
parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
action = parser.add_mutually_exclusive_group()
action.add_argument("--apply", action="store_true", help="Explicitly copy unchanged bytes after all inputs validate; default is read-only")
action.add_argument("--recover", action="store_true", help="Restore a verified backup after an interrupted reuse transaction")
args = parser.parse_args()
if not args.recover and (not args.source_manifest or not args.catalog):
    parser.error("--source-manifest and the complete --catalog are required unless recovering")
try:
    result = recover_reuse(args.target_manifest, args.lock, args.config) if args.recover else reuse_prepared_assets(args.source_manifest, args.target_manifest, args.catalog, args.lock, args.apply, args.config)
    print(json.dumps(result))
except (ValueError, OSError, KeyError) as error:
    parser.exit(1, f"Prepared audio reuse refused: {error}\n")
