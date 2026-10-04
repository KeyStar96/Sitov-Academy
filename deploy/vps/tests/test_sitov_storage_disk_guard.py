import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('sitov_disk', Path(__file__).resolve().parents[1] / 'sitov-storage-disk-guard.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DiskReserveTest(unittest.TestCase):
    def test_reserve_and_headroom_prevent_reopening_writes_on_small_fluctuations(self):
        gib = module.GIB
        self.assertTrue(module.should_pause(232 * gib, 14 * gib))
        self.assertFalse(module.should_pause(232 * gib, 19 * gib))
        self.assertTrue(module.should_pause(232 * gib, 19 * gib, True))
        self.assertFalse(module.should_pause(232 * gib, 25 * gib, True))
        self.assertTrue(module.should_pause(1000 * gib, 50 * gib))


if __name__ == '__main__': unittest.main()
