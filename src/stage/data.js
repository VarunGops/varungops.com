// Fetching and decoding the anatomy files. The byte layouts are written by prep/*.py.

const wait = ms => new Promise(ok => setTimeout(ok, ms));

export async function fetchRetry(url, kind, tries = 3, init) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, init);
      if (!r.ok) throw new Error(`${url} ${r.status}`);
      return await r[kind]();
    } catch (err) {
      if (i >= tries) throw err;
      await wait(500);
    }
  }
}

// brain.bin: per vertex 3 x uint16 position, 3 x int8 normal, uint8 sulcal depth, uint8 region, int8 relief; then uint32 indices
export function decodeBrain(json, buf) {
  const nv = json.verts, nf = json.faces;
  if (buf.byteLength < nv * 12 + nf * 12) throw new RangeError('brain.bin is truncated');
  const q = new Uint16Array(buf, 0, nv * 3), pos = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) { const a = i % 3; pos[i] = json.lo[a] + q[i] / 65535 * (json.hi[a] - json.lo[a]); }
  return {
    nv, pos,
    nrm: new Int8Array(buf, nv * 6, nv * 3),
    depth: new Uint8Array(buf, nv * 9, nv),
    region: new Uint8Array(buf, nv * 10, nv),
    relief: new Int8Array(buf, nv * 11, nv),
    index: new Uint32Array(buf, nv * 12, nf * 3),
  };
}

// tracts.bin: N x P x 3 uint16 points, N uint8 groups, N uint8 flags (bit 1: continues into the spinal cord)
export function decodeTracts(json, buf) {
  const N = json.streamlines, P = json.points;
  if (buf.byteLength < N * P * 6 + 2 * N) throw new RangeError('tracts.bin is truncated');
  const q = new Uint16Array(buf, 0, N * P * 3), sc = [0, 1, 2].map(a => (json.hi[a] - json.lo[a]) / 65535);
  return {
    N, P,
    point: (i, j) => { const o = (i * P + j) * 3; return [json.lo[0] + q[o] * sc[0], json.lo[1] + q[o + 1] * sc[1], json.lo[2] + q[o + 2] * sc[2]]; },
    flag: new Uint8Array(buf, N * P * 6 + N, N),
  };
}

// The brainstem's cross-section at height z (mm), measured from the surface itself, so the cord can leave it without a step.
export function stemFit(pos, region, z, tol) {
  let rx = 0, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < region.length; i++) {
    if (region[i] !== 8 || Math.abs(pos[i * 3 + 2] - z) >= tol) continue;
    rx = Math.max(rx, Math.abs(pos[i * 3])); y0 = Math.min(y0, pos[i * 3 + 1]); y1 = Math.max(y1, pos[i * 3 + 1]);
  }
  return { yc: (y0 + y1) / 2, ry: (y1 - y0) / 2, rx };
}

// The byte length each file must have, from its own .json. A short file means a dropped or stale download.
const NEED = {
  brain: j => j.verts * 12 + j.faces * 12,
  tracts: j => j.streamlines * j.points * 6 + 2 * j.streamlines,
  heart: j => Math.ceil(j.verts * 10 / 4) * 4 + j.faces * 12,
};
const kindOf = name => name.replace('-lite', '');

export async function loadAll(lite, base = '/data/') {
  const get = async (name, init) => { const [json, buf] = await Promise.all([fetchRetry(`${base}${name}.json`, 'json', 3, init), fetchRetry(`${base}${name}.bin`, 'arrayBuffer', 3, init)]); return { json, buf }; };
  const ok = (name, p) => p.buf.byteLength >= NEED[kindOf(name)](p.json);
  const pair = async name => {
    let p = await get(name);
    if (!ok(name, p)) p = await get(name, { cache: 'reload' });     // once more, past any cached copy
    if (!ok(name, p)) throw new RangeError(`${name}.bin is truncated`);
    return p;
  };
  const [brain, tracts, heart] = await Promise.all([pair('brain'), pair(lite ? 'tracts-lite' : 'tracts'), pair('heart')]);
  return { brain, tracts, heart };
}
