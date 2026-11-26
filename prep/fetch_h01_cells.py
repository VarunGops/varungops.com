"""Fetch where every cell body sits in the H01 human cortex sample, for the Research page's deep field.

Source: the H01 release (Shapson-Coe et al., Science 2024), "Cell bodies: locations of 50k cell bodies that reside
within the volume (somas only)", gs://h01-release/data/20210601/cell_bodies. CC BY 4.0.
The layer is a labelled image: each cell body is one label. This reads it at 4 x 4 x 4.2 micrometre voxels (some tens of MB
over the network, about 240 MB in memory) and writes each label's centre and size. Nothing is invented: every point
is a real cell body's centre in the tissue's own frame.

Needs: pip3 install tensorstore numpy
usage: python3 prep/fetch_h01_cells.py raw/h01_cells.json
"""
import json
import sys

import numpy as np

BASE = "https://storage.googleapis.com/h01-release/data/20210601/cell_bodies/"
SCALE = 5   # 4096 x 4096 x 4224 nm voxels


def centres(labels, origin, res):
    """Centre (micrometres) and voxel count of every non-zero label in a 3D array."""
    nz = labels > 0
    idx = np.nonzero(nz)
    ids, inv = np.unique(labels[nz], return_inverse=True)
    n = np.bincount(inv)
    c = [np.bincount(inv, weights=(idx[a] + origin[a] + 0.5)) / n * res[a] / 1000.0 for a in range(3)]
    return ids, np.stack(c, 1), n


def main(out):
    import tensorstore as ts   # only needed to fetch
    vol = ts.open({"driver": "neuroglancer_precomputed", "kvstore": {"driver": "http", "base_url": BASE}, "scale_index": SCALE}).result()
    res = [float(u.multiplier) for u in vol.schema.dimension_units[:3]]   # nanometres per voxel
    origin = list(vol.domain.origin[:3])
    print(f"reading {vol.domain.shape[:3]} voxels at {res} nm ...")
    labels = vol[..., 0].read().result()
    ids, c, n = centres(labels, origin, res)
    print(f"{len(ids)} cell bodies")
    json.dump({"source": "H01 cell_bodies, gs://h01-release/data/20210601/cell_bodies, scale 4096 nm (CC BY 4.0)",
               "units": "um", "id": ids.astype(str).tolist(), "centre": np.round(c, 2).tolist(), "voxels": n.tolist()},
              open(out, "w"))
    print(f"wrote {out}")


if __name__ == "__main__":
    main(sys.argv[1])
