"""Tests for prep/prep_lungs.py. Run from the repository root: python3 -m unittest prep/test_prep_lungs.py -v"""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prep_lungs import classify, outline_loops  # noqa: E402


class Classify(unittest.TestCase):
    def test_cartilage_is_left_out(self):
        self.assertIsNone(classify("VH_F_cartilage_of_tertiary_bronchus_L"))
        self.assertIsNone(classify("VH_F_cartilage_of_lobar_bronchus_R"))

    def test_segments_and_hilum_are_the_surface(self):
        self.assertEqual(classify("VH_F_right_apical_bronchopulmonary_segment"), 0)
        self.assertEqual(classify("VH_F_right_lateral_bronchopulmonary_segmennt"), 0)   # the atlas's own spelling
        self.assertEqual(classify("VH_F_right_anterior_bronchopulmonary_segm"), 0)
        self.assertEqual(classify("VH_F_hilum_lower_R"), 0)

    def test_bronchi_are_bronchi(self):
        self.assertEqual(classify("VH_F_left_superior_lobar_bronchus"), 1)
        self.assertEqual(classify("VH_F_left_lingula_inferior_bronchi"), 1)

    def test_an_unknown_part_stops_the_build(self):
        with self.assertRaises(SystemExit):
            classify("VH_F_trachea")


class Outline(unittest.TestCase):
    def test_two_discs_give_two_closed_loops_on_their_edges(self):
        yy, xx = np.mgrid[0:120, 0:200]
        mask = (((xx - 50) ** 2 + (yy - 60) ** 2) < 30 ** 2) | (((xx - 150) ** 2 + (yy - 60) ** 2) < 30 ** 2)
        loops = outline_loops(mask.astype(float))
        self.assertEqual(len(loops), 2)
        for L in loops:
            c = np.array([50, 60]) if L[:, 0].mean() < 100 else np.array([150, 60])
            self.assertTrue(np.all(np.abs(np.linalg.norm(L - c, axis=1) - 30) < 1.5))


if __name__ == "__main__":
    unittest.main()
