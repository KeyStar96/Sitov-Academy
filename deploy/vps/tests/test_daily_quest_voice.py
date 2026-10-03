"""The VPS translation runtime contains no German/persona inference model."""
import importlib.util
import json
from pathlib import Path
import unittest

SOURCE = Path(__file__).resolve().parents[1] / 'tts_server.py'
SPEC = importlib.util.spec_from_file_location('sitov_translation_speech', SOURCE)
SPEECH = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SPEECH)


class PreparedGermanVoiceTests(unittest.TestCase):
    def test_german_is_not_a_runtime_language_or_download(self):
        self.assertNotIn('de', SPEECH.VOICES)
        manifest = json.loads((SOURCE.parent / 'tts-models.json').read_text())
        self.assertFalse(any(name.startswith('de_DE-') for name in manifest['voices']))
        self.assertNotIn('alignment_models', manifest)

    def test_translation_models_stay_pinned(self):
        manifest = json.loads((SOURCE.parent / 'tts-models.json').read_text())
        self.assertEqual(len(manifest['revision']), 40)
        self.assertEqual(set(manifest['voices']), {SPEECH.VOICES[language] for language in ['en', 'ru', 'uk']})
        for files in manifest['voices'].values():
            self.assertEqual(len(files), 3)
            for info in files.values():
                self.assertGreater(info['size_bytes'], 0)
                self.assertEqual(len(info['md5_digest']), 32)

    def test_every_german_request_is_rejected_before_inference(self):
        for voice in [None, 'male', 'female']:
            body = {'text': 'Guten Morgen!', 'language': 'de'}
            if voice is not None:
                body['voice'] = voice
            with self.assertRaisesRegex(ValueError, 'german_audio_prepared_offline'):
                SPEECH.validate_request(json.dumps(body).encode())


if __name__ == '__main__':
    unittest.main()
