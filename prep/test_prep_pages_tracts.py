"""Tests for prep/prep_pages_tracts.py. Run: python3 -m unittest prep/test_prep_pages_tracts.py -v"""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prep_pages_tracts import orient  # noqa: E402


class Orient(unittest.TestCase):
    def test_front_to_back(self):
        r = np.array([[0, -40, 0], [0, 0, 0], [0, 30, 0]], float)     # starts at the back
        self.assertEqual(orient(r, axis=1, high_first=True)[0, 1], 30)
        self.assertEqual(orient(r[::-1], axis=1, high_first=True)[0, 1], 30)

    def test_left_to_right(self):
        r = np.array([[50, 0, 0], [0, 0, 0], [-50, 0, 0]], float)
        self.assertEqual(orient(r, axis=0, high_first=False)[0, 0], -50)


if __name__ == "__main__":
    unittest.main()
