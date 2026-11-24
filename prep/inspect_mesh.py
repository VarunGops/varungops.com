"""Print what a downloaded mesh holds: parts, counts, extents and connected pieces.

usage: inspect_mesh.py <file.glb | file.obj | file.zip>
"""
import json
import struct
import sys

import numpy as np

from meshio import read_glb, read_obj, components


def main(path):
    if path.endswith(".glb"):
        with open(path, "rb") as f:
            data = f.read()
        n, _ = struct.unpack_from("<II", data, 12)
        doc = json.loads(data[20:20 + n])
        print("extensions:", doc.get("extensionsUsed", []), "| images:", len(doc.get("images", [])), "| materials:", [m.get("name") for m in doc.get("materials", [])][:20])
        parts = read_glb(path)
    else:
        parts = read_obj(path)
    for name, V, F in parts:
        lab = components(F, len(V))
        sizes = np.sort(np.bincount(lab))[::-1]
        lo, hi = V.min(0), V.max(0)
        print(f"{name!r}: {len(V)} verts, {len(F)} faces, min {np.round(lo, 4).tolist()} max {np.round(hi, 4).tolist()} size {np.round(hi - lo, 4).tolist()}; {len(sizes)} pieces, largest {sizes[:5].tolist()}")


if __name__ == "__main__":
    main(sys.argv[1])
