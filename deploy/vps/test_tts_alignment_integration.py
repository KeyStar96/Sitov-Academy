"""Opt-in real Piper regression: TTS_ALIGNMENT_MODEL_DIR=/opt/sitov-tts/models.

Requires the pinned runtime and installer-prepared German alignment models.
The default unit run skips this suite, with no downloads or synthesis.
"""
import json
import os
import re
import unittest
from pathlib import Path
from types import SimpleNamespace

import tts_server


MODEL_DIR = os.environ.get("TTS_ALIGNMENT_MODEL_DIR")
ASR_MODEL_DIR = os.environ.get("TTS_ASR_MODEL_DIR")
FEMALE_TEXTS = [
    "Guten Morgen! Was möchten Sie?",
    "das Brötchen",
    "Guten Morgen! Was möchten Sie? Ich hätte gern ein Brötchen und einen Kaffee, bitte.",
]


@unittest.skipUnless(MODEL_DIR, "set TTS_ALIGNMENT_MODEL_DIR for real Piper checks")
class PiperAlignmentIntegrationTests(unittest.TestCase):
    def test_female_daily_phrases_keep_only_requested_words_and_sample_timings(self):
        from piper import SynthesisConfig

        voice = tts_server.VoiceCache(Path(MODEL_DIR)).get("de", "female")
        for text in FEMALE_TEXTS:
            with self.subTest(text=text):
                chunk, = tts_server.female_context_chunks(text, voice, SynthesisConfig(length_scale=1.0, noise_scale=0.333, noise_w_scale=0.333, speaker_id=tts_server.FEMALE_SPEAKER_ID))
                self.assertEqual(sum(int(entry.num_samples) for entry in chunk.phoneme_alignments), len(chunk.audio_int16_array))
                self.assertGreater(len(chunk.audio_int16_array) / chunk.sample_rate, 0.2)
                self.assertLess(len(chunk.audio_int16_array) / chunk.sample_rate, 10)
                expected = " ".join("".join(sentence) for sentence in voice.phonemize(text))
                self.assertEqual("".join(chunk.phonemes), expected)
                spans = tts_server.phonetic_spans(chunk.phoneme_alignments, chunk.sample_rate, 0)
                timings = tts_server.token_timings(text, voice, spans)
                self.assertIsNotNone(timings)
                self.assertEqual(len(timings), len(text.split()))
                self.assertLessEqual(timings[-1]['end'], len(chunk.audio_int16_array) / chunk.sample_rate)

    @unittest.skipUnless(ASR_MODEL_DIR, "set TTS_ASR_MODEL_DIR for offline intelligibility checks")
    def test_female_short_and_long_audio_are_intelligible_to_offline_asr(self):
        # Optional QA dependency, never part of the production speech runtime.
        import numpy as np
        from faster_whisper import WhisperModel
        from piper import SynthesisConfig

        model = WhisperModel(ASR_MODEL_DIR, device="cpu", compute_type="int8", cpu_threads=2, local_files_only=True)
        voice = tts_server.VoiceCache(Path(MODEL_DIR)).get("de", "female")
        for text in FEMALE_TEXTS:
            with self.subTest(text=text):
                chunk, = tts_server.female_context_chunks(text, voice, SynthesisConfig(length_scale=1.0, noise_scale=0.333, noise_w_scale=0.333, speaker_id=tts_server.FEMALE_SPEAKER_ID))
                audio = chunk.audio_float_array
                resampled = np.interp(np.arange(0, len(audio), chunk.sample_rate / 16000), np.arange(len(audio)), audio).astype(np.float32)
                segments, _ = model.transcribe(resampled, language="de", beam_size=5, vad_filter=False)
                actual = re.findall(r"\w+", " ".join(segment.text for segment in segments).lower())
                expected = re.findall(r"\w+", text.lower())
                # Minor ASR spelling errors are tolerated; garbling, missing
                # phrases and audible repetitions fail the word error check.
                row = list(range(len(actual) + 1))
                for index, word in enumerate(expected, 1):
                    previous, row = row, [index]
                    for other_index, other in enumerate(actual, 1):
                        row.append(min(row[-1] + 1, previous[other_index] + 1, previous[other_index - 1] + (word != other)))
                self.assertLessEqual(row[-1] / len(expected), 0.2, f"Unexpected speech transcript: {' '.join(actual)}")

    def test_sentence_samples_and_visible_tokens_for_fixed_real_speaker(self):
        from piper import SynthesisConfig

        voices = tts_server.VoiceCache(Path(MODEL_DIR))
        texts = [
            "Es ist schön. Äpfel sind gar nicht übermäßig süß.",
            "Ich habe 123,45 Euro und einen Donaudampfschifffahrtskapitän.",
            "Heute fahre ich um 8:30 Uhr mit dem Bus.",
            "Hier ist z. B. ein Beispiel, d.h. ein kurzer Satz.",
        ]
        voice = voices.get("de")
        for text in texts:
            with self.subTest(text=text):
                samples = 0
                spans = []
                for chunk in voice.synthesize(text, syn_config=SynthesisConfig(length_scale=1.0), include_alignments=True):
                    self.assertTrue(chunk.phoneme_alignments)
                    self.assertEqual(sum(int(item.num_samples) for item in chunk.phoneme_alignments), len(chunk.audio_int16_array))
                    spans.extend(tts_server.phonetic_spans(chunk.phoneme_alignments, chunk.sample_rate, samples / chunk.sample_rate))
                    samples += len(chunk.audio_int16_array)
                timings = tts_server.token_timings(text, voice, spans)
                self.assertIsNotNone(timings)
                self.assertEqual(len(timings), len(text.split()))
                previous = 0
                for item in timings:
                    self.assertGreaterEqual(item["start"], previous)
                    self.assertGreater(item["end"], item["start"])
                    self.assertLessEqual(item["end"], samples / voice.config.sample_rate)
                    previous = item["end"]

    def test_entire_seeded_reading_catalog_maps_to_phonetic_boundaries(self):
        voices = tts_server.VoiceCache(Path(MODEL_DIR))
        catalog = Path(__file__).resolve().parents[2] / "supabase/seeds/pronunciation-reading-2026.json"
        if not catalog.exists():
            self.skipTest("reading seed is not present in this service-only install")
        voice = voices.get("de")
        for entry in json.loads(catalog.read_text()):
            text = entry["text"]
            with self.subTest(reading=entry["title"]):
                spans = []
                offset = 0
                for sentence in voice.phonemize(text):
                    alignments = [SimpleNamespace(phoneme=phoneme,num_samples=1) for phoneme in ['^',*sentence,'$']]
                    spans.extend(tts_server.phonetic_spans(alignments,100,offset))
                    offset += len(alignments) / 100
                timings = tts_server.token_timings(text,voice,spans)
                self.assertIsNotNone(timings)
                self.assertEqual(len(timings),len(text.split()))


if __name__ == "__main__":
    unittest.main()
