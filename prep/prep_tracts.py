"""Thin the HCP-1065 population-averaged tractography atlas down to a web-sized set of streamlines.

Input (never committed): hcp1065_avg_tracts_tt.zip
  Yeh FC, Nat Commun 13, 4933 (2022). CC BY-SA 4.0. Data from the Human Connectome Project.
Output: tracts.bin + tracts.json in <out_dir> (an adaptation of the atlas, so also CC BY-SA 4.0)
  N streamlines, each resampled to P points evenly spaced along its length, in MNI millimetres.
  Projection and brainstem pathways are ordered top to bottom, so a signal sent along them runs down
  towards the spinal cord. Everything else is ordered from the centre of the brain outwards.

usage: prep_tracts.py <tt_zip> <out_dir> [total_streamlines] [points]
"""
import gzip
import io
import json
import sys
import zipfile

import numpy as np
import scipy.io

GROUPS = ["association", "projection", "commissural", "cerebellum", "cranial nerve"]
DESCENDING = ("CST", "CBT", "CPT", "ML", "RST", "DRTT", "ICP", "MCP", "SCP", "CS_", "TR_", "F_", "AR", "OR")  # ordered top to bottom
CORD = ("CST", "ML", "RST")  # pathways that continue into the spinal cord
CENTRE = np.array([0.0, -18.0, 6.0])


def read_tt(raw):
    m = scipy.io.loadmat(io.BytesIO(gzip.decompress(raw)))
    T = m["trans_to_mni"].reshape(4, 4).astype(np.float64)
    buf = m["track"].astype(np.uint8).flatten()
    out, i = [], 0
    while i + 16 <= buf.size:
        cnt = int(buf[i:i + 4].view(np.uint32)[0])
        p0 = buf[i + 4:i + 16].view(np.int32).astype(np.float64)
        d = buf[i + 16:i + 13 + cnt].view(np.int8).reshape(-1, 3).astype(np.float64)
        vox = np.vstack([p0, p0 + np.cumsum(d, 0)]) / 32.0
        out.append(vox @ T[:3, :3].T + T[:3, 3])
        i += cnt + 13
    return out


def resample(pts, n):
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    t = np.linspace(0, s[-1], n)
    return np.stack([np.interp(t, s, pts[:, i]) for i in range(3)], 1), s[-1]


def main():
    zpath, out_dir = sys.argv[1:3]
    total = int(sys.argv[3]) if len(sys.argv) > 3 else 16000
    P = int(sys.argv[4]) if len(sys.argv) > 4 else 32
    rng = np.random.default_rng(7)
    z = zipfile.ZipFile(zpath)
    bundles = []
    for info in z.infolist():
        if not info.filename.endswith(".tt.gz"):
            continue
        group, fname = info.filename.split("/")[-2:]
        name = fname[:-6]
        sl = read_tt(z.read(info))
        length = float(np.median([np.linalg.norm(np.diff(s, axis=0), axis=1).sum() for s in sl[:: max(1, len(sl) // 200)]]))
        bundles.append((group, name, sl, length))
    # share the budget by the square root of bundle size and length, so small pathways stay visible
    # projection pathways (corona radiata, thalamic radiations, corticospinal) carry the impulse out from the centre, so they get a larger share
    boost = {"projection": 1.7, "commissural": 1.25, "cranial nerve": 0.5}
    w = np.array([np.sqrt(len(sl)) * np.sqrt(max(L, 10.0)) * boost.get(g, 1.0) for g, _, sl, L in bundles])
    quota = np.maximum(24, np.round(total * w / w.sum())).astype(int)
    pts, grp, flag, names = [], [], [], []
    for (group, name, sl, L), q in zip(bundles, quota):
        pick = rng.choice(len(sl), size=min(q, len(sl)), replace=False)
        desc = name.startswith(DESCENDING)
        for j in pick:
            r, _ = resample(sl[j], P)
            if desc:
                if r[0, 2] < r[-1, 2]:
                    r = r[::-1]
            elif np.linalg.norm(r[0] - CENTRE) > np.linalg.norm(r[-1] - CENTRE):
                r = r[::-1]
            pts.append(r)
            grp.append(GROUPS.index(group))
            flag.append((1 if desc else 0) | (2 if name.startswith(CORD) and r[-1, 2] < -44 else 0))
        names.append({"name": name, "group": group, "source": len(sl), "kept": int(len(pick)), "mm": round(L, 1)})
    pts = np.array(pts)
    order = rng.permutation(len(pts))                # shuffled, so a small screen can draw the first part of the file and still show every bundle
    pts, grp, flag = pts[order], [grp[i] for i in order], [flag[i] for i in order]
    lo, hi = pts.reshape(-1, 3).min(0), pts.reshape(-1, 3).max(0)
    q16 = np.round((pts - lo) / (hi - lo) * 65535).astype(np.uint16)
    with open(f"{out_dir}/tracts.bin", "wb") as f:
        f.write(q16.tobytes())                       # N * P * 3 uint16
        f.write(np.array(grp, np.uint8).tobytes())   # N uint8: group
        f.write(np.array(flag, np.uint8).tobytes())  # N uint8: bit0 = ordered top to bottom, bit1 = continues into the cord
    json.dump({"streamlines": len(pts), "points": P, "lo": lo.round(3).tolist(), "hi": hi.round(3).tolist(), "groups": GROUPS,
               "bundles": names, "space": "MNI ICBM 2009a nonlinear asymmetric, millimetres",
               "credit": "Adapted from the HCP-1065 tractography atlas, Yeh FC, Nat Commun 2022, CC BY-SA 4.0. Data: Human Connectome Project."},
              open(f"{out_dir}/tracts.json", "w"))
    print("wrote", len(pts), "streamlines x", P, "points; bbox", lo.round(1), hi.round(1))
    print("into cord:", int(sum(1 for x in flag if x & 2)), "| descending:", int(sum(1 for x in flag if x & 1)))
    for n in sorted(names, key=lambda n: -n["kept"])[:14]:
        print(f"  {n['name']:10s} {n['group']:13s} source {n['source']:6d} kept {n['kept']:4d} median {n['mm']} mm")


if __name__ == "__main__":
    main()
