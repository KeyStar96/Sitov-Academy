"""Persona selection and request boundary, without loading any ONNX model."""
import importlib.util
import json
from dataclasses import dataclass
from pathlib import Path
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

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


@dataclass
class ContextChunk:
    audio_float_array: list
    phonemes: list
    phoneme_ids: list
    phoneme_id_samples: list
    phoneme_alignments: list
    _audio_int16_array: object = None
    _audio_int16_bytes: object = None


class FemaleContextTests(unittest.TestCase):
    def voice(self):
        voice = Mock()
        voice.phonemize.return_value = [list('ab!'), list('cd?')]
        voice.phonemes_to_ids.side_effect = lambda phones: [1, 0, *[identifier for _ in phones for identifier in [3, 0]], 2]
        def synthesize(raw, **_):
            phones = list(raw[2:-2])
            alignments = [SimpleNamespace(phoneme=p, num_samples=3, phoneme_ids=[3, 0] if p != '$' else [2]) for p in ['^', *phones, '$']]
            ids = [identifier for entry in alignments for identifier in entry.phoneme_ids]
            samples = [1] * len(ids)
            return [ContextChunk(list(range(len(alignments) * 3)), phones, ids, samples, alignments, 'old cached samples', 'old cached bytes')]
        voice.synthesize.side_effect = synthesize
        return voice

    def test_combines_short_sentences_and_returns_only_the_final_repetition(self):
        voice = self.voice()
        config = object()
        with patch.object(SPEECH, 'FEMALE_MIN_PHONEME_IDS', 40):
            chunk, = SPEECH.female_context_chunks('ab! cd?', voice, config)
        raw = voice.synthesize.call_args.args[0]
        self.assertEqual(raw, '[[ab! cd? ab! cd? ab! cd?]]')
        voice.synthesize.assert_called_once_with(raw, syn_config=config, include_alignments=True)
        self.assertEqual(chunk.phonemes, list('ab! cd?'))
        self.assertEqual([entry.phoneme for entry in chunk.phoneme_alignments], list('ab! cd?') + ['$'])
        self.assertEqual(len(chunk.audio_float_array), 24)
        # The first retained sample is measured from the model's actual spans.
        self.assertEqual(chunk.audio_float_array[0], (1 + 2 * 8) * 3)
        self.assertIsNone(chunk._audio_int16_array)
        self.assertIsNone(chunk._audio_int16_bytes)
        spans = SPEECH.phonetic_spans(chunk.phoneme_alignments, 3, 0)
        self.assertEqual([{key: item[key] for key in ['start', 'end']} for item in spans], [{'start': 0, 'end': 2}, {'start': 4, 'end': 6}])

    def test_long_context_is_not_repeated_but_still_bypasses_sentence_splitting(self):
        voice = self.voice()
        with patch.object(SPEECH, 'FEMALE_MIN_PHONEME_IDS', 10):
            chunk, = SPEECH.female_context_chunks('ab! cd?', voice, object())
        self.assertEqual(voice.synthesize.call_args.args[0], '[[ab! cd?]]')
        self.assertEqual(chunk.audio_float_array[0], 3)
        self.assertEqual(len(chunk.audio_float_array), 24)

    def test_missing_or_inaccurate_alignment_never_plays_the_repetitions(self):
        for broken in ['missing', 'wrong_samples', 'wrong_phoneme', 'split']:
            with self.subTest(broken=broken):
                voice = self.voice()
                make = voice.synthesize.side_effect
                def synthesize(raw, **options):
                    chunks = make(raw, **options)
                    if broken == 'missing': chunks[0].phoneme_alignments = None
                    elif broken == 'wrong_samples': chunks[0].phoneme_alignments[0].num_samples = 100
                    elif broken == 'wrong_phoneme': chunks[0].phoneme_alignments[0].phoneme = 'x'
                    else: chunks.append(chunks[0])
                    return chunks
                voice.synthesize.side_effect = synthesize
                with self.assertRaisesRegex(RuntimeError, 'context_alignment_required'):
                    list(SPEECH.female_context_chunks('ab! cd?', voice, object()))

    def test_empty_phonemes_fail_without_entering_inference(self):
        voice = self.voice()
        voice.phonemize.return_value = []
        with self.assertRaisesRegex(ValueError, 'invalid_phonemes'):
            list(SPEECH.female_context_chunks('', voice, object()))
        voice.synthesize.assert_not_called()

if __name__ == '__main__':
    unittest.main()
