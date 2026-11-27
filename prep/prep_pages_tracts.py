"""Build the Writing and Collaborate pages' tracts from the HCP-1065 atlas, and a light brain outline for Writing.

Inputs:
  raw/hcp1065_avg_tracts_tt/      the HCP-1065 population-averaged tractography atlas, unzipped (never committed):
                                  association/AF_L.tt.gz (the left arcuate fasciculus) and commissural/CC.tt.gz
                                  (the corpus callosum). Yeh FC, Nat Commun 13, 4933 (2022), CC BY-SA 4.0; data from
                                  the Human Connectome Project.
  public/data/brain.bin + .json   the site's MNI brain surface (McGill), for Writing's faint outline
Output (an adaptation of the atlas, so CC BY-SA 4.0): writing.bin/json, collab.bin/json (+ -lite), in <out_dir>.

Each streamline is resampled to 32 points and turned so its light runs the right way: the arcuate fasciculus from
its frontal end (the larger y) to its temporal end, the corpus callosum from left to right. A random but seeded
choice of streamlines is kept; nothing is added. The outline is the brain surface simplified on a coarse grid.

usage: prep_pages_tracts.py <atlas_dir> <data_dir>
"""
import json
import os
import sys

import numpy as np

from prep_tracts import read_tt, resample
from meshio import cluster_decimate, vertex_normals, quantise

P = 32


def orient(r, axis, high_first):
    """The streamline turned so it starts at the end with the higher (or lower) coordinate on `axis`."""
    first_high = r[0, axis] >= r[-1, axis]
    return r if first_high == high_first else r[::-1]


def bundle(atlas, rel, n, axis, high_first, seed):
    with open(os.path.join(atlas, rel), "rb") as f:
        sl = read_tt(f.read())
    rng = np.random.default_rng(seed)
    pick = rng.choice(len(sl), size=min(n, len(sl)), replace=False)
    return np.array([orient(resample(sl[j], P)[0], axis, high_first) for j in pick]), len(sl)


def brain_outline(data, cell):
    j = json.load(open(os.path.join(data, "brain.json"))); buf = open(os.path.join(data, "brain.bin"), "rb").read()
    nv, nf = j["verts"], j["faces"]
    q = np.frombuffer(buf, np.uint16, nv * 3, 0).reshape(nv, 3).astype(np.float64)
    lo, hi = np.array(j["lo"]), np.array(j["hi"])
    V = lo + q / 65535 * (hi - lo)
    F = np.frombuffer(buf, np.uint32, nf * 3, nv * 12).reshape(nf, 3)
    return cluster_decimate(V, F.astype(np.int64), cell)


def write(out, name, S, mesh, meta):
    lo, hi = S.reshape(-1, 3).min(0), S.reshape(-1, 3).max(0)
    if mesh is not None:
        lo, hi = np.minimum(lo, mesh[0].min(0)), np.maximum(hi, mesh[0].max(0))
    qz = lambda X: np.round((X - lo) / (hi - lo) * 65535).astype(np.uint16)
    parts = [qz(S).tobytes()]
    mv = mf = 0
    if mesh is not None:
        V, F = mesh; N = vertex_normals(V, F); mv, mf = len(V), len(F)
        rec = np.zeros((mv, 4), np.uint16); rec[:, :3] = qz(V)
        n8 = np.zeros((mv, 4), np.int8); n8[:, :3] = np.clip(np.round(N * 127), -127, 127)
        parts += [rec.tobytes(), n8.tobytes(), F.astype(np.uint32).tobytes()]
    blob = b"".join(parts)
    open(os.path.join(out, name + ".bin"), "wb").write(blob)
    json.dump({"streamlines": int(len(S)), "points": P, "lo": lo.round(3).tolist(), "hi": hi.round(3).tolist(), "meshVerts": int(mv), "meshFaces": int(mf), **meta},
              open(os.path.join(out, name + ".json"), "w"))
    print(f"{name}: {len(S)} streamlines, outline {mv} verts {mf} faces, {len(blob) / 1048576:.2f} MB")


def main(atlas, data):
    credit = "Adapted from the HCP-1065 tractography atlas, Yeh FC, Nat Commun 2022, CC BY-SA 4.0. Data: Human Connectome Project."
    af, af_n = bundle(atlas, "association/AF_L.tt.gz", 1100, 1, True, 11)
    cc, cc_n = bundle(atlas, "commissural/CC.tt.gz", 1500, 0, False, 12)
    for cell, sfx, keep in ((3.0, "", 1), (4.5, "-lite", 2)):
        mesh = brain_outline(data, cell)
        write(data, "writing" + sfx, af[::keep], mesh, {"bundle": "AF_L", "source": af_n, "order": "frontal end first", "credit": credit})
        write(data, "collab" + sfx, cc[::keep], None, {"bundle": "CC", "source": cc_n, "order": "left end first", "credit": credit})


if __name__ == "__main__":
    main(*sys.argv[1:3])
