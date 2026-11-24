"""Build the eyes for varungops.com from the Human Reference Atlas 3D reference organs.

Input (never committed): the left and right male eye GLBs from NIH 3D (3DPX-020998, 3DPX-020999), created from the
  Visible Human Male (National Library of Medicine). CC BY 4.0.
Output: eyes.bin + eyes.json, and eyes-lite.bin + eyes-lite.json, in <out_dir>

Kept as given, only welded at their texture seams, simplified and converted to millimetres in the Visible Human
frame (+x the subject's left, +y up, +z forward), centred between the two globes. The models have no extraocular
muscles and no optic nerve; nothing is added. The fluids, the conjunctiva and the smallest structures of the
drainage angle are left out because they cannot be seen in a drawing at this size.

usage: prep_eyes.py <left.glb> <right.glb> <out_dir>
"""
import json
import os
import re
import sys

import numpy as np

from meshio import read_glb, weld, cluster_decimate, vertex_normals, quantise

CLASSES = ["sclera", "cornea", "iris", "pupil", "lens", "ciliary body", "retina", "choroid"]
RULES = [  # first match wins, against the part name without the VH_M_ prefix and _L/_R suffix
    (0, r"^sclera$"),
    (1, r"^(cornea|corneo_scleral_junction)$"),
    (2, r"^iris$"),
    (3, r"^pupil$"),
    (4, r"^lens$"),
    (5, r"^(ciliary_body|ciliary_muscle|ciliary_processes)$"),
    (6, r"^(retina|macula_lutea|fovea|optic_disc|ora_serrata_of_retina)$"),
    (7, r"^optic_choroid$"),
]
DROP = r"^(vitreous_humor|aqueous_humor|bulbar_conjunctiva|palpebral_conjunctiva_of_(upper|lower)_eyelid|trabecular_meshwork|schlemms_canal|suspensory_ligament_of_lens)$"
CELL = {0: 0.30, 1: 0.30, 2: 0.12, 3: 0.12, 4: 0.30, 5: 0.40, 6: 0.45, 7: 0.45}   # simplification grid per class, mm (finest where the eye is seen: iris and pupil)


def classify(name):
    base = re.sub(r"^VH_M_|_[LR](#\d+)?$", "", name)
    for c, rx in RULES:
        if re.match(rx, base):
            return c
    if re.match(DROP, base):
        return None
    raise SystemExit(f"unclassified eye part: {name!r} (base {base!r})")


def build(eyes, scale):
    V_all, F_all, C_all, S_all, off = [], [], [], [], 0
    for side, parts in enumerate(eyes):
        for name, V, F in parts:
            c = classify(name)
            if c is None:
                continue
            V, F = weld(V * 1000.0, F, 1e-3)
            V, F = cluster_decimate(V, F, CELL[c] * scale)
            V_all.append(V); F_all.append(F + off)
            C_all.append(np.full(len(V), c, np.uint8)); S_all.append(np.full(len(V), side, np.uint8))
            off += len(V)
    return np.vstack(V_all), np.vstack(F_all), np.concatenate(C_all), np.concatenate(S_all)


def write(out, name, V, F, C, S, meta):
    N = vertex_normals(V, F)
    q, lo, hi = quantise(V)
    n8 = np.clip(np.round(N * 127), -127, 127).astype(np.int8)
    rec = np.zeros((len(V), 12), np.uint8)
    rec[:, 0:6] = q.view(np.uint8).reshape(-1, 6)
    rec[:, 6:9] = n8.view(np.uint8)
    rec[:, 9] = C
    rec[:, 10] = S
    with open(os.path.join(out, name + ".bin"), "wb") as f:
        f.write(rec.tobytes())
        f.write(F.astype(np.uint32).tobytes())
    json.dump({"verts": int(len(V)), "faces": int(len(F)), "lo": lo, "hi": hi, "units": "mm", "classes": CLASSES, **meta},
              open(os.path.join(out, name + ".json"), "w"))
    print(f"{name}: {len(V)} verts, {len(F)} faces, {(len(V) * 12 + len(F) * 12) / 1048576:.2f} MB")


def main(left, right, out):
    eyes = [read_glb(left), read_glb(right)]
    # globe centres and radii from the sclera of each eye, in mm
    cen, rad = [], []
    for parts in eyes:
        S = np.vstack([V for n, V, F in parts if classify(n) == 0]) * 1000.0
        c = (S.min(0) + S.max(0)) / 2
        cen.append(c); rad.append(float(np.median(np.linalg.norm(S - c, axis=1))))
    mid = (cen[0] + cen[1]) / 2
    for scale, name in ((1.0, "eyes"), (1.7, "eyes-lite")):
        V, F, C, S = build(eyes, scale)
        meta = {"centre": [(c - mid).round(3).tolist() for c in cen], "radius": [round(r, 3) for r in rad], "gaze": [0, 0, 1]}
        write(out, name, V - mid, F, C, S, meta)


if __name__ == "__main__":
    main(*sys.argv[1:4])
