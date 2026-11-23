"""Build the brain surface for varungops.com from the MNI ICBM 2009c template.

Inputs (never committed, see README in this folder):
  mni_icbm152_nlin_sym_09c_nifti.zip          McGill BIC, permissive licence
  mni_icbm152_nlin_sym_09c_CerebrA_nifti.zip  Manera et al. 2020, CC0 (optional: lobe labels)

Output: brain.bin + brain.json in <out_dir>
  A triangle mesh of the pial surface (cerebrum, cerebellum, brainstem) in MNI millimetres,
  with, per vertex, a sulcal depth (how far below the brain's smooth outer hull it sits)
  and a region id (lobe), so the page can draw every gyrus and colour every lobe.

usage: prep_brain.py <mni_zip> <cerebra_zip or -> <out_dir> [target_faces]
"""
import csv
import json
import sys
import zipfile

import nibabel as nib
import numpy as np
import scipy.sparse as sp
from scipy import ndimage as ndi
from skimage import measure

REGIONS = ["unlabelled", "frontal", "parietal", "temporal", "occipital", "limbic", "insula", "cerebellum", "brainstem"]

# CerebrA label names (Mindboggle-101 / DKT) grouped into lobes.
LOBE_OF = {
    "frontal": ["Superior Frontal", "Rostral Middle Frontal", "Caudal Middle Frontal", "Pars Opercularis", "Pars Triangularis",
                "Pars Orbitalis", "Lateral Orbitofrontal", "Medial Orbitofrontal", "Precentral", "Paracentral", "Frontal Pole"],
    "parietal": ["Superior Parietal", "Inferior Parietal", "Supramarginal", "Postcentral", "Precuneus"],
    "temporal": ["Superior Temporal", "Middle Temporal", "Inferior Temporal", "Transverse Temporal", "Fusiform", "Temporal Pole",
                 "Banks", "Entorhinal", "Parahippocampal", "Hippocampus", "Amygdala"],
    "occipital": ["Lateral Occipital", "Lingual", "Cuneus", "Pericalcarine"],
    "limbic": ["Rostral Anterior Cingulate", "Caudal Anterior Cingulate", "Posterior Cingulate", "Isthmus Cingulate"],
    "insula": ["Insula"],
    "cerebellum": ["Cerebellum", "Vermal"],
    "brainstem": ["Brainstem", "Brain Stem", "Ventral Diencephalon"],
}


def load(zf, suffix):
    name = next(n for n in zf.namelist() if n.endswith(suffix))
    img = nib.Nifti1Image.from_bytes(zf.read(name))
    return np.asarray(img.dataobj, dtype=np.float32), img.affine


def close_mask(mask, r):
    """Morphological closing with a ball of radius r (in voxels), done with distance transforms."""
    dil = ndi.distance_transform_edt(~mask) <= r
    return ndi.distance_transform_edt(dil) > r


def relief(mm, faces, nrm, iters=60, lam=0.5):
    """Height of each vertex above a heavily smoothed copy of the surface, in mm: positive on a gyral crown, negative in a sulcus."""
    n = len(mm)
    i = np.concatenate([faces[:, 0], faces[:, 1], faces[:, 2], faces[:, 1], faces[:, 2], faces[:, 0]])
    j = np.concatenate([faces[:, 1], faces[:, 2], faces[:, 0], faces[:, 0], faces[:, 1], faces[:, 2]])
    A = sp.coo_matrix((np.ones(len(i)), (i, j)), shape=(n, n)).tocsr()
    A.data[:] = 1.0
    deg = np.asarray(A.sum(1)).ravel()
    deg[deg == 0] = 1
    Wm = sp.diags(1.0 / deg) @ A
    s = mm.copy()
    for _ in range(iters):
        s = (1 - lam) * s + lam * (Wm @ s)
    return np.einsum("ij,ij->i", mm - s, nrm)


def decimate(verts, faces, target):
    """Thin a mesh by vertex clustering on a grid, picking the cell size that lands near `target` faces."""
    lo, hi = 0.6, 4.0
    for _ in range(18):
        cell = (lo + hi) / 2
        v, f = cluster(verts, faces, cell)
        if len(f) > target:
            lo = cell
        else:
            hi = cell
    return cluster(verts, faces, hi)


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
    _, first = np.unique(np.sort(f, 1), axis=0, return_index=True)  # drop duplicate triangles, keep the winding of the first
    return nv.astype(np.float32), f[first].astype(np.int64)


