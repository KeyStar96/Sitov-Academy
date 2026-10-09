"""Offline candidate alignment; model support is not phonetic/human approval."""
from __future__ import annotations

from contextlib import contextmanager
import hashlib
import math
from pathlib import Path
import json

import numpy as np

from sitov_qwen_runtime import canonical_json, sha256_file, lexical_token, map_word_timings

DECODER_VERSION = "sitov-monotone-classifier-v1"
METHOD = "maximum_log_probability_monotone_path_over_actual_timestamp_classifier_logits"


def decode_learned_timestamp_classes(logits, duration_seconds, step_seconds=0.08,
                                     min_probability=0.005, min_peak_ratio=0.01):
    """Global maximum-score nonoverlapping path, with positive lexical spans.

    End boundaries strictly exceed starts; subsequent starts may equal ends.
    Prefix maxima retain the last tied predecessor, final ties choose the first.
    Softmax support includes *all* classes, including those outside the audio.
    Thresholds are conservative heuristics, not empirically calibrated quality.
    """
    for value in (duration_seconds, step_seconds):
        if not math.isfinite(value) or value <= 0:
            raise ValueError("invalid_duration_or_step")
    for value in (min_probability, min_peak_ratio):
        if not math.isfinite(value) or not 0 < value <= 1:
            raise ValueError("invalid_support_threshold")
    scores = np.asarray(logits, dtype=np.float64)
    if (scores.ndim != 2 or scores.shape[0] == 0 or scores.shape[0] % 2
            or scores.shape[1] < 2 or not np.isfinite(scores).all()):
        raise ValueError("invalid_timestamp_logits")
    count, classes = scores.shape
    # Compare real class times directly; never round an out-of-audio class in.
    limit = int(np.count_nonzero(np.arange(classes) * step_seconds <= duration_seconds))
    if count // 2 >= limit:
        raise ValueError("insufficient_measured_duration")
    peak = scores.max(axis=1)
    with np.errstate(over="ignore", under="ignore", invalid="raise"):
        shifted = scores - peak[:, None]
        log_normalizer = np.log(np.exp(shifted).sum(axis=1))
        supported = shifted[:, :limit] - log_normalizer[:, None]
    previous, parents = supported[0].copy(), []
    for position in range(1, count):
        best = np.maximum.accumulate(previous)
        at = np.maximum.accumulate(np.where(previous >= best, np.arange(limit), 0))
        if position % 2:
            current = np.full(limit, -np.inf)
            current[1:] = supported[position, 1:] + best[:-1]
            parent = np.full(limit, -1, dtype=np.int32)
            parent[1:] = at[:-1]
        else:
            current, parent = supported[position] + best, at.astype(np.int32)
        parents.append(parent)
        previous = current
    state = int(np.argmax(previous))
    if not np.isfinite(previous[state]):
        raise ValueError("no_monotone_model_path")
    chosen = [state]
    for parent in reversed(parents):
        state = int(parent[state])
        if state < 0:
            raise ValueError("invalid_backpointer")
        chosen.append(state)
    chosen = np.array(chosen[::-1])
    selected = shifted[np.arange(count), chosen]
    probability, ratio = np.exp(selected - log_normalizer), np.exp(selected)
    return {"accepted": bool(np.all(probability >= min_probability) and np.all(ratio >= min_peak_ratio)),
            "classIndices": chosen.tolist(), "seconds": (chosen * step_seconds).tolist(),
            "argmaxClassIndices": scores.argmax(axis=1).tolist(),
            "selectedProbabilities": probability.tolist(), "selectedToPeakRatios": ratio.tolist(),
            "minimumProbability": float(probability.min()), "minimumPeakRatio": float(ratio.min()),
            "thresholds": {"minProbability": min_probability, "minPeakRatio": min_peak_ratio},
            "method": METHOD, "decoderVersion": DECODER_VERSION,
            "timestampStepSeconds": step_seconds, "interpolationOrAdjustedIntervals": False}


def array_sha256(array):
    """Hash dtype/shape and canonical little-endian C bytes, not printed arrays."""
    array = np.ascontiguousarray(array, dtype=array.dtype.newbyteorder("<"))
    digest = hashlib.sha256(canonical_json({"dtype": array.dtype.str, "shape": array.shape}).encode())
    digest.update(array.tobytes())
    return digest.hexdigest()


