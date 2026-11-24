"""Mesh reading and simplifying for the varungops.com prep scripts, with numpy and scipy only.

read_glb / read_obj return [(name, V float32[n,3], F int32[m,3])], with node transforms applied (GLB).
"""
import io
import json
import struct
import zipfile

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

_COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
_SIZE = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def _quat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def _local(node):
    if "matrix" in node:
        return np.array(node["matrix"], float).reshape(4, 4).T
    M = np.eye(4)
    R = _quat(node.get("rotation", [0, 0, 0, 1])) * np.array(node.get("scale", [1, 1, 1]))
    M[:3, :3] = R
    M[:3, 3] = node.get("translation", [0, 0, 0])
    return M


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, _, _ = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise ValueError(f"{path} is not a GLB file")
    off, doc, blob = 12, None, b""
    while off < len(data):
        n, kind = struct.unpack_from("<II", data, off)
        chunk = data[off + 8: off + 8 + n]
        if kind == 0x4E4F534A:
            doc = json.loads(chunk)
        elif kind == 0x004E4942:
            blob = chunk
        off += 8 + n
    used = set(doc.get("extensionsUsed", []))
    if used & {"KHR_draco_mesh_compression", "EXT_meshopt_compression"}:
        raise ValueError(f"{path} uses compressed geometry ({', '.join(sorted(used))}); decompress it first")

    def accessor(i):
        a = doc["accessors"][i]
        v = doc["bufferViews"][a["bufferView"]]
        dt, k = np.dtype(_COMP[a["componentType"]]), _SIZE[a["type"]]
        start, stride = v.get("byteOffset", 0) + a.get("byteOffset", 0), v.get("byteStride", 0) or dt.itemsize * k
        raw = np.frombuffer(blob, np.uint8, count=stride * (a["count"] - 1) + dt.itemsize * k, offset=start)
        out = np.lib.stride_tricks.as_strided(raw, (a["count"], dt.itemsize * k), (stride, 1)).copy()
        return out.view(dt).reshape(a["count"], k) if k > 1 else out.view(dt).reshape(-1)

    parts = []

    def walk(i, parent):
        node = doc["nodes"][i]
        M = parent @ _local(node)
        if "mesh" in node:
            mesh = doc["meshes"][node["mesh"]]
            name = node.get("name") or mesh.get("name") or f"mesh{node['mesh']}"
            for pi, prim in enumerate(mesh["primitives"]):
                if prim.get("mode", 4) != 4:
                    continue
                V = accessor(prim["attributes"]["POSITION"]).astype(np.float64)
                F = accessor(prim["indices"]).astype(np.int64).reshape(-1, 3) if "indices" in prim else np.arange(len(V)).reshape(-1, 3)
                V = V @ M[:3, :3].T + M[:3, 3]
                if np.linalg.det(M[:3, :3]) < 0:
                    F = F[:, ::-1]
                parts.append((name if len(mesh["primitives"]) == 1 else f"{name}#{pi}", V.astype(np.float32), F.astype(np.int32)))
        for c in node.get("children", []):
            walk(c, M)

    scene = doc["scenes"][doc.get("scene", 0)]
    for r in scene["nodes"]:
        walk(r, np.eye(4))
    return parts


def read_obj(path):
    if path.endswith(".zip"):
        z = zipfile.ZipFile(path)
        names = [n for n in z.namelist() if n.lower().endswith(".obj")]
        return [p for n in names for p in _parse_obj(io.TextIOWrapper(z.open(n), "utf-8", "replace"), n)]
    with open(path, encoding="utf-8", errors="replace") as f:
        return _parse_obj(f, path)


def _parse_obj(lines, name):
    V, F = [], []
    for line in lines:
        if line.startswith("v "):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith("f "):
            idx = [int(t.split("/")[0]) for t in line.split()[1:]]
            idx = [i - 1 if i > 0 else len(V) + i for i in idx]
            F += [[idx[0], idx[k], idx[k + 1]] for k in range(1, len(idx) - 1)]
    return [(name, np.array(V, np.float32), np.array(F, np.int32))]


def components(F, n):
    e = np.vstack([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    g = coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n))
    return connected_components(g, directed=False)[1].astype(np.int32)


def cluster_decimate(V, F, cell):
    """Vertex clustering on a grid of side `cell`: each occupied cell becomes the mean of its vertices."""
    key = np.floor((V - V.min(0)) / cell).astype(np.int64)
    _, lab = np.unique(key, axis=0, return_inverse=True)
    lab = lab.reshape(-1)
    n = lab.max() + 1
    cnt = np.bincount(lab, minlength=n)[:, None]
    V2 = np.stack([np.bincount(lab, V[:, a], n) for a in range(3)], 1) / cnt
    F2 = lab[F]
    F2 = F2[(F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2])]   # collapsed faces go
    first = np.unique(np.sort(F2, 1), axis=0, return_index=True)[1]                    # so do duplicates, keeping winding
    F2 = F2[np.sort(first)]
    used = np.unique(F2)
    remap = -np.ones(n, np.int64)
    remap[used] = np.arange(len(used))
    return V2[used].astype(np.float32), remap[F2].astype(np.int32)


def weld(V, F, eps):
    """Join vertices that share a position (to within eps): scans store their texture seams as separate vertices."""
    _, first, lab = np.unique(np.round(V / eps).astype(np.int64), axis=0, return_index=True, return_inverse=True)
    lab = lab.reshape(-1)
    F2 = lab[F]
    F2 = F2[(F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2])]
    return V[first].astype(np.float32), F2.astype(np.int32)


def vertex_normals(V, F):
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    N = np.zeros_like(V, dtype=np.float64)
    for k in range(3):
        np.add.at(N, F[:, k], fn)
    return (N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)).astype(np.float32)


def quantise(V):
    lo, hi = V.min(0).astype(float), V.max(0).astype(float)
    q = np.round((V - lo) / np.maximum(hi - lo, 1e-9) * 65535).astype(np.uint16)
    return q, lo.tolist(), hi.tolist()
