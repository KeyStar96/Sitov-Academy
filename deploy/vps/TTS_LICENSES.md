# Sitov Academy speech components

German learning audio is authored offline with the selected male voice and **Qwen3-TTS-12Hz-1.7B-Base**. The checked-in profile, reference provenance and pinned model revisions live in `lib/audio/models/sitov-qwen-male-de/`. Qwen3-TTS and Qwen3-ForcedAligner model weights use Apache-2.0; retain their model cards and LICENSE files with the authoring installation. The reference excerpt is CC0-1.0 and its source and SHA-256 are recorded in `reference-meta.json`. No paid API is used.

The authoring pipeline aligns the actual generated waveform with the pinned Qwen3-ForcedAligner. It inserts 0.35 seconds of German lead-in silence before the first spoken sample, moves measured word timings by the corresponding sample count, and encodes a seekable 24 kHz mono MP3 with Xing/LAME gapless metadata. Timings contain one entry per normalized whitespace token; uncertain lexical alignment fails preparation. Audio and identity/timing metadata are imported into the immutable `audio_cache` Storage bucket before content is published. Future German words, exercises, reading passages and daily quests follow the same preparation and upload workflow. The runtime serves these prepared assets; neither students nor authoring save actions start inference, and there is no German browser or alternative-voice fallback.

Upstream model sources: [Qwen3-TTS-12Hz-1.7B-Base](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base), [Qwen3-ForcedAligner-0.6B](https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B), and [Qwen3-TTS source](https://github.com/QwenLM/Qwen3-TTS).

The local model preparer also retains the checked-in `Qwen3-TTS-LICENSE.txt`, copied from [the pinned upstream license](https://github.com/QwenLM/Qwen3-TTS/blob/022e286b98fbec7e1e916cb940cdf532cd9f488e/LICENSE), in its installation's `licenses/` directory.

The VPS speech service is now **translation languages only**. It makes no requests to cloud TTS providers or model hosting services during inference. Install-time downloads are pinned in `tts-models.json`; original model cards are stored beside deployment license notices. The installer no longer downloads a German model, and the HTTP service rejects every German request before model loading.

| Language | Voice | Dataset license | Model card |
|---|---|---|---|
| English | `en_US-ljspeech-high` | Public domain | [model card](https://huggingface.co/rhasspy/piper-voices/blob/1162a9173d0ce503555aed757976b7a9912eae4c/en/en_US/ljspeech/high/MODEL_CARD) |
| Russian | `ru_RU-denis-medium` | CC0 | [model card](https://huggingface.co/rhasspy/piper-voices/blob/1162a9173d0ce503555aed757976b7a9912eae4c/ru/ru_RU/denis/medium/MODEL_CARD) |
| Ukrainian | `uk_UA-ukrainian_tts-medium`, speaker 2 | CC0 | [model card](https://huggingface.co/rhasspy/piper-voices/blob/1162a9173d0ce503555aed757976b7a9912eae4c/uk/uk_UA/ukrainian_tts/medium/MODEL_CARD) |
| Turkish | eSpeak-NG `tr` | GPL-3.0-or-later | [eSpeak-NG](https://github.com/espeak-ng/espeak-ng) |

Piper engine: OHF-Voice/piper1-gpl 1.8.0, GPL-3.0; [source](https://github.com/OHF-Voice/piper1-gpl/tree/v1.8.0) and [license](https://github.com/OHF-Voice/piper1-gpl/blob/v1.8.0/COPYING). It runs as a separate process outside the frontend bundle. Retain notices and upstream licenses with the deployment and satisfy corresponding source obligations when distributing GPL service binaries or machine images. ONNX Runtime 1.30.0 uses the MIT license. MP3 encoding uses the operating system's FFmpeg package and libmp3lame; retain their distribution notices.

The Turkish Piper model `tr_TR-dfki-medium` is not installed because its model card specifies CC BY-NC-SA 4.0. eSpeak-NG preserves local Turkish translation speech; do not describe it as a neural voice.

Two translation Piper models are retained at most. One inference request runs at a time with one ONNX thread, bounded by 2 GB RAM and 125% CPU in the systemd template. Inputs are limited to 3,000 characters and 16 KiB JSON, WAV to 32 MiB and MP3 to 2 MiB. A separate worker process is terminated after a stalled inference deadline. The listener remains private at `127.0.0.1:9070`; keep it outside public reverse-proxy routes.

During coordinated migration, retain notices for previously installed models until their old files are removed. Complete and verify the prepared German catalog before deploying the cache-only application and translation-only daemon together. The installer does not activate or restart the service.
