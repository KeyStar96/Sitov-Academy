# Local speech components

The running speech service makes no requests to Microsoft, cloud TTS providers, or model hosting services. Install-time downloads are pinned in `tts-models.json`; model cards are stored beside the deployment's license notices. MP3 output is generated locally by the operating system's FFmpeg package.

| Language | Voice | Model-card dataset license | Source |
|---|---|---|---|
| German, male profile | `de_DE-thorsten-high` | CC0 | https://huggingface.co/rhasspy/piper-voices/blob/1162a9173d0ce503555aed757976b7a9912eae4c/de/de_DE/thorsten/high/MODEL_CARD |
| German, female profile | `de_DE-kerstin-low` | CC0 | https://huggingface.co/rhasspy/piper-voices/blob/1162a9173d0ce503555aed757976b7a9912eae4c/de/de_DE/kerstin/low/MODEL_CARD |
| English | `en_US-ljspeech-high` | Public domain | https://huggingface.co/rhasspy/piper-voices/blob/1162a9173d0ce503555aed757976b7a9912eae4c/en/en_US/ljspeech/high/MODEL_CARD |
| Russian | `ru_RU-denis-medium` | CC0 | https://huggingface.co/rhasspy/piper-voices/blob/1162a9173d0ce503555aed757976b7a9912eae4c/ru/ru_RU/denis/medium/MODEL_CARD |
| Ukrainian | `uk_UA-ukrainian_tts-medium`, speaker 2 (Tetiana) | CC0 | https://huggingface.co/rhasspy/piper-voices/blob/1162a9173d0ce503555aed757976b7a9912eae4c/uk/uk_UA/ukrainian_tts/medium/MODEL_CARD |
| Turkish | eSpeak-NG `tr` | eSpeak-NG distribution GPL-3.0-or-later | https://github.com/espeak-ng/espeak-ng |

Piper engine: OHF-Voice/piper1-gpl, version 1.8.0, GPL-3.0; source and license: https://github.com/OHF-Voice/piper1-gpl/tree/v1.8.0 and https://github.com/OHF-Voice/piper1-gpl/blob/v1.8.0/COPYING. It runs as a separate local process, not inside the frontend bundle. Retain these notices and upstream license files with the deployment. If distributing the service binary or a machine image, satisfy the corresponding source obligations for the distributed GPL components.

The upstream `tr_TR-dfki-medium` model is explicitly **not installed**: its model card identifies CC BY-NC-SA 4.0. Turkish remains functional through local eSpeak-NG, with a more synthetic voice than the four neural Piper voices. Do not label that Turkish voice as a neural voice in user-facing copy.

Kerstin is a native female German speaker (dataset description: https://github.com/rhasspy/dataset-voice-kerstin). Both German voice datasets are CC0 and allow commercial use. Kerstin is the upstream 16 kHz low-quality model; Thorsten is the upstream high-quality model. Voice selection changes the actual model, rather than pitch-shifting one speaker.

`piper-local-v2` synthesizes German at `length_scale=1.0` in full sentences and exposes Piper 1.8.0's VITS phoneme sample counts. The installer uses pinned ONNX 1.23.1 (Apache-2.0, https://github.com/onnx/onnx) to create separate `.aligned.onnx` models; original pinned files remain unchanged. This adds a duration output to the existing model graph and does not change its waveform. No ASR, cloud alignment, or extra inference model is used. Upstream alignment API: https://github.com/OHF-Voice/piper1-gpl/blob/v1.8.0/docs/ALIGNMENTS.md.

`POST /synthesize` retains the binary `audio/mpeg` response. German requests may provide `voice: "male"` or `voice: "female"` (default: male). `X-TTS-Voice` identifies the selected profile, and `X-Word-Timings` contains an ASCII JSON array of `{ "start": seconds, "end": seconds }`, indexed by normalized whitespace tokens. Token phonemization maps expanded numbers to the same visible token; all durations come from the sentence's generated samples. Timings are omitted if lexical expansion cannot be mapped confidently. Other languages retain their existing voices. Seekable MP3 encoding writes Xing/LAME gapless metadata to avoid encoder priming shifting the timing origin. Playback speeds are applied by the client with pitch preservation, keeping these media-time boundaries valid at every speed.

Two Piper models are retained in memory at most. One inference request is processed at a time, ONNX uses one thread, and systemd caps memory at 2 GB. A separate process is terminated after a stalled inference deadline. Inputs are limited to 3,000 characters and 16 KiB JSON, and MP3 output to 2 MiB. The HTTP listener is fixed to `127.0.0.1:9070`; keep it outside public reverse-proxy routes.
