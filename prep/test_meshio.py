"""Tests for prep/meshio.py. Run from the repository root: python3 -m unittest prep/test_meshio.py -v"""
import json
import os
import struct
import sys
import tempfile
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from meshio import read_glb, components, cluster_decimate, weld  # noqa: E402

CUBE_V = np.array([[x, y, z] for x in (0, 1) for y in (0, 1) for z in (0, 1)], np.float32)
CUBE_F = np.array([[0, 1, 3], [0, 3, 2], [4, 6, 7], [4, 7, 5], [0, 4, 5], [0, 5, 1],
                   [2, 3, 7], [2, 7, 6], [0, 2, 6], [0, 6, 4], [1, 5, 7], [1, 7, 3]], np.uint32)
TET_V = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]], np.float32)
TET_F = np.array([[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]], np.uint32)


def write_glb(path, meshes):
    """meshes: list of (name, V, F, translation)."""
    blob, views, accs, gmeshes, nodes = b"", [], [], [], []
    for name, V, F, tr in meshes:
        for arr, target, comp, typ in ((V, 34962, 5126, "VEC3"), (F.reshape(-1), 34963, 5125, "SCALAR")):
            while len(blob) % 4:
                blob += b"\0"
            views.append({"buffer": 0, "byteOffset": len(blob), "byteLength": arr.nbytes, "target": target})
            acc = {"bufferView": len(views) - 1, "componentType": comp, "count": len(arr), "type": typ}
            if typ == "VEC3":
                acc["min"], acc["max"] = V.min(0).tolist(), V.max(0).tolist()
            accs.append(acc)
            blob += arr.tobytes()
        gmeshes.append({"name": name, "primitives": [{"attributes": {"POSITION": len(accs) - 2}, "indices": len(accs) - 1}]})
        nodes.append({"name": name, "mesh": len(gmeshes) - 1, "translation": list(tr)})
    doc = {"asset": {"version": "2.0"}, "scenes": [{"nodes": list(range(len(nodes)))}], "scene": 0, "nodes": nodes,
           "meshes": gmeshes, "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": len(blob)}]}
    js = json.dumps(doc).encode()
    js += b" " * (-len(js) % 4)
    blob += b"\0" * (-len(blob) % 4)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(blob), 0x004E4942) + blob)


def icosphere(level):
    t = (1 + 5 ** 0.5) / 2
    V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
         [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]
    V = [np.array(v, float) / np.linalg.norm(v) for v in V]
    for _ in range(level):
        mid, F2 = {}, []

        def m(a, b):
            k = (min(a, b), max(a, b))
            if k not in mid:
                p = V[a] + V[b]
                V.append(p / np.linalg.norm(p))
                mid[k] = len(V) - 1
            return mid[k]
        for a, b, c in F:
            ab, bc, ca = m(a, b), m(b, c), m(c, a)
            F2 += [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]
        F = F2
    return np.array(V, np.float32), np.array(F, np.int32)


class MeshIO(unittest.TestCase):
    def test_glb_roundtrip(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "t.glb")
            write_glb(p, [("cube", CUBE_V, CUBE_F, (0, 0, 0)), ("tet", TET_V, TET_F, (10, 0, 0))])
            parts = read_glb(p)
        self.assertEqual([n for n, _, _ in parts], ["cube", "tet"])
        self.assertEqual([len(F) for _, _, F in parts], [12, 4])
        self.assertGreaterEqual(parts[1][1][:, 0].min(), 9.99)

    def test_components(self):
        V = np.vstack([CUBE_V, TET_V + 10])
        F = np.vstack([CUBE_F, TET_F + 8]).astype(np.int32)
        self.assertEqual(len(np.unique(components(F, len(V)))), 2)

    def test_weld(self):
        # two triangles sharing an edge, stored unjoined as most scans store their seams
        V = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], np.float32)
        F = np.array([[0, 1, 2], [3, 4, 5]], np.int32)
        V2, F2 = weld(V, F, 1e-6)
        self.assertEqual(len(V2), 4)
        self.assertEqual(len(np.unique(components(F2, len(V2)))), 1)

    def test_cluster_decimate(self):
        V, F = icosphere(5)
        self.assertEqual(len(F), 20480)
        V2, F2 = cluster_decimate(V, F, 0.25)
        self.assertLess(len(F2), 2000)
        self.assertTrue(np.all((F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2])))
        self.assertLess(np.abs(np.linalg.norm(V2, axis=1) - 1).max(), 0.15)


if __name__ == "__main__":
    unittest.main()
