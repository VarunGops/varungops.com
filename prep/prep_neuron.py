"""Build the Research page's neuron and the cells around it, from the H01 human cortex release.

Inputs (never committed), both from the H01 release (Shapson-Coe et al., Science 2024), CC BY 4.0:
  raw/104_proofread_neurons_swc/  the 104 proofread cells as SWC fragments (<cell>.<part>.swc), coordinates in voxels
                                  of 32 x 32 x 33 nm; type 3 is the soma
  raw/h01_cells.json              the cell-body centres, from prep/fetch_h01_cells.py (micrometres)
The two frames agree: each proofread soma sits a median 11 um from the nearest cell-body centre, with no
systematic offset (the spread is the cell layer's own 4 um voxels).

The neuron is cell 3955003482, a pyramidal cell with a long apical dendrite. Both the neuron and the cells are turned
by one rotation about the depth axis so the apical dendrite points up, and centred on the soma. The neuron is
resampled to segments of about 2 um (4 um for the lighter file), each with its distance along the cell from the soma.
Cells within 15 um of the soma (its own body) and outside the field of view are left out. Nothing is added.

usage: prep_neuron.py <swc_dir> <cells.json> <out_dir>
"""
import collections
import glob
import json
import os
import sys

import numpy as np

CELL = "3955003482"
VOX = np.array([0.032, 0.032, 0.033])   # micrometres per voxel
FIELD = [900.0, 900.0, 200.0]           # half-size of the field kept round the soma, um


def read_frags(swc_dir, cell):
    frags = []
    for f in sorted(glob.glob(os.path.join(swc_dir, f"{cell}.*.swc"))):
        A = np.loadtxt(f, ndmin=2)
        idx = {int(n): k for k, n in enumerate(A[:, 0])}
        parent = np.array([idx.get(int(p), -1) for p in A[:, 6]])
        frags.append({"P": A[:, 2:5] * VOX, "parent": parent, "type": A[:, 1].astype(int), "r": A[:, 5] / 1000.0})
    return frags


