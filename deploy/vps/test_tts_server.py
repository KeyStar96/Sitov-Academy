"""Translation service boundaries; German is never synthesized on the VPS."""
import http.client
import io
import json
import threading
import unittest
import wave
from http.server import ThreadingHTTPServer
from types import SimpleNamespace
from unittest.mock import Mock, patch
import tts_server


class SpeechBoundaryTests(unittest.TestCase):
    def test_translation_languages_and_normalization(self):
        for language in ['en', 'ru', 'uk', 'tr']:
            self.assertEqual(tts_server.validate_request(json.dumps({'text': ' Hello\nworld! ', 'language': language}).encode()), ('Hello world!', language, None))

    def test_german_and_personas_have_no_local_synthesis_route(self):
        for voice in [None, 'male', 'female', '../../model']:
            body = {'text': 'Guten Morgen!', 'language': 'de'}
            if voice is not None:
                body['voice'] = voice
            with self.subTest(voice=voice), self.assertRaisesRegex(ValueError, 'german_audio_prepared_offline'):
                tts_server.validate_request(json.dumps(body).encode())
        for language in tts_server.VOICES:
            with self.assertRaises(ValueError):
                tts_server.validate_request(json.dumps({'text': 'Hi', 'language': language, 'voice': 'male'}).encode())

    def test_input_limits_and_unknown_properties(self):
        for body in [{}, [], {'text': '', 'language': 'en'}, {'text': 'Hi', 'language': []}, {'text': 'x' * 3001, 'language': 'en'}, {'text': 'hi\x00', 'language': 'en'}, {'text': 'Hi', 'language': 'en', 'url': 'https://example.com'}]:
            with self.subTest(body=type(body).__name__), self.assertRaises(ValueError):
                tts_server.validate_request(json.dumps(body).encode())
        with self.assertRaises(ValueError):
            tts_server.validate_request(b'x' * (tts_server.MAX_BODY + 1))

    def test_wav_memory_bound(self):
        output = tts_server.BoundedBuffer()
        output.seek(tts_server.MAX_WAV)
        with self.assertRaises(ValueError):
            output.write(b'x')

    def test_loopback_http_auth_busy_and_mp3_contract(self):
        engine = Mock()
        engine.ready = True
        engine.process.is_alive.return_value = True
        engine.lock = threading.Lock()
        audio = b'ID3' + b'x' * 125
        engine.speak.return_value = (audio, None)
        handler = type('TestHandler', (tts_server.SpeechHandler,), {'engine': engine, 'token': 'test-only'})
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        def post(body, token='test-only'):
            connection = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=2)
            try:
                connection.request('POST', '/synthesize', json.dumps(body), {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token})
                response = connection.getresponse()
                return response.status, response.getheader('Content-Type'), response.getheader('X-Word-Timings'), response.read()
            finally:
                connection.close()

        try:
            self.assertEqual(post({'text': 'Hello', 'language': 'en'}, 'wrong')[0], 401)
            self.assertEqual(post({'text': 'Hallo', 'language': 'de'})[0], 400)
            engine.speak.assert_not_called()
            self.assertEqual(post({'text': 'x' * 20000, 'language': 'en'})[0], 413)
            engine.lock.acquire()
            self.assertEqual(post({'text': 'Hello', 'language': 'en'})[0], 503)
            engine.lock.release()
            self.assertEqual(post({'text': 'Hello', 'language': 'en'}), (200, 'audio/mpeg', None, audio))
            engine.speak.assert_called_once_with('Hello', 'en', None)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(2)


class TranslationSynthesisTests(unittest.TestCase):
    def test_encoding_preserves_pcm_and_ukrainian_speaker(self):
        pcm = b'\x01\x00' * 20
        voice = Mock()
        voice.config.sample_rate = 1000
        voice.synthesize.return_value = [SimpleNamespace(audio_int16_bytes=pcm)]
        voices = Mock()
        voices.get.return_value = voice
        captured = []

        def encode(arguments, **kwargs):
            captured.append((arguments, kwargs['input']))
            tts_server.Path(arguments[-1]).write_bytes(b'ID3' + b'x' * 125)

        with patch.dict('sys.modules', {'piper': SimpleNamespace(SynthesisConfig=lambda **kwargs: kwargs)}), patch.object(tts_server.subprocess, 'run', side_effect=encode):
            audio, timings = tts_server.synthesize('Hello', 'uk', voices)
        with wave.open(io.BytesIO(captured[0][1]), 'rb') as wav:
            self.assertEqual(wav.getnframes(), 20)
            self.assertEqual(wav.readframes(20), pcm)
        self.assertIsNone(timings)
        self.assertGreater(len(audio), 100)
        self.assertEqual(voice.synthesize.call_args.kwargs['syn_config']['speaker_id'], 2)
        self.assertIn('-write_xing', captured[0][0])
        voices.get.assert_called_once_with('uk')

    def test_german_never_loads_a_model(self):
        voices = Mock()
        with self.assertRaises(ValueError):
            tts_server.synthesize('Hallo', 'de', voices)
        voices.get.assert_not_called()
        with self.assertRaises(ValueError):
            tts_server.VoiceCache(tts_server.Path('/not-needed')).get('de')

    def test_model_alphabet_compatibility_and_bounded_existing_cache(self):
        phonemes = [['ɪ', 'c', '̧', ' ', 'y']]
        old_map = {'ɪ': [74], 'c': [16], 'ç': [40], ' ': [3], 'y': [37]}
        self.assertEqual(tts_server.model_phonemes(phonemes, old_map), [['ɪ', 'ç', ' ', 'y']])
        cache = tts_server.VoiceCache(tts_server.Path('/not-needed'))
        english, russian = object(), object()
        cache.voices.update({'en_US-ljspeech-high': english, 'ru_RU-denis-medium': russian})
        self.assertIs(cache.get('en'), english)
        self.assertIs(cache.get('ru'), russian)
        self.assertEqual(len(cache.voices), 2)


if __name__ == '__main__':
    unittest.main()
