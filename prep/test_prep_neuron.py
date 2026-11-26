"""Tests for prep/prep_neuron.py. Run: python3 -m unittest prep/test_prep_neuron.py -v"""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prep_neuron import upright, path_dist, resample, near_cells, smooth_dir  # noqa: E402


def frag(points, parents):
    return {"P": np.array(points, float), "parent": np.array(parents), "type": np.zeros(len(points), int), "r": np.ones(len(points))}


class Upright(unittest.TestCase):
    def test_the_apical_direction_becomes_up(self):
        soma = np.zeros(3)
        P = np.array([[400 * np.cos(a), 400 * np.sin(a), 0] for a in [0.5, 0.52, 0.55]] + [[10, -5, 0]])   # far nodes up-right at ~30°
        R = upright(P, soma)
        v = R @ np.array([np.cos(0.52), np.sin(0.52), 0])
        self.assertAlmostEqual(v[0], 0, delta=0.05); self.assertGreater(v[1], 0.99)


class PathDist(unittest.TestCase):
    def test_distance_runs_along_the_fragment_plus_the_gap_to_the_soma(self):
        a = frag([[0, 0, 0], [0, 10, 0], [0, 20, 0]], [-1, 0, 1])          # from the soma upwards
        b = frag([[30, 0, 0], [40, 0, 0], [50, 0, 0]], [-1, 0, 1])          # a separate piece, 30 µm away
        d = path_dist([a, b], np.zeros(3))
        np.testing.assert_allclose(d[0], [0, 10, 20]); np.testing.assert_allclose(d[1], [30, 40, 50])


class Resample(unittest.TestCase):
    def test_ends_and_branch_points_kept_and_spacing_under_the_step(self):
        pts = [[0, i, 0] for i in range(11)] + [[1, 5, 0], [2, 5, 0]]       # a 10 µm line with a 2 µm branch at 5
        par = [-1] + list(range(10)) + [5, 11]
        segs = resample(frag(pts, par), 3.0)
        kept = {i for s in segs for i in s}
        for must in (0, 5, 10, 12): self.assertIn(must, kept)
        P = np.array(pts, float)
        self.assertTrue(all(np.linalg.norm(P[a] - P[b]) <= 3.0 + 1e-9 for a, b in segs))


class NearCells(unittest.TestCase):
    def test_own_body_and_far_cells_left_out(self):
        C = np.array([[5, 0, 0], [100, 0, 0], [5000, 0, 0], [0, 50, 0]], float)
        keep = near_cells(C, np.zeros(3), [1000, 1000, 200], 15)
        self.assertEqual(keep.tolist(), [False, True, False, True])


class SmoothDir(unittest.TestCase):
    def test_a_jittery_branch_keeps_its_overall_direction(self):
        pts = [[(0.3 if i % 2 else -0.3), i * 1.0, 0] for i in range(30)]          # up the y axis, zigzagging in x
        d = smooth_dir(frag(pts, [-1] + list(range(29))), 29)
        self.assertGreater(d[1], 0.98)


if __name__ == "__main__":
    unittest.main()