def main():
    mni_zip, cerebra_zip, out_dir = sys.argv[1:4]
    target = int(sys.argv[4]) if len(sys.argv) > 4 else 150_000
    zf = zipfile.ZipFile(mni_zip)
    gm, aff = load(zf, "_gm_tal_nlin_sym_09c.nii")
    wm, _ = load(zf, "_wm_tal_nlin_sym_09c.nii")
    msk, _ = load(zf, "_t1_tal_nlin_sym_09c_mask.nii")
    tissue = (gm + wm) * (msk > 0.5)
    tissue = ndi.gaussian_filter(tissue, 0.6)
    lab, n = ndi.label(tissue > 0.5)
    keep = lab == (np.argmax(ndi.sum(tissue > 0.5, lab, range(1, n + 1))) + 1)
    tissue = np.where(ndi.binary_dilation(keep, iterations=2), tissue, 0.0)
    print("volume", tissue.shape, "brain voxels", int(keep.sum()))

    verts, faces, _, _ = measure.marching_cubes(tissue, level=0.5, allow_degenerate=False)
    print("marching cubes:", len(verts), "verts", len(faces), "faces")

    # sulcal depth: distance below the smooth outer hull of the brain
    hull = close_mask(keep, 12.0)
    depth_vol = ndi.distance_transform_edt(hull).astype(np.float32)
    verts_d, faces_d = decimate(verts.astype(np.float64), faces, target)
    print("decimated:", len(verts_d), "verts", len(faces_d), "faces")
    depth = ndi.map_coordinates(depth_vol, verts_d.T, order=1, mode="nearest")
    depth = np.clip(depth - 1.0, 0, None)  # the surface sits about a voxel inside the hull even on a gyral crown

    region = np.zeros(len(verts_d), np.uint8)
    if cerebra_zip != "-":
        cz = zipfile.ZipFile(cerebra_zip)
        print("CerebrA files:", [n for n in cz.namelist() if not n.endswith("/")])
        lab_name = next(n for n in cz.namelist() if n.lower().endswith(".nii") and "cerebra" in n.lower() and "t1" not in n.lower())
        cer = np.asarray(nib.Nifti1Image.from_bytes(cz.read(lab_name)).dataobj).astype(np.int32)
        csv_name = next(n for n in cz.namelist() if n.lower().endswith(".csv"))
        # columns: Mindboggle ID, Label Name, RH Label, LH Labels, Notes, Dice Kappa
        rows = list(csv.reader(cz.read(csv_name).decode("utf-8", "replace").splitlines()))
        id_region = {}
        for r in rows[1:]:
            if len(r) < 4:
                continue
            name = r[1].strip()
            ids = [int(x) for x in r[2:4] if x.strip().isdigit()]
            reg = next((k for k, names in LOBE_OF.items() if any(nm.lower() in name.lower() for nm in names)), None)
            for i in ids:
                id_region[i] = REGIONS.index(reg) if reg else 0
        lut = np.zeros(cer.max() + 1, np.uint8)
        for i, r in id_region.items():
            if i < len(lut):
                lut[i] = r
        regvol = lut[cer]
        # unlabelled voxels (white matter, gaps) take the nearest labelled region
        idx = ndi.distance_transform_edt(regvol == 0, return_distances=False, return_indices=True)
        regvol = regvol[tuple(idx)]
        region = regvol[tuple(np.clip(np.round(verts_d).astype(int).T, 0, np.array(regvol.shape)[:, None] - 1))]
        print("region counts:", {REGIONS[i]: int((region == i).sum()) for i in range(len(REGIONS))})

    mm = verts_d @ aff[:3, :3].T + aff[:3, 3]
    # area-weighted vertex normals, pointing out of the brain
    fn = np.cross(mm[faces_d[:, 1]] - mm[faces_d[:, 0]], mm[faces_d[:, 2]] - mm[faces_d[:, 0]])
    nrm = np.zeros_like(mm)
    for i in range(3):
        np.add.at(nrm, faces_d[:, i], fn)
    centre = mm.mean(0)
    if np.mean(np.einsum("ij,ij->i", nrm, mm - centre)) < 0:
        nrm, faces_d = -nrm, faces_d[:, ::-1]
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9

    rel = relief(mm, faces_d, nrm)
    print('relief mm percentiles 2/25/50/75/98:', np.percentile(rel, [2, 25, 50, 75, 98]).round(2))
    lo, hi = mm.min(0), mm.max(0)
    q = np.round((mm - lo) / (hi - lo) * 65535).astype(np.uint16)
    n8 = np.round(nrm * 127).astype(np.int8)
    d8 = np.clip(np.round(depth * 12), 0, 255).astype(np.uint8)  # 1/12 mm steps, saturating at 21 mm
    nv, nf = len(mm), len(faces_d)
    with open(f"{out_dir}/brain.bin", "wb") as f:
        f.write(q.tobytes())                      # nv * 3 uint16
        f.write(n8.tobytes())                     # nv * 3 int8
        f.write(d8.tobytes())                     # nv uint8
        f.write(region.astype(np.uint8).tobytes())  # nv uint8
        f.write(np.clip(np.round(rel * 24), -127, 127).astype(np.int8).tobytes())  # nv int8, 1/24 mm
        f.write(faces_d.astype(np.uint32).tobytes())
    json.dump({"verts": nv, "faces": nf, "lo": lo.round(3).tolist(), "hi": hi.round(3).tolist(), "depthScale": 12, "reliefScale": 24,
               "regions": REGIONS, "space": "MNI ICBM 2009c nonlinear symmetric, millimetres"}, open(f"{out_dir}/brain.json", "w"))
    print("wrote brain.bin", nv, "verts", nf, "faces; bbox", lo.round(1), hi.round(1), "depth max", float(depth.max()))


if __name__ == "__main__":
    main()
