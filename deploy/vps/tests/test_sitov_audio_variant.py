"""Offline exact variant identity and immutable-import rejection checks."""
import copy, importlib.util, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('sitov_import_tests',Path(__file__).with_name('test_import_sitov_qwen_audio.py'))
original=importlib.util.module_from_spec(spec);spec.loader.exec_module(original)
m=original.MODULE
GOLDEN={'sind': 'sitov-qwen-v1/de/fecd6cec0867225c8887edf4ad57bd71e11318983f7c5ea91e1f23dac3e5be61.mp3', 'stehe': 'sitov-qwen-v1/de/8f6a6116076d1d0afc06239850e75f03bd1cf75d54e7630b61da2bdd4669c714.mp3', 'wollte': 'sitov-qwen-v1/de/a247eb64e156ac01dadbb76db20637e6570311f93fb1b0dad063ea5348e4195e.mp3', 'des': 'sitov-qwen-v1/de/89137d72d3f65e8d2589e0f9532beeb322a2805aaeaf8030d9684bae2b0921a2.mp3', 'ihrer': 'sitov-qwen-v1/de/3829dc7759b63983b26570c2832515852424e86ad266b591abd8a89098afece0.mp3', 'meiste': 'sitov-qwen-v1/de/88b6999624c9f3cde59987001dfd4980545eaf5720e271da307b1816a251a381.mp3', 'esst': 'sitov-qwen-v1/de/9b12d09d782e799cc1c8319efea2cd0b654ad91171fc9f411b20ad6a08fd8ece.mp3'}
class SitovAudioVariantTests(unittest.TestCase):
 def setUp(self):
  self.fixture=original.ImportSitovQwenAudioTests('runTest');self.fixture.setUp()
  self.profile=original.PROFILE;self.fingerprint=m.digest(m.compact(self.profile).encode())
 def tearDown(self):self.fixture.tearDown()
 def test_seven_keys_normalization_and_old_path_rejection(self):
  for text,path in GOLDEN.items():
   self.assertEqual(m.expected_path(text,self.profile,self.fingerprint),path)
   self.assertEqual(m.expected_path(' \u00a0'+text+'\n ',self.profile,self.fingerprint),path)
  manifest=self.fixture.bundle(tuple(GOLDEN));self.assertEqual(len(m.validate_bundle(self.fixture.root,self.profile)),7)
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
 def test_esst_old_path_and_eighth_registry_entry_are_rejected(self):
  manifest=self.fixture.bundle(('esst',));manifest['rows'][0]['cachePath']='sitov-qwen-v1/de/83bf3f87a1183ee23346b809d820d3bdf332b5b10cd3d8871965728c775ae3e6.mp3';self.fixture.write_manifest(manifest)
  with self.assertRaisesRegex(ValueError,'address mismatch'):m.validate_bundle(self.fixture.root,self.profile)
  registry=json.loads(m.VARIANTS_PATH.read_text());registry['variants'].append({'text':'isst','textSha256':m.digest(b'isst'),'variant':'sitov-audio-repair-20261010-v1'})
  path=self.fixture.root/'variants8.json';path.write_text(json.dumps(registry))
  with patch.object(m,'VARIANTS_PATH',path),self.assertRaisesRegex(ValueError,'registry'):m.expected_path('esst',self.profile,self.fingerprint)
 def test_six_final_replacements_are_distinct_and_version_bound(self):
  goldens={'Bist': 'sitov-qwen-v1/de/ebe84648eaa00f666d279f9a07dfa4d3599ee501d9ba885eb84e59f97809717c.mp3', 'einkauft': 'sitov-qwen-v1/de/26688b4fbe237c8bd5fee391d5d5c70befead8107748161876cf7eeec04b4fd8.mp3', 'Marchenko': 'sitov-qwen-v1/de/649273b0355aabad5b9bc97bb5fa2c3eae5479dcb2de02ed7fb52719d3f6ef1b.mp3', 'Lwiw': 'sitov-qwen-v1/de/a36480b1b4f791fc83d1c63fa9c2c5b4ec83c65a2cd286c08cd4afed3336b466.mp3', 'sieh': 'sitov-qwen-v1/de/073548da4a34637c8c6aa787c2a170e45046e2cc90076aa7cc685b86cbff9e9b.mp3', 'neuen': 'sitov-qwen-v1/de/5063928dad7bd5949c905fcae811b712bd68b1cabf4bb1529cd9681cad9571d7.mp3'}
  self.assertEqual(len(m.approved_variants()),13)
  for text,expected in goldens.items():
   self.assertEqual(m.expected_path(text,self.profile,self.fingerprint),expected)
   self.assertEqual(m.expected_path(' \u00a0'+text+'\n ',self.profile,self.fingerprint),expected)
   old={'text':text,'voice':self.profile['voice'],'rate':'qwen-native-1-lufs-18-aligned-v1','format':'audio-24khz-48kbitrate-mono-mp3','leadIn':.35,'profile':self.fingerprint}
   self.assertNotEqual(expected,'sitov-qwen-v1/de/'+m.digest(m.compact(old,ordered=True).encode())+'.mp3')
  manifest=self.fixture.bundle(tuple(goldens));self.assertEqual(len(m.validate_bundle(self.fixture.root,self.profile)),6)
  registry=json.loads(m.VARIANTS_PATH.read_text());next(r for r in registry['variants'] if r['text']=='neuen')['variant']='sitov-audio-repair-20261010-v1'
  path=self.fixture.root/'wrong-final-version.json';path.write_text(json.dumps(registry))
  with patch.object(m,'VARIANTS_PATH',path),self.assertRaisesRegex(ValueError,'registry'):m.expected_path('neuen',self.profile,self.fingerprint)
if __name__=='__main__':unittest.main()
