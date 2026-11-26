"""Find which of the 104 proofread H01 cells make synapses onto each other, for the Teaching page's connected pair.

Source: the H01 release (Shapson-Coe et al., Science 2024), c3 synapses as Neuroglancer annotations,
gs://h01-release/data/20210729/c3/synapses/precomputed, CC BY 4.0. Each synapse is a line from its presynaptic to its
postsynaptic point; the layer indexes synapses by their presynaptic cell and by their postsynaptic cell. A real
connection from cell A to cell B is a synapse listed among A's outgoing synapses and among B's incoming ones.
Nothing is inferred from closeness: only synapses the dataset itself assigns to both cells count.

Needs: pip3 install tensorstore
usage: python3 prep/fetch_h01_pairs.py raw/104_proofread_neurons_swc raw/h01_pairs.json
"""
import json
import os
import struct
import sys

BASE = "https://storage.googleapis.com/h01-release/data/20210729/c3/synapses/precomputed/"
SHARD = {"@type": "neuroglancer_uint64_sharded_v1", "hash": "murmurhash3_x86_128", "preshift_bits": 10, "shard_bits": 4,
         "minishard_index_encoding": "gzip", "data_encoding": "gzip"}
MINISHARD = {"pre_synaptic_cell": 13, "post_synaptic_cell": 12}
VOX = (0.008, 0.008, 0.033)   # micrometres per annotation unit (8 x 8 x 33 nm)


def decode_lines(body):
    """Neuroglancer's 'multiple annotation' encoding for LINE annotations with one uint32 property: a uint64 count,
    then per annotation pointA, pointB (float32 x 3 each) and the property, then the annotations' uint64 ids."""
    if not body:
        return []
    n = struct.unpack_from('<Q', body, 0)[0]
    out, off = [], 8
    for _ in range(n):
        v = struct.unpack_from('<6fI', body, off); off += 28
        out.append({'a': v[0:3], 'b': v[3:6], 'type': v[6]})
    for i in range(n):
        out[i]['id'] = struct.unpack_from('<Q', body, off)[0]; off += 8
    return out


def connections(outgoing, incoming):
    """Pairs (pre, post) of cells with the synapse ids that join them, from each cell's outgoing and incoming lists."""
    into = {}
    for cell, syns in incoming.items():
        for s in syns:
            into.setdefault(s['id'], set()).add(cell)
    found = {}
    for pre, syns in outgoing.items():
        for s in syns:
            for post in into.get(s['id'], ()):
                if post != pre:
                    found.setdefault((pre, post), []).append(s['id'])
    return [{'pre': a, 'post': b, 'synapses': ids} for (a, b), ids in sorted(found.items())]


def main(swc_dir, out):
    import tensorstore as ts   # only needed to fetch
    cells = sorted({int(f.split('.')[0]) for f in os.listdir(swc_dir) if f.endswith('.swc')})
    stores = {rel: ts.KvStore.open({"driver": "neuroglancer_uint64_sharded", "base": {"driver": "http", "base_url": BASE + rel + "/"},
                                    "metadata": {**SHARD, "minishard_bits": MINISHARD[rel]}}).result() for rel in MINISHARD}
    lists = {rel: {} for rel in MINISHARD}
    for k, c in enumerate(cells):
        for rel, kv in stores.items():
            r = kv.read(struct.pack('>Q', c)).result()
            lists[rel][c] = decode_lines(bytes(r.value) if r.state == 'value' else b'')
        print(f"{k + 1}/{len(cells)} cell {c}: {len(lists['pre_synaptic_cell'][c])} out, {len(lists['post_synaptic_cell'][c])} in", flush=True)
    pairs = connections(lists['pre_synaptic_cell'], lists['post_synaptic_cell'])
    by_id = {s['id']: s for syns in lists['pre_synaptic_cell'].values() for s in syns}
    for p in pairs:
        p['points'] = [{'id': i, 'pre': [round(v * f, 3) for v, f in zip(by_id[i]['a'], VOX)], 'post': [round(v * f, 3) for v, f in zip(by_id[i]['b'], VOX)], 'type': by_id[i]['type']} for i in p['synapses']]
    json.dump({"source": "H01 c3 synapses (gs://h01-release/data/20210729/c3/synapses/precomputed), CC BY 4.0", "units": "um", "pairs": pairs,
               "counted": {str(c): [len(lists['pre_synaptic_cell'][c]), len(lists['post_synaptic_cell'][c])] for c in cells}}, open(out, "w"))
    print(f"{len(pairs)} connected pairs among {len(cells)} proofread cells; wrote {out}")
    if not pairs:
        print("No pairs found. If every cell above shows 0 out and 0 in, the proofread ids are not the synapse layer's cell ids.")


if __name__ == "__main__":
    main(*sys.argv[1:3])