def upright(P, soma):
    """A rotation about the depth axis (z) that turns the apical direction (soma to the far nodes) to +y."""
    far = P[np.linalg.norm(P - soma, axis=1) > 300]
    v = (far.mean(0) if len(far) else P.mean(0)) - soma
    a = np.arctan2(v[1], v[0]) - np.pi / 2
    c, s = np.cos(-a), np.sin(-a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def _adjacent(f):
    adj = collections.defaultdict(list)
    for k, p in enumerate(f["parent"]):
        if p >= 0:
            w = float(np.linalg.norm(f["P"][k] - f["P"][p])); adj[k].append((p, w)); adj[p].append((k, w))
    return adj


def path_dist(frags, soma, join=5.0):
    """Distance along the cell from the soma, per node. The fragments are pieces of one cell that do not share nodes, so
    they are solved outwards from the soma: each next piece is the one nearest to those already solved, and starts from
    where it joins them (their distance there plus the small gap) when that gap is under `join` um; a piece with
    nothing that close starts from its straight distance to the soma."""
    from scipy.spatial import cKDTree
    out = [None] * len(frags)
    def walk(f, start, d0):
        d = np.full(len(f["P"]), np.inf); d[start] = d0; adj = _adjacent(f); stack = [start]
        while stack:
            k = stack.pop()
            for q, w in adj[k]:
                if d[q] > d[k] + w:
                    d[q] = d[k] + w; stack.append(q)
        return d
    todo = set(range(len(frags)))
    while todo:
        solved = [i for i in range(len(frags)) if out[i] is not None]
        best = None
        if solved:
            P = np.vstack([frags[i]["P"] for i in solved]); D = np.concatenate([out[i] for i in solved]); kd = cKDTree(P)
            for i in todo:
                g, k = kd.query(frags[i]["P"]); n = int(np.argmin(g))
                if best is None or g[n] < best[0]: best = (float(g[n]), i, n, float(D[k[n]]))
        if best is not None and best[0] < join:
            _, i, n, dj = best; out[i] = walk(frags[i], n, dj + best[0])
        else:                                         # nothing joins: the piece nearest the soma, from its straight gap
            gaps = {i: np.linalg.norm(frags[i]["P"] - soma, axis=1) for i in todo}
            i = min(todo, key=lambda i: gaps[i].min()); n = int(np.argmin(gaps[i])); out[i] = walk(frags[i], n, float(gaps[i][n]))
        todo.discard(i)
    return out


def resample(f, step):
    """Segments (child, parent) between kept nodes: roots, leaves, branch points, and enough nodes between that no
    segment spans more than `step` of the cell (unless a single original edge does)."""
    kids = collections.defaultdict(list)
    for k, p in enumerate(f["parent"]):
        if p >= 0: kids[p].append(k)
    segs = []
    for root in np.flatnonzero(f["parent"] < 0):
        stack = [(int(root), int(root), 0.0)]          # node, the last kept node above it, length since that node
        while stack:
            k, last, acc = stack.pop()
            for c in kids[k]:
                e, l, a = float(np.linalg.norm(f["P"][c] - f["P"][k])), last, acc
                if a + e > step and k != l:            # going on would overrun the step: keep the node before
                    segs.append((k, l)); l, a = k, 0.0
                a += e
                if len(kids[c]) != 1 or a >= step * 0.999:
                    segs.append((c, l)); stack.append((c, c, 0.0))
                else:
                    stack.append((c, l, a))
    return segs


def near_cells(C, soma, half, skip):
    d = C - soma
    return np.all(np.abs(d) <= half, axis=1) & (np.linalg.norm(d, axis=1) > skip)


def smooth_dir(f, k, span=16.0):
    """The branch's direction at node k, over about `span` um of the cell above it, so tracing jitter does not show."""
    u, acc = k, 0.0
    while f["parent"][u] >= 0 and acc < span:
        p = f["parent"][u]; acc += float(np.linalg.norm(f["P"][u] - f["P"][p])); u = p
    v = f["P"][k] - f["P"][u]; n = float(np.linalg.norm(v))
    return v / n if n > 1e-9 else np.array([0.0, 1.0, 0.0])


def build(frags, dist, step):
    A, B, DA, DB, R, T, D = [], [], [], [], [], [], []
    for f, d in zip(frags, dist):
        kids = collections.Counter(int(p) for p in f["parent"] if p >= 0)
        for c, p in resample(f, step):
            A.append(f["P"][c]); B.append(f["P"][p]); DA.append(d[c]); DB.append(d[p]); R.append(f["r"][c])
            T.append(1 if kids[c] == 0 else 0)          # 1: this segment ends at a tip of the cell
            D.append(smooth_dir(f, c))
    return np.array(A), np.array(B), np.array(DA), np.array(DB), np.array(R), np.array(T), np.array(D)


def write(out, name, A, B, DA, DB, R, T, D, C, S, meta):
    q = lambda x: np.clip(np.round(x * 10), -32767, 32767).astype(np.int16)
    with open(os.path.join(out, name + ".bin"), "wb") as fh:
        rec = np.zeros(len(A), dtype=[("a", "<i2", 3), ("b", "<i2", 3), ("da", "<u2"), ("db", "<u2"), ("r", "u1"), ("t", "u1"), ("d", "i1", 3), ("pad", "u1")])
        rec["a"] = q(A); rec["b"] = q(B); rec["da"] = np.clip(np.round(DA * 10), 0, 65535); rec["db"] = np.clip(np.round(DB * 10), 0, 65535)
        rec["r"] = np.clip(np.round(R / 0.05), 0, 255); rec["t"] = np.clip(T, 0, 255); rec["d"] = np.clip(np.round(D * 127), -127, 127)
        fh.write(rec.tobytes())
        cel = np.zeros(len(C), dtype=[("p", "<i2", 3), ("s", "u1"), ("pad", "u1")])
        cel["p"] = q(C); cel["s"] = np.clip(S, 0, 255)
        fh.write(cel.tobytes())
    json.dump({"segs": int(len(A)), "cells": int(len(C)), "units": "um", **meta}, open(os.path.join(out, name + ".json"), "w"))
    print(f"{name}: {len(A)} segments, {len(C)} cells, {(len(A) * 22 + len(C) * 8) / 1048576:.2f} MB")


def main(swc_dir, cells_json, out):
    frags = read_frags(swc_dir, CELL)
    P = np.vstack([f["P"] for f in frags]); T = np.concatenate([f["type"] for f in frags])
    soma = P[T == 3].mean(0)
    R = upright(P, soma)
    for f in frags: f["P"] = (f["P"] - soma) @ R.T
    dist = path_dist(frags, np.zeros(3))
    cj = json.load(open(cells_json)); C = np.array(cj["centre"]); S = np.array(cj["voxels"])
    C = (C - soma) @ R.T                               # turned first, so the field is square to the page
    keep = near_cells(C, np.zeros(3), np.array(FIELD), 15.0)
    C = C[keep]; S = S[keep]
    maxd = float(max(d.max() for d in dist))
    meta = {"cell": CELL, "maxDist": round(maxd, 1), "rot": R.round(6).tolist(), "field": FIELD,
            "source": "H01 (Shapson-Coe et al., Science 2024), proofread cell 3955003482 and cell bodies, CC BY 4.0"}
    for step, name, every in ((2.0, "neuron", 1), (4.0, "neuron-lite", 2)):
        A, B, DA, DB, Rr, Tt, Dd = build(frags, dist, step)
        write(out, name, A, B, DA, DB, Rr, Tt, Dd, C[::every], S[::every], meta)


if __name__ == "__main__":
    main(*sys.argv[1:4])
