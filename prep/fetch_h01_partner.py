"""Find a real partner for a proofread H01 neuron, for the Teaching page: a cell that one of the 104 hand-checked
neurons makes synapses onto, with the synapses themselves and the partner's shape.

Source: the H01 release (Shapson-Coe et al., Science 2024), CC BY 4.0. The synapses are the c3 synapse annotations
(gs://h01-release/data/20210729/c3/synapses/precomputed): every synapse a proofread cell sends is looked up by its
own id, which names the cell that receives it. The partner's shape is the c3 automated reconstruction's skeleton
(gs://h01-release/data/20210601/c3/skeletons), not hand-checked. Only whole cells are considered: a partner must
have a cell body (a skeleton radius of 3 um or more) and a skeleton of at least 2,000 points.

Needs: pip3 install tensorstore numpy
usage: python3 prep/fetch_h01_partner.py raw/h01_pairs.json raw/h01_partner.json
"""
import json
import struct
import sys

import numpy as np

SYN = "https://storage.googleapis.com/h01-release/data/20210729/c3/synapses/precomputed/"
SKEL = "https://storage.googleapis.com/h01-release/data/20210601/c3/skeletons/"
SHARD = {"@type": "neuroglancer_uint64_sharded_v1", "hash": "murmurhash3_x86_128", "minishard_index_encoding": "gzip", "data_encoding": "gzip"}
VOX = np.array([0.008, 0.008, 0.033])   # synapse annotation units, um


def decode_one(body):
    """Neuroglancer's single-annotation encoding for a LINE with one uint32 property, then each relationship's ids
    (pre_synaptic_cell, then post_synaptic_cell, in the order the layer lists them)."""
    v = struct.unpack_from('<6fI', body, 0); off = 28; rel = []
    for _ in range(2):
        n = struct.unpack_from('<I', body, off)[0]; off += 4
        rel.append(list(struct.unpack_from(f'<{n}Q', body, off))); off += 8 * n
    return {'a': v[0:3], 'b': v[3:6], 'type': v[6], 'pre': rel[0], 'post': rel[1]}


def decode_lines(body):
    if not body:
        return []
    n = struct.unpack_from('<Q', body, 0)[0]; off = 8 + 28 * n
    return list(struct.unpack_from(f'<{n}Q', body, off))


def decode_skeleton(body):
    """A precomputed skeleton: vertex and edge counts, positions (float32 x 3), edges (uint32 x 2), then radius."""
    nv, ne = struct.unpack_from('<II', body, 0); off = 8
    V = np.frombuffer(body, np.float32, nv * 3, off).reshape(nv, 3); off += nv * 12
    E = np.frombuffer(body, np.uint32, ne * 2, off).reshape(ne, 2); off += ne * 8
    R = np.frombuffer(body, np.float32, nv, off)
    return V, E, R


def main(pairs_json, out):
    import tensorstore as ts   # only needed to fetch
    kv = lambda base, mb, pb, sb: ts.KvStore.open({"driver": "neuroglancer_uint64_sharded", "base": {"driver": "http", "base_url": base},
                                                    "metadata": {**SHARD, "minishard_bits": mb, "preshift_bits": pb, "shard_bits": sb}}).result()
    pre_kv, by_id, skel = kv(SYN + "pre_synaptic_cell/", 13, 10, 4), kv(SYN + "by_id/", 14, 10, 4), kv(SKEL, 11, 6, 7)
    get = lambda store, k: (lambda r: bytes(r.value) if r.state == 'value' else b'')(store.read(struct.pack('>Q', k)).result())
    counted = json.load(open(pairs_json))["counted"]
    senders = sorted((int(c) for c, (o, _) in counted.items() if o > 0), key=lambda c: -counted[str(c)][0])
    links = {}
    for c in senders:
        for sid in decode_lines(get(pre_kv, c)):
            s = decode_one(get(by_id, sid))
            for p in s['post']:
                if p and p != c:
                    links.setdefault((c, p), []).append({'id': sid, 'pre': (np.array(s['a']) * VOX).round(3).tolist(), 'post': (np.array(s['b']) * VOX).round(3).tolist(), 'type': s['type']})
        print(f"cell {c}: {sum(1 for k in links if k[0] == c)} partners", flush=True)
    best = None
    for (c, p), syns in sorted(links.items(), key=lambda kv_: -len(kv_[1])):
        body = get(skel, p)
        if not body:
            continue
        V, E, R = decode_skeleton(body)
        whole = len(V) >= 2000 and R.max() >= 3000
        print(f"  {c} -> {p}: {len(syns)} synapse(s), partner skeleton {len(V)} points, largest radius {R.max() / 1000:.1f} um{'  (whole cell)' if whole else ''}", flush=True)
        if whole and (best is None or (len(syns), len(V)) > (best[2], best[3])):
            best = (c, p, len(syns), len(V), V, E, R, syns)
    if best is None:
        print("No whole-cell partner found."); return
    c, p, n, nv, V, E, R, syns = best
    json.dump({"source": "H01 (Shapson-Coe et al., Science 2024): c3 synapses and c3 skeletons, CC BY 4.0", "units": "um",
               "pre": c, "post": p, "synapses": syns, "post_skeleton": {"vertices": (V / 1000).round(3).tolist(), "edges": E.tolist(), "radius": (R / 1000).round(3).tolist()}},
              open(out, "w"))
    print(f"chose {c} -> {p}: {n} synapse(s), partner {nv} points; wrote {out}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
