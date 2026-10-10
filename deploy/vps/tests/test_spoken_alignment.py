import importlib.util
import pathlib
import copy
import unittest
spec = importlib.util.spec_from_file_location('sitov_import', pathlib.Path(__file__).resolve().parents[1] / 'import-sitov-qwen-audio.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
class SpokenAlignmentTest(unittest.TestCase):
    def test_clock_and_invalid_metadata(self):
        v = {'version': 1, 'displayText': '5:30 Uhr', 'spokenText': 'fünf Uhr dreißig', 'groups': [{'display': [0, 2], 'spoken': [0, 3]}]}
        timings = [{'start': i, 'end': i + .5} for i in range(3)]
        self.assertTrue(m.valid_spoken_alignment(v, timings, v['displayText']))
        for key, value in [('spokenText', 'fünf Uhr vierzig'), ('groups', []), ('groups', [{'display': [0, 3], 'spoken': [0, 3]}]), ('version', True)]:
            bad = copy.deepcopy(v); bad[key] = value
            self.assertFalse(m.valid_spoken_alignment(bad, timings, v['displayText']))
        for start in [float('nan'), '0', 0]:
            bad = copy.deepcopy(timings); bad[0] = {'start': start, 'end': 0}
            self.assertFalse(m.valid_spoken_alignment(v, bad, v['displayText']))
        self.assertTrue(m.valid_metadata_alignment({'wordTimings': timings}, 'eins zwei drei'))
