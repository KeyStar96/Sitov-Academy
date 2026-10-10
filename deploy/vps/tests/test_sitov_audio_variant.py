"""Offline exact variant identity and immutable-import rejection checks."""
import copy, importlib.util, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('sitov_import_tests',Path(__file__).with_name('test_import_sitov_qwen_audio.py'))
original=importlib.util.module_from_spec(spec);spec.loader.exec_module(original)
m=original.MODULE
GOLDEN={'sind': 'sitov-qwen-v1/de/fecd6cec0867225c8887edf4ad57bd71e11318983f7c5ea91e1f23dac3e5be61.mp3', 'stehe': 'sitov-qwen-v1/de/8f6a6116076d1d0afc06239850e75f03bd1cf75d54e7630b61da2bdd4669c714.mp3', 'wollte': 'sitov-qwen-v1/de/a247eb64e156ac01dadbb76db20637e6570311f93fb1b0dad063ea5348e4195e.mp3', 'des': 'sitov-qwen-v1/de/89137d72d3f65e8d2589e0f9532beeb322a2805aaeaf8030d9684bae2b0921a2.mp3', 'ihrer': 'sitov-qwen-v1/de/3829dc7759b63983b26570c2832515852424e86ad266b591abd8a89098afece0.mp3', 'meiste': 'sitov-qwen-v1/de/88b6999624c9f3cde59987001dfd4980545eaf5720e271da307b1816a251a381.mp3'}
class SitovAudioVariantTests(unittest.TestCase):
 def setUp(self):
  self.fixture=original.ImportSitovQwenAudioTests('runTest');self.fixture.setUp()
  self.profile=original.PROFILE;self.fingerprint=m.digest(m.compact(self.profile).encode())
 def tearDown(self):self.fixture.tearDown()
 def test_six_keys_normalization_and_old_path_rejection(self):
  for text,path in GOLDEN.items():
   self.assertEqual(m.expected_path(text,self.profile,self.fingerprint),path)
   self.assertEqual(m.expected_path(' \u00a0'+text+'\n ',self.profile,self.fingerprint),path)
  manifest=self.fixture.bundle(tuple(GOLDEN));self.assertEqual(len(m.validate_bundle(self.fixture.root,self.profile)),6)
  manifest['rows'][0]['cachePath']='sitov-qwen-v1/de/f688be4502c52ae64c4468fc23e9f29b1f451a7e432fac020e386ffd5f0c0d6f.mp3'
  self.fixture.write_manifest(manifest)
  with self.assertRaisesRegex(ValueError,'address mismatch'):m.validate_bundle(self.fixture.root,self.profile)
 def test_wrong_or_caller_selected_variant_and_missing_asset_fail_closed(self):
  manifest=self.fixture.bundle(('sind',));manifest['rows'][0]['variant']='other';self.fixture.write_manifest(manifest)
  with self.assertRaisesRegex(ValueError,'Caller-selected'):m.validate_bundle(self.fixture.root,self.profile)
  manifest=self.fixture.bundle(('sind',));(self.fixture.root/manifest['rows'][0]['cachePath']).unlink()
  with self.assertRaises(FileNotFoundError):m.validate_bundle(self.fixture.root,self.profile)
 def test_registry_tamper_fails_closed_and_upload_never_upserts(self):
  registry=json.loads(m.VARIANTS_PATH.read_text());registry['variants'][0]['variant']='other'
  path=self.fixture.root/'variants.json';path.write_text(json.dumps(registry))
  with patch.object(m,'VARIANTS_PATH',path),self.assertRaisesRegex(ValueError,'registry'):m.expected_path('sind',self.profile,self.fingerprint)
  self.assertEqual(m.storage_upload(b'ID3',{})[1]['x-upsert'],'false')
 def test_unlisted_text_keeps_old_preimage(self):
  text='Guten Morgen.';identity={'text':text,'voice':self.profile['voice'],'rate':'qwen-native-1-lufs-18-aligned-v1','format':'audio-24khz-48kbitrate-mono-mp3','leadIn':.35,'profile':self.fingerprint}
  self.assertEqual(m.expected_path(text,self.profile,self.fingerprint),'sitov-qwen-v1/de/'+m.digest(m.compact(identity,ordered=True).encode())+'.mp3')
if __name__=='__main__':unittest.main()
