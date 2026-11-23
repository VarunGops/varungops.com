"""Write a lighter tract file for phones: the first fraction of the streamlines in tracts.bin.

tracts.bin is written in shuffled order by prep_tracts.py, so any prefix still holds every bundle.
Needs no raw download. usage: make_lite.py <data_dir> [fraction=0.6]
"""
import json
import sys

import numpy as np


def main():
    d = sys.argv[1]
    frac = float(sys.argv[2]) if len(sys.argv) > 2 else 0.6
    meta = json.load(open(f"{d}/tracts.json"))
    n, p = meta["streamlines"], meta["points"]
    raw = open(f"{d}/tracts.bin", "rb").read()
    pts = np.frombuffer(raw, np.uint16, n * p * 3)
    grp = np.frombuffer(raw, np.uint8, n, n * p * 6)
    flag = np.frombuffer(raw, np.uint8, n, n * p * 6 + n)
    m = int(n * frac)
    with open(f"{d}/tracts-lite.bin", "wb") as f:
        f.write(pts[: m * p * 3].tobytes())
        f.write(grp[:m].tobytes())
        f.write(flag[:m].tobytes())
    meta = dict(meta, streamlines=m, lite_of=n)
    json.dump(meta, open(f"{d}/tracts-lite.json", "w"))
    print(f"wrote {m} of {n} streamlines, {int((flag[:m] & 2).astype(bool).sum())} into the cord")


if __name__ == "__main__":
    main()
