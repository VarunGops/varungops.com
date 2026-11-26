"""Build the Teaching page's two connected cells from the H01 human cortex release.

Inputs (never committed), from the H01 release (Shapson-Coe et al., Science 2024), CC BY 4.0:
  raw/104_proofread_neurons_swc/   the sender, proofread cell 1900905433 (SWC voxels of 32 x 32 x 33 nm; type 3 soma)
  raw/h01_partner.json             from prep/fetch_h01_partner.py: the cell it synapses onto, 1332939895 (the c3
                                   automated reconstruction's skeleton, in um) and the 9 synapses the c3 synapse table
                                   assigns to both (each within 0.2-0.7 um of both cells)
Both cells are turned by the Research neuron's rotation, so the cortex's surface is up on both pages (the partner's
thickest dendrite then rises), and centred between the two cell bodies. Each is resampled as on the Research page, with its distance along the cell: the
sender's from its cell body, the partner's from the synapses. Nothing is added; no connection is drawn that the
synapse table does not hold.

usage: prep_pair.py <swc_dir> <partner.json> <out_dir>
"""
import collections
import json
import os
import sys

import numpy as np

from prep_neuron import read_frags, path_dist, build

SENDER = "1900905433"


def skeleton_frags(V, E, R):
    """A skeleton's edges as trees: the piece holding the cell body (the widest point) rooted there, and each loose
    piece rooted at its own widest point. Returns fragments in the form prep_neuron uses."""
    adj = collections.defaultdict(list)
    for a, b in E:
        adj[int(a)].append(int(b)); adj[int(b)].append(int(a))
    seen = np.zeros(len(V), bool); frags = []
    for root in np.argsort(-R):
        if seen[root]:
            continue
        order, parent = [int(root)], {int(root): -1}; seen[root] = True; k = 0
        while k < len(order):
            u = order[k]; k += 1
            for w in adj[u]:
                if not seen[w]:
                    seen[w] = True; parent[w] = u; order.append(w)
        idx = {u: i for i, u in enumerate(order)}
        frags.append({"P": V[order], "parent": np.array([idx[parent[u]] if parent[u] >= 0 else -1 for u in order]),
                      "type": np.where(np.arange(len(order)) == 0, 3, 0), "r": R[order]})
    return frags


def write(out, name, parts, meta):
    q = lambda x: np.clip(np.round(x * 10), -32767, 32767).astype(np.int16)
    dt = np.dtype([("a", "<i2", 3), ("b", "<i2", 3), ("da", "<u2"), ("db", "<u2"), ("r", "u1"), ("t", "u1"), ("d", "i1", 3), ("cell", "u1")])
    recs = []
    for cell, (A, B, DA, DB, R, T, D) in enumerate(parts):
        rec = np.zeros(len(A), dt)
        rec["a"] = q(A); rec["b"] = q(B); rec["da"] = np.clip(np.round(DA * 10), 0, 65535); rec["db"] = np.clip(np.round(DB * 10), 0, 65535)
        rec["r"] = np.clip(np.round(R / 0.05), 0, 255); rec["t"] = T; rec["d"] = np.clip(np.round(D * 127), -127, 127); rec["cell"] = cell
        recs.append(rec)
    allr = np.concatenate(recs)
    open(os.path.join(out, name + ".bin"), "wb").write(allr.tobytes())
    json.dump({"segs": int(len(allr)), "cells": 0, "units": "um", **meta}, open(os.path.join(out, name + ".json"), "w"))
    print(f"{name}: {len(allr)} segments ({', '.join(str(len(p[0])) for p in parts)}), {len(allr) * 22 / 1048576:.2f} MB")


def main(swc_dir, partner_json, out):
    pj = json.load(open(partner_json))
    sender = read_frags(swc_dir, SENDER)
    Ps = np.vstack([f["P"] for f in sender]); Ts = np.concatenate([f["type"] for f in sender])
    soma_s = np.median(Ps[Ts == 3], axis=0)
    sk = pj["post_skeleton"]
    partner = skeleton_frags(np.array(sk["vertices"]), np.array(sk["edges"]), np.array(sk["radius"]))
    soma_p = partner[0]["P"][0]
    syn = np.array([s["post"] for s in pj["synapses"]]); syn_c = syn.mean(0)
    # the same turn as the Research neuron: its apical dendrite marks the direction of the cortex's surface in this
    # tissue, so both pages share one 'up' (the partner's own longest processes point both ways)
    R = np.array(json.load(open(os.path.join(out, "neuron.json")))["rot"])
    centre = (soma_s + soma_p) / 2
    turn = lambda P: (P - centre) @ R.T
    for f in sender + partner: f["P"] = turn(f["P"])
    syn_t = turn(syn); soma_s_t, soma_p_t, syn_ct = turn(soma_s), turn(soma_p), turn(syn_c[None])[0]
    d_s = path_dist(sender, soma_s_t)
    d_p = path_dist(partner, syn_ct)
    # how far along the sender the synapses are: its distance at the node nearest each synapse
    from scipy.spatial import cKDTree
    Pt = np.vstack([f["P"] for f in sender]); Dt = np.concatenate(d_s)
    d_syn = float(np.median(Dt[cKDTree(Pt).query(turn(np.array([s["pre"] for s in pj["synapses"]])))[1]]))
    meta = {"pre": SENDER, "post": str(pj["post"]), "rot": R.round(6).tolist(),
            "somas": [soma_s_t.round(2).tolist(), soma_p_t.round(2).tolist()], "synapses": syn_t.round(2).tolist(),
            "dSyn": round(d_syn, 1), "maxDist": [round(float(max(d.max() for d in d_s)), 1), round(float(max(d.max() for d in d_p)), 1)],
            "source": "H01 (Shapson-Coe et al., Science 2024): proofread cell 1900905433, c3 cell 1332939895 and the c3 synapses between them, CC BY 4.0"}
    for step, name in ((2.0, "pair"), (4.0, "pair-lite")):
        write(out, name, [build(sender, d_s, step), build(partner, d_p, step)], meta)
    print(f"synapses at {d_syn:.0f} um along the sender; maxDist {meta['maxDist']}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
