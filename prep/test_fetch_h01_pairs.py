"""Tests for prep/fetch_h01_pairs.py (no network). Run: python3 -m unittest prep/test_fetch_h01_pairs.py -v"""
import os
import struct
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_h01_pairs import decode_lines, connections  # noqa: E402


class Decode(unittest.TestCase):
    def test_line_annotations_with_their_ids(self):
        # two LINE annotations: pointA (3 float32), pointB (3 float32), a uint32 'type' property; then their uint64 ids
        body = struct.pack('<Q', 2)
        body += struct.pack('<6fI', 1, 2, 3, 4, 5, 6, 1) + struct.pack('<6fI', 7, 8, 9, 10, 11, 12, 2)
        body += struct.pack('<2Q', 111, 222)
        got = decode_lines(body)
        self.assertEqual([g['id'] for g in got], [111, 222])
        self.assertEqual(got[0]['a'], (1, 2, 3)); self.assertEqual(got[1]['b'], (10, 11, 12)); self.assertEqual(got[1]['type'], 2)


class Connect(unittest.TestCase):
    def test_a_synapse_out_of_one_cell_and_into_another_is_a_connection(self):
        out = {1: [{'id': 5, 'a': (0, 0, 0), 'b': (1, 1, 1), 'type': 1}, {'id': 6, 'a': (0, 0, 0), 'b': (0, 0, 0), 'type': 1}]}
        inc = {2: [{'id': 5, 'a': (0, 0, 0), 'b': (1, 1, 1), 'type': 1}], 1: [{'id': 9, 'a': (0, 0, 0), 'b': (0, 0, 0), 'type': 2}]}
        c = connections(out, inc)
        self.assertEqual(c, [{'pre': 1, 'post': 2, 'synapses': [5]}])


if __name__ == "__main__":
    unittest.main()
