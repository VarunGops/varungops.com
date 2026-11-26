"""Tests for prep/prep_pair.py. Run: python3 -m unittest prep/test_prep_pair.py -v"""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prep_pair import skeleton_frags  # noqa: E402


class SkeletonFrags(unittest.TestCase):
    def test_a_tree_from_the_cell_body_and_each_loose_piece_its_own_root(self):
        V = np.array([[0, 0, 0], [0, 10, 0], [0, 20, 0], [10, 0, 0], [100, 0, 0], [110, 0, 0]], float)
        E = np.array([[0, 1], [1, 2], [0, 3], [4, 5]])
        R = np.array([5, 1, 1, 1, 1, 1], float)
        F = skeleton_frags(V, E, R)
        self.assertEqual(len(F), 2)                                   # the cell, and one loose piece
        main = F[0]
        self.assertEqual(int(np.sum(main["parent"] < 0)), 1)          # one root ...
        self.assertTrue(np.allclose(main["P"][main["parent"] < 0][0], [0, 0, 0]))   # ... at the cell body (the widest point)
        self.assertEqual(len(main["P"]) + len(F[1]["P"]), 6)


if __name__ == "__main__":
    unittest.main()
