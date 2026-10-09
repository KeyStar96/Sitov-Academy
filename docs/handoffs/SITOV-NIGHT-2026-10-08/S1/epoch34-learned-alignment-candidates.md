# Sitov Academy — S1 epoch34: portable learned alignment candidates

Exact assigned base: `59176427`. This change adds an offline decoder, candidate CLI and CPU-only tests. No model inference, audio generation, adoption/import, SQL, runtime/container checks or database writes were performed. The current generator and voice configuration remain unchanged; profile fingerprint remains `96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5`.

## Independent decoder review

Reviewed M's private `learned_timestamp_decoder.py`, `experiment-learned-fa1299.py` and the installed pinned vendor `qwen3_forced_aligner.py`. The vendor `fix_timestamp` repairs anomalies by neighbor copying/interpolation. The new capture bypasses that parser and retains actual timestamp-token classifier outputs, token positions and input IDs. Class and processor hooks are restored in `finally`, including after exceptions.

The Viterbi recurrence correctly maximizes summed log probabilities over bounded class indices. Each lexical start must precede its end; subsequent starts may equal previous ends. Prefix maxima yield linear work per timestamp/class, with explicit predecessor reconstruction. Last tied predecessors and the first tied final state are deterministic. Full-class softmax normalization preserves probability mass outside the measured audio. An exhaustive oracle checks optimality on 25 small random matrices. New validation rejects empty/odd/bad-shaped or nonfinite logits, nonpositive/nonfinite duration or step, invalid support thresholds, insufficient measured duration and inconsistent timestamp tokens/raw argmax.

The former private decoder lacked several input validations and added a floating epsilon when rounding duration into a class bound. The portable decoder compares class times directly against measured duration, so an out-of-audio class cannot be rounded in. It adds no uniform timings, widening or vendor interval repair. Probability `0.005` and peak ratio `0.01` remain conservative **uncalibrated heuristics**. Passing them does not establish phonetic correctness, human review or publication authorization.

## Independent existing-data verification

Read-only verification covered all 1299 rows and actual corresponding MP3 SHA256s: 1290 supported and nine rejected, zero integrity/shape/bounds/positive-span/threshold discrepancies. In 500 rows the constrained class sequence differs from raw argmax. The index SHA256 is `a5cdc7750336cc60aa426b0d9322209489775de679eb58020c13e94e3b4d1a17`. Existing MP3/text provenance, classifier support values, monotonic bounds and exact display-token counts were checked. Raw logits were not retained by the old experiment, so actual1299 Viterbi optimality and probabilities cannot be independently recomputed from this index. This is static provenance/consistency evidence, not a new model run or listening QA.

The new source verifier also checked all 235 completed entries in the existing235 manifest against actual MP3s and metadata, without loading any model. Private summary and reviewed-source SHA manifest: `S1/epoch34-static-index-review-private.json` and `S1/epoch34-reviewed-source-manifest-private.json` in the orchestration directory.

## Candidate CLI contract

`scripts/sitov-qwen-align-prepared.py` takes a completed manifest, local aligner checkpoint and a separate output directory. Optional repeated `--id` selects entries. It validates completed status, fixed profile, MP3 SHA, exact text SHA, metadata identity and manifest/entry SHA before work and again after waiting for the lock and after inference. Model imports/loading happen only after acquiring the same `~/.cache/sitov-qwen/generation.lock` used by the generator (or the same explicit `SITOV_QWEN_LOCK`/`--lock`). It requires the configured local aligner revision and disables model downloads.

The final MP3 is decoded to measured mono 24k PCM; timings map exact display tokens with `lead_in=0` and `rate=1` because MP3 processing already occurred. Lexical spans must be positive and within the actual decoded duration. Candidate JSON stores selected classes/probabilities/peak ratios, raw argmax, timestamp token ID/positions, model revision, decoder version and all source hashes. A compressed NPZ stores actual timestamp logits and input IDs; array dtype/shape/content hashes and archive SHA are recorded. Arrays never go to stdout. Resume verifies source provenance, method/version, receipt digest and archive/array hashes. Existing outputs are never overwritten; interrupted orphan arrays fail closed for review. MP3s, source metadata and source manifests are never written.

Example, **not executed with a model in this lease**:

```sh
python scripts/sitov-qwen-align-prepared.py \
  --manifest /absolute/prepared/sitov-qwen-manifest.json \
  --aligner-path /absolute/models/aligner \
  --output-dir /absolute/separate-candidates \
  --lock /absolute/shared/generation.lock
```

Use the same lock as every concurrent generator. A real-model CLI smoke is explicitly pending until M's TTS/ASR jobs finish and M authorizes that resource slot. The current experiment's 1290 accepted rows do not prove the new CLI has passed this smoke.

## Validation

- `python -m unittest discover -s scripts -p test_sitov_qwen_alignment.py -q`: **14 PASS**, CPU only. Includes exhaustive DP oracle, nonmonotone second path, flat/missing-word rejection, ties/bounds/invalid inputs, missing timestamp and logits-shape checks, hook restoration, full mocked CLI lock/integrity/resume/output tests, and source/receipt/array tampering.
- `python -m unittest discover -s scripts -p test_sitov_qwen_runtime.py -q`: **14 PASS**, existing mocked runtime tests; no native MLX generation.
- Python compile checks and CLI `--help`: PASS. Final Git whitespace checks and clean commit recorded in S1.json.

Tests used the existing audio-authoring Python environment with NumPy. Actual CLI model smoke, independent phonetic/listening QA, threshold calibration and any adoption/import remain pending. S1 returns to WAIT; no release or publication approval.
