# Local speech components

The running speech service makes no requests to Microsoft, cloud TTS providers, or model hosting services. Install-time downloads are pinned in `tts-models.json`; model cards are stored beside the deployment's license notices. MP3 output is generated locally by the operating system's FFmpeg package.

| Language | Voice | Model-card dataset license | Source |
|---|---|---|---|
| German | `de_DE-thorsten-high` | CC0 | https://huggingface.co/rhasspy/piper-voices/blob/1162a9173d0ce503555aed757976b7a9912eae4c/de/de_DE/thorsten/high/MODEL_CARD |
| English | `en_US-ljspeech-high` | Public domain | https://huggingface.co/rhasspy/piper-voices/blob/1162a9173d0ce503555aed757976b7a9912eae4c/en/en_US/ljspeech/high/MODEL_CARD |
| Russian | `ru_RU-denis-medium` | CC0 | https://huggingface.co/rhasspy/piper-voices/blob/1162a9173d0ce503555aed757976b7a9912eae4c/ru/ru_RU/denis/medium/MODEL_CARD |
| Ukrainian | `uk_UA-ukrainian_tts-medium`, speaker 2 (Tetiana) | CC0 | https://huggingface.co/rhasspy/piper-voices/blob/1162a9173d0ce503555aed757976b7a9912eae4c/uk/uk_UA/ukrainian_tts/medium/MODEL_CARD |
| Turkish | eSpeak-NG `tr` | eSpeak-NG distribution GPL-3.0-or-later | https://github.com/espeak-ng/espeak-ng |

Piper engine: OHF-Voice/piper1-gpl, version 1.8.0, GPL-3.0; source and license: https://github.com/OHF-Voice/piper1-gpl/tree/v1.8.0 and https://github.com/OHF-Voice/piper1-gpl/blob/v1.8.0/COPYING. It runs as a separate local process, not inside the frontend bundle. Retain these notices and upstream license files with the deployment. If distributing the service binary or a machine image, satisfy the corresponding source obligations for the distributed GPL components.

The upstream `tr_TR-dfki-medium` model is explicitly **not installed**: its model card identifies CC BY-NC-SA 4.0. Turkish remains functional through local eSpeak-NG, with a more synthetic voice than the four neural Piper voices. Do not label that Turkish voice as a neural voice in user-facing copy.

Two Piper models are retained in memory at most. One inference request is processed at a time, ONNX uses one thread, and systemd caps memory at 2 GB. A separate process is terminated after a stalled inference deadline. Inputs are limited to 3,000 characters and 16 KiB JSON, and MP3 output to 2 MiB. The HTTP listener is fixed to `127.0.0.1:9070`; keep it outside public reverse-proxy routes.
