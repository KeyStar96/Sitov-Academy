"""Opt-in real Piper regression: TTS_ALIGNMENT_MODEL_DIR=/opt/sitov-tts/models.

Requires the pinned runtime and installer-prepared German alignment models.
The default unit run skips this suite, with no downloads or synthesis.
"""
import json
import os
import unittest
from pathlib import Path
from types import SimpleNamespace

import tts_server


MODEL_DIR = os.environ.get("TTS_ALIGNMENT_MODEL_DIR")


@unittest.skipUnless(MODEL_DIR, "set TTS_ALIGNMENT_MODEL_DIR for real Piper checks")
class PiperAlignmentIntegrationTests(unittest.TestCase):
    def test_sentence_samples_and_visible_tokens_for_both_real_speakers(self):
        from piper import SynthesisConfig

        voices = tts_server.VoiceCache(Path(MODEL_DIR))
        texts = [
            "Es ist schön. Äpfel sind gar nicht übermäßig süß.",
            "Ich habe 123,45 Euro und einen Donaudampfschifffahrtskapitän.",
            "Heute fahre ich um 8:30 Uhr mit dem Bus.",
            "Hier ist z. B. ein Beispiel, d.h. ein kurzer Satz.",
        ]
        for profile in ["male", "female"]:
            voice = voices.get("de", profile)
            for text in texts:
                with self.subTest(profile=profile, text=text):
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
        for profile in ["male", "female"]:
            voice = voices.get("de", profile)
            for entry in json.loads(catalog.read_text()):
                text = entry["text"]
                with self.subTest(profile=profile, reading=entry["title"]):
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
