"""Build the heart for varungops.com from BodyParts3D.

Input (never committed): partof_BP3D_4.0_obj_99.zip + partof_element_parts.txt
  "BodyParts3D, (c) The Database Center for Life Science". The file headers state CC BY-SA 2.1 Japan,
  the archive's licence page states CC BY 4.0; this adaptation is treated as share-alike.
Output: heart.bin + heart.json in <out_dir>

What is real and what is reconstructed:
  Atria, great vessels, coronary arteries and cardiac veins are the BodyParts3D meshes as given.
  BodyParts3D 4.0 has no outer ventricular wall, only the two ventricular cavities. The outer surface
  of the ventricles is therefore rebuilt here: each cavity is thickened by a wall, and the thickness
  is not assumed but measured, as the distance at which the model's own coronary arteries lie from
  that cavity (the coronaries run on the outer surface of the heart).

usage: prep_heart.py <bp3d_zip> <element_parts.txt> <out_dir>
"""
import collections
import json
import re
import sys
import zipfile

import numpy as np
from scipy import ndimage as ndi
from skimage import measure

CLASSES = ["ventricles", "atria", "aorta", "pulmonary arteries", "venae cavae", "pulmonary veins", "coronary arteries", "cardiac veins"]
RULES = [  # first match wins, tested against the most specific name of each element
    (6, r"coronary artery|conus artery|interventricular branch|ventricular branch|marginal branch|circumflex|diagonal branch|anterior branch of anterior interventricular"),
    (7, r"cardiac vein|cardiac venous|marginal vein|posterior vein of left ventricle|coronary sinus"),
    (1, r"^wall of (left|right) atrium$"),
    (2, r"^(ascending aorta|arch of aorta|brachiocephalic (trunk|artery)|(left|right) common carotid artery|(left|right) subclavian artery)$"),  # the descending aorta lies behind the heart and is left out
    (3, r"^(pulmonary trunk|(left|right) pulmonary artery)$"),
    (4, r"^(superior|inferior) vena cava$"),
    (5, r"^(left|right) (superior|inferior) pulmonary vein$"),
]


def load_obj(z, e):
    v, f = [], []
    with z.open(f"partof_BP3D_4.0_obj_99/{e}.obj") as s:
        for line in s:
            if line.startswith(b"v "):
                v.append([float(x) for x in line.split()[1:4]])
            elif line.startswith(b"f "):
                idx = [int(tok.split(b"/")[0]) - 1 for tok in line.split()[1:]]
                for k in range(1, len(idx) - 1):
                    f.append([idx[0], idx[k], idx[k + 1]])
    return np.array(v, np.float64), np.array(f, np.int64).reshape(-1, 3)


def surface_points(v, f, spacing=0.4):
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)
    n = np.maximum(1, np.ceil(area / (spacing * spacing)).astype(int))
    rng = np.random.default_rng(3)
    tri = np.repeat(np.arange(len(f)), n)
    r1, r2 = rng.random(len(tri)), rng.random(len(tri))
    s = np.sqrt(r1)
    return np.vstack([a[tri] * (1 - s)[:, None] + b[tri] * (s * (1 - r2))[:, None] + c[tri] * (s * r2)[:, None], v])


def solid(v, f, origin, shape):
    vol = np.zeros(shape, bool)
    ijk = np.round(surface_points(v, f) - origin).astype(int)
    ok = np.all((ijk >= 0) & (ijk < np.array(shape)), axis=1)
    vol[tuple(ijk[ok].T)] = True
    return ndi.binary_fill_holes(ndi.binary_closing(vol, iterations=2))


def cluster(verts, faces, cell):
    key = np.floor(verts / cell).astype(np.int64)
    key -= key.min(0)
    dims = key.max(0) + 1
    flat = (key[:, 0] * dims[1] + key[:, 1]) * dims[2] + key[:, 2]
    uniq, inv = np.unique(flat, return_inverse=True)
    cnt = np.bincount(inv, minlength=len(uniq)).astype(np.float64)
    nv = np.stack([np.bincount(inv, weights=verts[:, i], minlength=len(uniq)) / cnt for i in range(3)], 1)
    f = inv[faces]
    f = f[(f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])]
    _, first = np.unique(np.sort(f, 1), axis=0, return_index=True)
    return nv, f[first]


def normals(v, f, outward_from=None):
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    n = np.zeros_like(v)
    for i in range(3):
        np.add.at(n, f[:, i], fn)
    if outward_from is not None and np.mean(np.einsum("ij,ij->i", n, v - outward_from)) < 0:
        n, f = -n, f[:, ::-1]
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-9), f


