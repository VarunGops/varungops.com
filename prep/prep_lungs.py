"""Build the lungs for varungops.com from the Human Reference Atlas 3D reference organs.

Input (never committed): the lung GLB from NIH 3D (3DPX-021008), "3d-vh-f-lung.glb". The entry's page says male, but
  every part in the file is the Visible Human Female's (VH_F_...), and it is credited as such. National Library of
  Medicine. CC BY 4.0.
Output: lungs.bin + lungs.json, and lungs-lite.bin + lungs-lite.json, in <out_dir>

Kept as given, only welded, simplified and converted to millimetres in the Visible Human frame (+x the subject's
left, +y up, +z forward), centred on the lungs' bounding box. The bronchopulmonary segments and the hilum make the
lungs' surface; the lobar and segmental bronchi are kept to show through it. The cartilage rings of the bronchi
(about 120,000 pieces of a few triangles each) are left out: they cannot be seen in a drawing at this size. The
outline is the lungs' silhouette seen from the front, one closed loop per lung, for the glowing lines behind them.

usage: prep_lungs.py <lung.glb> <out_dir>
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw
import contourpy

from meshio import read_glb, weld, cluster_decimate, vertex_normals, quantise

CLASSES = ["surface", "bronchus"]
CELL = {0: 1.6, 1: 0.9}   # simplification grid per class, mm (finer for the narrow bronchi)
PX = 0.5                  # the outline's raster, mm per pixel


def classify(name):
    base = re.sub(r"^VH_[FM]_|(#\d+)$", "", name)
    if re.match(r"^cartilage_of_", base):
        return None
    if re.search(r"bronchopulmonary_segm|^hilum(_|$)", base):
        return 0
    if re.search(r"_bronch(us|i)$", base):
        return 1
    raise SystemExit(f"unclassified lung part: {name!r} (base {base!r})")


def outline_loops(mask, min_len=40):
    """Closed loops round the filled parts of a mask, in pixel coordinates (x along columns, y along rows)."""
    lines = contourpy.contour_generator(z=np.asarray(mask, float), line_type=contourpy.LineType.Separate).lines(0.5)
    loops = []
    for L in lines:
        L = np.asarray(L, float)
        if len(L) >= min_len and np.linalg.norm(L[0] - L[-1]) < 1.5:
            loops.append(L)
    return loops


def resample(L, step):
    """A loop with points about `step` apart along it."""
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(L, axis=0), axis=1))]
    s = np.arange(0, d[-1], step)
    return np.c_[np.interp(s, d, L[:, 0]), np.interp(s, d, L[:, 1])]


def build(parts, scale, centre):
    V_all, F_all, C_all, off = [], [], [], 0
    for name, V, F, c in parts:
        V, F = weld(V * 1000.0 - centre, F, 1e-3)
        V, F = cluster_decimate(V, F, CELL[c] * scale)
        V_all.append(V); F_all.append(F + off); C_all.append(np.full(len(V), c, np.uint8)); off += len(V)
    return np.vstack(V_all), np.vstack(F_all), np.concatenate(C_all)


def write(out, name, V, F, C, meta):
    N = vertex_normals(V, F)
    q, lo, hi = quantise(V)
    n8 = np.clip(np.round(N * 127), -127, 127).astype(np.int8)
    rec = np.zeros((len(V), 12), np.uint8)
    rec[:, 0:6] = q.view(np.uint8).reshape(-1, 6)
    rec[:, 6:9] = n8.view(np.uint8)
    rec[:, 9] = C
    with open(os.path.join(out, name + ".bin"), "wb") as f:
        f.write(rec.tobytes())
        f.write(F.astype(np.uint32).tobytes())
    json.dump({"verts": int(len(V)), "faces": int(len(F)), "lo": lo, "hi": hi, "units": "mm", "classes": CLASSES, **meta},
              open(os.path.join(out, name + ".json"), "w"))
    print(f"{name}: {len(V)} verts, {len(F)} faces, {(len(V) * 12 + len(F) * 12) / 1048576:.2f} MB")


def main(glb, out):
    parts = [(n, V, F, classify(n)) for n, V, F in read_glb(glb)]
    parts = [p for p in parts if p[3] is not None]
    S = np.vstack([V for n, V, F, c in parts if c == 0]) * 1000.0
    lo, hi = S.min(0), S.max(0)
    centre, size = (lo + hi) / 2, hi - lo
    # the front-view silhouette: every surface triangle drawn into a mask, then traced
    W, H = int(np.ceil(size[0] / PX)) + 20, int(np.ceil(size[1] / PX)) + 20
    img = Image.new("L", (W, H), 0); draw = ImageDraw.Draw(img)
    to_px = lambda p: ((p[0] - lo[0]) / PX + 10, (hi[1] - p[1]) / PX + 10)
    for n, V, F, c in parts:
        if c != 0:
            continue
        P = V * 1000.0
        for f in F:
            draw.polygon([to_px(P[i]) for i in f], fill=255)
    loops = [resample(L, 1.0 / PX) for L in outline_loops(np.asarray(img) > 127)]
    outline = [[round(v, 2) for xy in L for v in ((xy[0] - 10) * PX + lo[0] - centre[0], hi[1] - (xy[1] - 10) * PX - centre[1])] for L in loops]
    meta = {"centre": [0, 0, 0], "size": size.round(3).tolist(), "outline": outline}
    for scale, name in ((1.0, "lungs"), (1.7, "lungs-lite")):
        V, F, C = build(parts, scale, centre)
        write(out, name, V, F, C, meta)
    print(f"outline: {len(outline)} loops, {[len(L) // 2 for L in outline]} points")


if __name__ == "__main__":
    main(*sys.argv[1:3])
