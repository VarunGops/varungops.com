"""Tests for prep/fetch_h01_partner.py (no network). Run: python3 -m unittest prep/test_fetch_h01_partner.py -v"""
import os
import struct
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_h01_partner import decode_one, decode_skeleton  # noqa: E402


class One(unittest.TestCase):
    def test_a_synapse_with_its_pre_and_post_cells(self):
        body = struct.pack('<6fI', 1, 2, 3, 4, 5, 6, 1) + struct.pack('<I', 1) + struct.pack('<Q', 77) + struct.pack('<I', 2) + struct.pack('<2Q', 88, 99)
        s = decode_one(body)
        self.assertEqual(s['a'], (1, 2, 3)); self.assertEqual(s['pre'], [77]); self.assertEqual(s['post'], [88, 99])


class Skeleton(unittest.TestCase):
    def test_vertices_edges_and_radius(self):
        V = np.array([[0, 0, 0], [1000, 0, 0], [1000, 2000, 0]], np.float32); E = np.array([[0, 1], [1, 2]], np.uint32); R = np.array([5, 6, 7], np.float32)
        body = struct.pack('<II', 3, 2) + V.tobytes() + E.tobytes() + R.tobytes()
        v, e, r = decode_skeleton(body)
        np.testing.assert_allclose(v, V); self.assertEqual(e.tolist(), E.tolist()); np.testing.assert_allclose(r, R)


if __name__ == "__main__":
    unittest.main()