def main():
    zpath, elpath, out_dir = sys.argv[1:4]
    z = zipfile.ZipFile(zpath)
    rows = [r.split("\t") for r in open(elpath, encoding="utf-8", errors="replace").read().splitlines()[1:] if r.strip()]
    by_concept, by_el, cname = collections.defaultdict(set), collections.defaultdict(set), {}
    for c, n, e in rows:
        by_concept[c].add(e)
        by_el[e].add(c)
        cname[c] = n
    specific = lambda e: cname[min(by_el[e], key=lambda c: len(by_concept[c]))]
    heart_els = by_concept["FMA7088"]
    hv = np.vstack([load_obj(z, e)[0] for e in heart_els])
    lo, hi = hv.min(0), hv.max(0)
    centre = (lo + hi) / 2
    box_lo, box_hi = lo - [42, 40, 24], hi + [42, 40, 64]

    parts = []  # (class, name, verts, faces)
    for e in sorted(by_el):
        name = specific(e)
        cls = next((c for c, rx in RULES if re.search(rx, name)), None)
        if cls is None:
            continue
        v, f = load_obj(z, e)
        mid = (v.min(0) + v.max(0)) / 2
        if e not in heart_els and (np.any(mid < box_lo - 60) or np.any(mid > box_hi + 60)):
            continue
        # keep only what lies in the frame around the heart: vessels are cut where they leave it
        keep_v = np.all((v >= box_lo) & (v <= box_hi), axis=1)
        f = f[keep_v[f].all(1)]
        if len(f) == 0:
            continue
        parts.append((cls, name, v, f))

    # ---- rebuild the outer ventricular surface from the cavities and the coronary arteries
    lv_v, lv_f = load_obj(z, "FJ2422")
    rv_v, rv_f = load_obj(z, "FJ2423")
    origin = np.floor(lo - 30)
    shape = tuple((np.ceil(hi + 30) - origin).astype(int))
    LV, RV = solid(lv_v, lv_f, origin, shape), solid(rv_v, rv_f, origin, shape)
    dLV, dRV = ndi.distance_transform_edt(~LV), ndi.distance_transform_edt(~RV)
    cor = np.vstack([v for c, _, v, _ in parts if c == 6])
    ci = tuple(np.clip(np.round(cor - origin).astype(int), 0, np.array(shape) - 1).T)
    a, b = dLV[ci], dRV[ci]
    near_lv, near_rv = a[(a < b) & (a < 25)], b[(b <= a) & (b < 25)]
    t_lv, t_rv = float(np.percentile(near_lv, 35)) - 1.2, float(np.percentile(near_rv, 35)) - 1.2
    print(f"LV cavity {int(LV.sum())} mm3, RV cavity {int(RV.sum())} mm3")
    print(f"coronaries sit {np.percentile(near_lv, [10, 35, 50, 90]).round(1)} mm from the LV cavity, {np.percentile(near_rv, [10, 35, 50, 90]).round(1)} mm from the RV cavity")
    print(f"wall thickness used: LV {t_lv:.1f} mm, RV {t_rv:.1f} mm")
    myo = ndi.gaussian_filter(((dLV <= t_lv) | (dRV <= t_rv)).astype(np.float32), 1.6)
    mv, mf, _, _ = measure.marching_cubes(myo, level=0.5, allow_degenerate=False)
    mv, mf = cluster(mv + origin, mf, 1.9)
    print("ventricular surface:", len(mv), "verts", len(mf), "faces")
    parts.append((0, "outer surface of the ventricles (reconstructed)", mv, mf))

    # ---- landmarks for the beat and the conduction wave
    base = np.vstack([v for c, n, v, _ in parts if c == 1]).mean(0)               # centre of the atria
    vent = np.where((LV | RV))
    vent_c = np.array([vent[0].mean(), vent[1].mean(), vent[2].mean()]) + origin
    axis = vent_c - base
    axis /= np.linalg.norm(axis)
    apex = mv[np.argmax((mv - base) @ axis)]
    svc = next(v for c, n, v, _ in parts if n == "superior vena cava")
    ra = next(v for c, n, v, _ in parts if n == "wall of right atrium")
    svc_low = svc[svc[:, 2] < svc[:, 2].min() + 6].mean(0)
    sa = ra[np.argmin(np.linalg.norm(ra - svc_low, axis=1))]                       # sinoatrial node: where the SVC meets the right atrium

    V, N, C, F, off, summary = [], [], [], [], 0, collections.Counter()
    for cls, name, v, f in parts:
        used = np.unique(f)
        remap = -np.ones(len(v), np.int64)
        remap[used] = np.arange(len(used))
        v, f = v[used], remap[f]
        n, f = normals(v, f, outward_from=v.mean(0) if cls in (0, 1) else None)
        V.append(v); N.append(n); C.append(np.full(len(v), cls, np.uint8)); F.append(f + off)
        off += len(v); summary[CLASSES[cls]] += len(f)
    V, N, C, F = np.vstack(V), np.vstack(N), np.concatenate(C), np.vstack(F)
    V -= centre
    blo, bhi = V.min(0), V.max(0)
    q = np.round((V - blo) / (bhi - blo) * 65535).astype(np.uint16)
    with open(f"{out_dir}/heart.bin", "wb") as fh:
        fh.write(q.tobytes())                               # nv * 3 uint16
        fh.write(np.round(N * 127).astype(np.int8).tobytes())  # nv * 3 int8
        fh.write(C.tobytes())                               # nv uint8: class
        fh.write(b"\0" * ((-(len(V) * 10)) % 4))
        fh.write(F.astype(np.uint32).tobytes())
    json.dump({"verts": len(V), "faces": len(F), "lo": blo.round(3).tolist(), "hi": bhi.round(3).tolist(), "classes": CLASSES,
               "base": (base - centre).round(2).tolist(), "apex": (apex - centre).round(2).tolist(), "axis": axis.round(4).tolist(),
               "sa": (sa - centre).round(2).tolist(), "wall": {"lv": round(t_lv, 1), "rv": round(t_rv, 1)},
               "frame": "BodyParts3D body millimetres, recentred on the heart: +x patient's left, +y posterior, +z up",
               "credit": "Adapted from BodyParts3D, (c) The Database Center for Life Science. Outer ventricular surface reconstructed."},
              open(f"{out_dir}/heart.json", "w"))
    print("wrote heart.bin", len(V), "verts", len(F), "faces;", dict(summary))
    print("bbox", blo.round(0), bhi.round(0), "apex", (apex - centre).round(0), "SA node", (sa - centre).round(0), "axis", axis.round(2))


if __name__ == "__main__":
    main()
