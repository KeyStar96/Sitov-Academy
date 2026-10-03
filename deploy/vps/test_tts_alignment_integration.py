"""Opt-in translation synthesis: set TTS_TRANSLATION_MODEL_DIR to pinned models.

The default run downloads nothing and skips real synthesis. German is prepared
by the separate Qwen authoring pipeline and has no VPS inference model.
"""
import os
from pathlib import Path
import unittest
import tts_server

MODEL_DIR = os.environ.get('TTS_TRANSLATION_MODEL_DIR')


@unittest.skipUnless(MODEL_DIR, 'set TTS_TRANSLATION_MODEL_DIR for real translation checks')
class PiperTranslationIntegrationTests(unittest.TestCase):
    def test_three_translation_voices_generate_bounded_mp3_without_fake_timings(self):
        voices = tts_server.VoiceCache(Path(MODEL_DIR))
        for language, text in [('en', 'Good morning. How can I help you?'), ('ru', 'Доброе утро. Чем я могу вам помочь?'), ('uk', 'Доброго ранку. Чим я можу вам допомогти?')]:
            with self.subTest(language=language):
                audio, timings = tts_server.synthesize(text, language, voices)
                self.assertGreater(len(audio), 100)
                self.assertLessEqual(len(audio), tts_server.MAX_AUDIO)
                self.assertIsNone(timings)
                self.assertLessEqual(len(voices.voices), 2)


if __name__ == '__main__':
    unittest.main()
