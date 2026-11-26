"""Tests for prep/fetch_h01_cells.py (no network). Run: python3 -m unittest prep/test_fetch_h01_cells.py -v"""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_h01_cells import centres  # noqa: E402


class Centres(unittest.TestCase):
    def test_each_label_gives_its_centre_in_micrometres_and_its_size(self):
        a = np.zeros((10, 10, 4), np.uint64)
        a[1:3, 1:3, 0:2] = 7          # 8 voxels, centre at voxel (2, 2, 1)
        a[6, 8, 3] = 99               # 1 voxel at (6.5, 8.5, 3.5)
        ids, c, n = centres(a, [0, 0, 0], [4096, 4096, 4224])
        self.assertEqual(ids.tolist(), [7, 99])
        self.assertEqual(n.tolist(), [8, 1])
        np.testing.assert_allclose(c[0], [2 * 4.096, 2 * 4.096, 1 * 4.224], rtol=1e-9)
        np.testing.assert_allclose(c[1], [6.5 * 4.096, 8.5 * 4.096, 3.5 * 4.224], rtol=1e-9)

    def test_the_volume_origin_is_added(self):
        a = np.zeros((2, 2, 2), np.uint64); a[0, 0, 0] = 1
        _, c, _ = centres(a, [10, 0, 0], [1000, 1000, 1000])
        np.testing.assert_allclose(c[0], [10.5, 0.5, 0.5])


if __name__ == "__main__":
    unittest.main()
