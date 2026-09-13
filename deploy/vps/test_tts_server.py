"""No model downloads or real synthesis required for HTTP boundary tests."""
import http.client
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import Mock
import tts_server


class SpeechBoundaryTests(unittest.TestCase):
    def test_supported_languages_and_input_limits(self):
        for language in ['de','en','ru','uk','tr']:
            self.assertEqual(tts_server.validate_request(json.dumps({'text':' Hallo ','language':language}).encode()),('Hallo',language))
        for body in [{},[],{'text':'','language':'de'},{'text':'Hi','language':[]},{'text':'x'*3001,'language':'de'},{'text':'hi\x00','language':'de'}]:
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
        engine.speak.return_value=audio
        handler=type('TestHandler',(tts_server.SpeechHandler,),{'engine':engine,'token':'test-only'})
        server=ThreadingHTTPServer(('127.0.0.1',0),handler)
        thread=threading.Thread(target=server.serve_forever,daemon=True)
        thread.start()
        def post(body,token='test-only'):
            conn=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=2)
            try:
                conn.request('POST','/synthesize',json.dumps(body),{'Content-Type':'application/json','Authorization':'Bearer '+token})
                response=conn.getresponse()
                return response.status,response.getheader('Content-Type'),response.read()
            finally:
                conn.close()
        try:
            self.assertEqual(post({'text':'Hallo','language':'de'},'wrong')[0],401)
            self.assertEqual(post({'text':'Hallo','language':[]})[0],400)
            self.assertEqual(post({'text':'x'*20000,'language':'de'})[0],413)
            engine.lock.acquire()
            self.assertEqual(post({'text':'Hallo','language':'de'})[0],503)
            engine.lock.release()
            self.assertEqual(post({'text':'Hallo','language':'de'}),(200,'audio/mpeg',audio))
            engine.speak.assert_called_once_with('Hallo','de')
        finally:
            server.shutdown(); server.server_close(); thread.join(2)


if __name__=='__main__':
    unittest.main()
