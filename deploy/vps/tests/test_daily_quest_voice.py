"""Persona selection and request boundary, without loading any ONNX model."""
import importlib.util
import json
from pathlib import Path
import unittest

SOURCE = Path(__file__).resolve().parents[1] / 'tts_server.py'
SPEC = importlib.util.spec_from_file_location('sitov_speech_persona', SOURCE)
SPEECH = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SPEECH)

class VoicePersonaTests(unittest.TestCase):
    def test_default_and_female_are_separate(self):
        self.assertEqual(SPEECH.validate_request(b'{"text":" Guten Morgen! ","language":"de"}'), ('Guten Morgen!', 'de', None))
        self.assertEqual(SPEECH.validate_request(b'{"text":"Guten Morgen!","language":"de","voice":"female"}'), ('Guten Morgen!', 'de', 'female'))
        cache = SPEECH.VoiceCache(Path('/nonexistent'))
        male, female = object(), object()
        cache.voices[SPEECH.VOICES['de']] = male
        cache.voices[SPEECH.FEMALE_MODEL] = female
        self.assertIs(cache.get('de'), male)
        self.assertIs(cache.get('de', 'male'), male)
        self.assertIs(cache.get('de', 'female'), female)
        self.assertEqual(SPEECH.FEMALE_SPEAKER_ID, 2)

    def test_rejects_unsupported_or_injected_profiles(self):
        for language, profile in [('en', 'female'), ('de', '../../model'), ('de', None), ('de', ['female'])]:
            with self.subTest(language=language, profile=profile):
                with self.assertRaises(ValueError):
                    SPEECH.validate_request(json.dumps({'text':'Hallo','language':language,'voice':profile}).encode())

    def test_female_model_and_alignment_are_pinned(self):
        manifest = json.loads((SOURCE.parent / 'tts-models.json').read_text())
        self.assertIn(SPEECH.FEMALE_MODEL, manifest['alignment_models'])
        files = manifest['voices'][SPEECH.FEMALE_MODEL]
        self.assertEqual(len(files), 3)
        for info in files.values():
            self.assertGreater(info['size_bytes'], 0)
            self.assertEqual(len(info['md5_digest']), 32)

if __name__ == '__main__':
    unittest.main()