def verified_source(manifest_path, identifier, entry, fingerprint):
    base = Path(manifest_path).resolve().parent
    def resolve(value):
        path = Path(value)
        return (path if path.is_absolute() else base / path).resolve()
    if entry.get("status") != "complete" or entry.get("profileFingerprint") != fingerprint:
        raise ValueError("incomplete_or_wrong_profile")
    mp3, metadata = resolve(entry["output"]), resolve(entry["metadata"])
    audio_sha, metadata_sha = sha256_file(mp3), sha256_file(metadata)
    details = json.loads(metadata.read_text())
    text = entry["text"]
    text_sha = hashlib.sha256(text.encode()).hexdigest()
    if (not text.split() or audio_sha != entry.get("sha256") or text_sha != entry.get("textSha256")
            or details.get("audioSha256") != audio_sha or details.get("textSha256") != text_sha
            or details.get("text") != text or details.get("profileFingerprint") != fingerprint
            or details.get("status") != "complete"):
        raise ValueError("source_integrity_mismatch")
    return {"id": identifier, "mp3": str(mp3), "metadata": str(metadata), "text": text,
            "sourceMP3Sha256": audio_sha, "metadataSha256": metadata_sha, "textSha256": text_sha,
            "manifestSha256": sha256_file(manifest_path),
            "entrySha256": hashlib.sha256(canonical_json(entry).encode()).hexdigest(),
            "profileFingerprint": fingerprint}


@contextmanager
def captured_alignment(model, duration, to_numpy):
    """Capture actual model outputs; bypass vendor timestamp repair; restore always."""
    state = {}
    cls, processor = type(model), model.aligner_processor
    old_call, old_parse = cls.__call__, processor.parse_timestamp
    had_own_parse = "parse_timestamp" in vars(processor)
    def call(self, *args, **kwargs):
        logits = old_call(self, *args, **kwargs)
        if self is model:
            state["logits"] = logits
            state["inputIds"] = args[0] if args else kwargs["input_ids"]
        return logits
    def parse(words, raw_timestamps):
        ids = np.asarray(to_numpy(state["inputIds"]), dtype=np.int64)
        logits = np.asarray(to_numpy(state["logits"]), dtype=np.float32)
        if ids.ndim != 2 or ids.shape[0] != 1 or logits.ndim != 3 or logits.shape[:2] != ids.shape:
            raise ValueError("unexpected_model_output_shape")
        token_id = model.config.timestamp_token_id
        mask = ids[0] == token_id
        if not words or int(mask.sum()) != 2 * len(words):
            raise ValueError("missing_timestamp_tokens")
        timestamps = logits[0, mask]
        step = model.config.timestamp_segment_time / 1000
        raw = np.asarray(raw_timestamps)
        if raw.shape != (2 * len(words),) or not np.array_equal(raw, timestamps.argmax(axis=1) * model.config.timestamp_segment_time):
            raise ValueError("raw_argmax_mismatch")
        decision = decode_learned_timestamp_classes(timestamps, duration, step)
        state.update(timestampLogits=timestamps, inputIdsArray=ids, timestampTokenId=int(token_id),
                     timestampTokenPositions=np.flatnonzero(mask).tolist(), decision=decision,
                     rawArgmaxMilliseconds=raw.tolist())
        times = decision["seconds"]
        return [{"text": word, "start_time": times[2*i]*1000, "end_time": times[2*i+1]*1000}
                for i, word in enumerate(words)]
    cls.__call__, processor.parse_timestamp = call, parse
    try:
        yield state
    finally:
        cls.__call__ = old_call
        if had_own_parse:
            processor.parse_timestamp = old_parse
        else:
            del processor.parse_timestamp


def exact_display_timings(text, aligned, duration):
    timings = map_word_timings(text, aligned, duration, lead_in=0, rate=1)
    if any(t["end"] > duration or (lexical_token(word) and t["end"] <= t["start"])
           for word, t in zip(text.split(), timings)):
        raise ValueError("nonpositive_or_out_of_audio_span")
    return timings


def receipt_digest(value):
    return hashlib.sha256(canonical_json({k: v for k, v in value.items() if k != "receiptSha256"}).encode()).hexdigest()


def verify_resume(candidate_path, provenance):
    value = json.loads(Path(candidate_path).read_text())
    if (value.get("provenance") != provenance or value.get("decoderVersion") != DECODER_VERSION
            or value.get("method") != METHOD or value.get("receiptSha256") != receipt_digest(value)):
        raise ValueError("candidate_receipt_mismatch")
    arrays_path = Path(candidate_path).with_suffix(".npz")
    if sha256_file(arrays_path) != value["arraysSha256"]:
        raise ValueError("candidate_arrays_mismatch")
    with np.load(arrays_path, allow_pickle=False) as arrays:
        if (array_sha256(arrays["timestampLogits"]) != value["rawLogitsSha256"]
                or array_sha256(arrays["inputIds"]) != value["inputIdsSha256"]):
            raise ValueError("candidate_array_provenance_mismatch")
    return value
