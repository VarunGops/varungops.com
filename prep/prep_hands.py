"""Build the hands for varungops.com from the Smithsonian's scan of the plaster casts of Abraham Lincoln's hands.

Input (never committed): lincoln_hands-150k-4096.glb, from https://3d.si.edu (National Portrait Gallery,
  S/NPG.71.6, casts after Leonard Wells Volk, 1860). CC0.
Output: hands.bin + hands.json, and hands-lite.bin + hands-lite.json, in <out_dir>

The scan is used as given: welded at its texture seams, simplified, and each hand turned and centred for the
drawing. Nothing is reshaped. The upper hand (the right, a fist round a cut broom handle) reaches down with its
back to the viewer; the lower hand (the left, relaxed) reaches up with its palm to the viewer, as in Dr Rajan's
reference drawing. In each hand's frame, millimetres, +y up, +z towards the viewer, origin at the wrist.

String anchors are real vertices: seven per hand, spread over the visible side of the fingers and knuckles by
farthest-point sampling from the most distal point. Strings join each upper anchor to a lower one, paired so
that they cross.

usage: prep_hands.py <hands.glb> <out_dir>
"""
import json
import os
import sys

import numpy as np

from meshio import read_glb, weld, components, cluster_decimate, vertex_normals, quantise

# old frame (scan): wrist at +z, fingers towards -z, back of the hand towards +y
TURN = {
    "right": np.array([[-1, 0, 0], [0, 0, 1], [0, 1, 0]], float),    # upper: wrist up, fingers down, back of hand to viewer
    "left": np.array([[-1, 0, 0], [0, 0, -1], [0, -1, 0]], float),   # lower: wrist down, fingers up, palm to viewer
}
ORDER = ["right", "left"]          # hand 0 is the upper, hand 1 the lower
N_ANCHORS = 7
CELL, CELL_LITE = 1.15, 1.8         # simplification grid, mm


def load(path):
    parts = read_glb(path)
    hands = {}
    for side in ORDER:
        P = [p for p in parts if f"_{side}-" in p[0]]
        off = np.cumsum([0] + [len(p[1]) for p in P])
        V = np.vstack([p[1] for p in P])
        F = np.vstack([p[2] + off[i] for i, p in enumerate(P)])
        V, F = weld(V, F, 1e-3)
        lab = components(F, len(V))
        big = np.argmax(np.bincount(lab))                       # drop specks: keep the hand itself
        keep = lab[F[:, 0]] == big
        F = F[keep]
        used = np.unique(F)
        remap = -np.ones(len(V), np.int64)
        remap[used] = np.arange(len(used))
        V, F = V[used], remap[F]
        V = V @ TURN[side].T
        up = 1 if side == "right" else -1                       # which way the wrist lies along y
        wrist = V[(V[:, 1] * up) > (V[:, 1] * up).max() - 15].mean(0)
        hands[side] = (V - wrist).astype(np.float32), F.astype(np.int32)
    return hands


def anchors(V, N, down):
    """Seven real vertices on the visible side of the distal half, spread by farthest-point sampling."""
    d = -V[:, 1] if down else V[:, 1]                          # distance towards the fingertips
    cand = np.where((d > np.percentile(d, 50)) & (N[:, 2] > 0.25))[0]
    picked = [cand[np.argmax(d[cand])]]
    dist = np.linalg.norm(V[cand] - V[picked[0]], axis=1)
    while len(picked) < N_ANCHORS:
        k = cand[np.argmax(dist)]
        picked.append(k)
        dist = np.minimum(dist, np.linalg.norm(V[cand] - V[k], axis=1))
    return picked


def write(out, name, hands, anc, strings):
    V = np.vstack([hands[s][0] for s in ORDER])
    off = np.cumsum([0] + [len(hands[s][0]) for s in ORDER])
    F = np.vstack([hands[s][1] + off[i] for i, s in enumerate(ORDER)])
    H = np.concatenate([np.full(len(hands[s][0]), i, np.uint8) for i, s in enumerate(ORDER)])
    N = vertex_normals(V, F)
    q, lo, hi = quantise(V)
    rec = np.zeros((len(V), 10), np.uint8)
    rec[:, 0:6] = q.view(np.uint8).reshape(-1, 6)
    rec[:, 6:9] = np.clip(np.round(N * 127), -127, 127).astype(np.int8).view(np.uint8)
    rec[:, 9] = H
    body = rec.tobytes()
    body += b"\0" * (-len(body) % 4)
    with open(os.path.join(out, name + ".bin"), "wb") as f:
        f.write(body)
        f.write(F.astype(np.uint32).tobytes())
    json.dump({"verts": int(len(V)), "faces": int(len(F)), "lo": lo, "hi": hi, "units": "mm", "hands": ["upper (right)", "lower (left)"],
               "anchors": anc, "strings": strings}, open(os.path.join(out, name + ".json"), "w"))
    print(f"{name}: {len(V)} verts, {len(F)} faces, {(len(body) + len(F) * 12) / 1048576:.2f} MB")


def main(path, out):
    raw = load(path)
    full = {s: cluster_decimate(*raw[s], CELL) for s in ORDER}
    lite = {s: cluster_decimate(*raw[s], CELL_LITE) for s in ORDER}
    anc = []
    for i, s in enumerate(ORDER):
        V, F = full[s]
        N = vertex_normals(V, F)
        for j, k in enumerate(anchors(V, N, down=(i == 0))):
            anc.append({"hand": i, "name": f"{s}-{j}", "p": V[k].round(3).tolist()})
    up = sorted(range(N_ANCHORS), key=lambda k: anc[k]["p"][0])
    lo = sorted(range(N_ANCHORS, 2 * N_ANCHORS), key=lambda k: -anc[k]["p"][0])     # reversed, so the strings cross
    strings = [[up[k], lo[k]] for k in range(N_ANCHORS)] + [[up[1], lo[N_ANCHORS - 2]]]
    write(out, "hands", full, anc, strings)
    write(out, "hands-lite", lite, anc, strings)


if __name__ == "__main__":
    main(*sys.argv[1:3])
