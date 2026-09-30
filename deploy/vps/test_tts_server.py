"""No model downloads or real synthesis required for HTTP boundary tests."""
import http.client
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import Mock
from types import SimpleNamespace
import tts_server


class SpeechBoundaryTests(unittest.TestCase):
    def test_supported_languages_and_input_limits(self):
        for language in ['de','en','ru','uk','tr']:
            self.assertEqual(tts_server.validate_request(json.dumps({'text':' Hallo ','language':language}).encode()),('Hallo',language))
        self.assertEqual(tts_server.validate_request(json.dumps({'text':' Äpfel \n übermäßig süß. ','language':'de','voice':'male'}).encode()),('Äpfel übermäßig süß.','de'))
        for body in [{},[],{'text':'','language':'de'},{'text':'Hi','language':[]},{'text':'x'*3001,'language':'de'},{'text':'hi\x00','language':'de'},{'text':'Hi','language':'de','voice':[]},{'text':'Hi','language':'de','voice':'other'},{'text':'Hi','language':'de','voice':'female'},{'text':'Hi','language':'en','voice':'male'}]:
            with self.assertRaises(ValueError):
                tts_server.validate_request(json.dumps(body).encode())
        with self.assertRaises(ValueError):
            tts_server.validate_request(b'x'*(tts_server.MAX_BODY+1))

    def test_wav_memory_bound(self):
        output=tts_server.BoundedBuffer()
        output.seek(tts_server.MAX_WAV)
        with self.assertRaises(ValueError):
            output.write(b'x')

    def test_loopback_http_auth_busy_and_mp3_contract(self):
        engine=Mock()
        engine.ready=True
        engine.process.is_alive.return_value=True
        engine.lock=threading.Lock()
        audio=b'ID3'+b'x'*125
        timings=[{'start':0.04,'end':0.55}]
        engine.speak.return_value=(audio,timings)
        handler=type('TestHandler',(tts_server.SpeechHandler,),{'engine':engine,'token':'test-only'})
        server=ThreadingHTTPServer(('127.0.0.1',0),handler)
        thread=threading.Thread(target=server.serve_forever,daemon=True)
        thread.start()
        def post(body,token='test-only'):
            conn=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=2)
            try:
                conn.request('POST','/synthesize',json.dumps(body),{'Content-Type':'application/json','Authorization':'Bearer '+token})
                response=conn.getresponse()
                return response.status,response.getheader('Content-Type'),response.getheader('X-Word-Timings'),response.getheader('X-TTS-Voice'),response.read()
            finally:
                conn.close()
        try:
            self.assertEqual(post({'text':'Hallo','language':'de'},'wrong')[0],401)
            self.assertEqual(post({'text':'Hallo','language':[]})[0],400)
            self.assertEqual(post({'text':'x'*20000,'language':'de'})[0],413)
            engine.lock.acquire()
            self.assertEqual(post({'text':'Hallo','language':'de'})[0],503)
            engine.lock.release()
            status,content_type,header,profile,body=post({'text':'Hallo','language':'de'})
            self.assertEqual((status,content_type,profile,body),(200,'audio/mpeg','male',audio))
            self.assertEqual(json.loads(header),timings)
            engine.speak.assert_called_once_with('Hallo','de')
            self.assertEqual(post({'text':'Hallo','language':'de','voice':'female'})[0],400)
            engine.speak.assert_called_once_with('Hallo','de')
            engine.speak.return_value=(audio,None)
            self.assertIsNone(post({'text':'Hello','language':'en'})[2])
            self.assertIsNone(post({'text':'Hello','language':'en'})[3])
        finally:
            server.shutdown(); server.server_close(); thread.join(2)


class AlignmentTests(unittest.TestCase):
    def test_old_voice_composes_german_ich_phoneme(self):
        phonemes=[['ɪ','c','̧',' ', 'y']]
        old_map={'ɪ':[74],'c':[16],'ç':[40],' ':[3],'y':[37]}
        self.assertEqual(tts_server.model_phonemes(phonemes,old_map),[['ɪ','ç',' ','y']])
        new_map={**old_map,'̧':[140]}
        self.assertEqual(tts_server.model_phonemes(phonemes,new_map),phonemes)

    def test_sample_durations_preserve_sentence_pauses(self):
        alignments=[SimpleNamespace(phoneme=p,num_samples=n) for p,n in [('^',10),('ˈ',0),('ɛ',20),('l',30),(' ',15),('y',80),('.',100),('$',5)]]
        self.assertEqual([{key:span[key] for key in ['start','end']} for span in tts_server.phonetic_spans(alignments,100,2)],[{'start':2.1,'end':2.6},{'start':2.75,'end':3.55}])

    def test_contracted_phrase_splits_at_real_phoneme_samples(self):
        voice=Mock()
        voice.phonemize.side_effect=[[list('ɛs')],[list('ɪst')],[list('ʃøːn.')]]
        alignments=[SimpleNamespace(phoneme=p,num_samples=n) for p,n in [('^',10),('ɛ',10),('s',20),('ɪ',40),('s',20),('t',10),(' ',10),('ʃ',20),('ø',30),('ː',10),('n',20),('.',40),('$',0)]]
        spans=tts_server.phonetic_spans(alignments,100,0)
        self.assertEqual(tts_server.token_timings('Es ist schön.',voice,spans),[{'start':0.1,'end':0.4},{'start':0.4,'end':1.1},{'start':1.2,'end':2.0}])

    def test_numbers_merge_spoken_words_without_estimated_durations(self):
        voice=Mock()
        voice.phonemize.side_effect=[[list('a')],[list('abc def')],[list('g')]]
        spans=[{'start':0.1,'end':0.3},{'start':0.5,'end':0.8},{'start':0.9,'end':1.3},{'start':1.5,'end':1.6}]
        self.assertEqual(tts_server.token_timings('Äpfel 123,45 süß.',voice,spans),[{'start':0.1,'end':0.3},{'start':0.5,'end':1.3},{'start':1.5,'end':1.6}])

    def test_unmatched_alignment_never_fabricates_highlighting(self):
        voice=Mock()
        voice.phonemize.return_value=[list('one')]
        self.assertIsNone(tts_server.token_timings('one two',voice,[{'start':0.1,'end':1.0}]))

    def test_punctuation_keeps_token_index_without_highlighting(self):
        voice=Mock()
        voice.phonemize.side_effect=[[list('a')],[list('.')],[list('b')]]
        self.assertEqual(tts_server.token_timings('Äpfel . Süß',voice,[{'start':0.1,'end':0.3},{'start':0.8,'end':1.1}]),[{'start':0.1,'end':0.3},{'start':0.3,'end':0.3},{'start':0.8,'end':1.1}])

    def test_cache_keys_are_actual_models_and_remain_bounded(self):
        cache=tts_server.VoiceCache(tts_server.Path('/not-needed'))
        german,english=object(),object()
        cache.voices.update({'de_DE-thorsten-high':german,'en_US-ljspeech-high':english})
        self.assertIs(cache.get('de'),german)
        self.assertIs(cache.get('en'),english)
        self.assertEqual(len(cache.voices),2)


if __name__=='__main__':
    unittest.main()
