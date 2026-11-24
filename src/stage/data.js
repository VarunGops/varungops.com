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

// eyes.bin: per vertex 3 x uint16 position, 3 x int8 normal, uint8 class, uint8 side (0 left, 1 right), 2 pad; then uint32 indices
export function decodeEyes(json, buf) {
  const nv = json.verts, nf = json.faces;
  if (buf.byteLength < NEED.eyes(json)) throw new RangeError('eyes.bin is truncated');
  const b = new Uint8Array(buf, 0, nv * 12), pos = new Float32Array(nv * 3), nrm = new Int8Array(nv * 3), cls = new Uint8Array(nv), side = new Uint8Array(nv);
  const dv = new DataView(buf);
  for (let i = 0; i < nv; i++) {
    for (let a = 0; a < 3; a++) { pos[i * 3 + a] = json.lo[a] + dv.getUint16(i * 12 + a * 2, true) / 65535 * (json.hi[a] - json.lo[a]); nrm[i * 3 + a] = dv.getInt8(i * 12 + 6 + a); }
    cls[i] = b[i * 12 + 9]; side[i] = b[i * 12 + 10];
  }
  return { nv, pos, nrm, cls, side, index: new Uint32Array(buf, nv * 12, nf * 3) };
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
export const NEED = {
  brain: j => j.verts * 12 + j.faces * 12,
  eyes: j => j.verts * 12 + j.faces * 12,
  tracts: j => j.streamlines * j.points * 6 + 2 * j.streamlines,
  heart: j => Math.ceil(j.verts * 10 / 4) * 4 + j.faces * 12,
};
const kindOf = name => name.replace('-lite', '');

// One part: its .json and .bin, checked against each other.
export async function loadPart(name, base = '/data/') {
  const get = async init => { const [json, buf] = await Promise.all([fetchRetry(`${base}${name}.json`, 'json', 3, init), fetchRetry(`${base}${name}.bin`, 'arrayBuffer', 3, init)]); return { json, buf }; };
  const ok = p => p.buf.byteLength >= NEED[kindOf(name)](p.json);
  let p = await get();
  if (!ok(p)) p = await get({ cache: 'reload' });     // once more, past any cached copy
  if (!ok(p)) throw new RangeError(`${name}.bin is truncated`);
  return p;
}

export async function loadAll(lite, base = '/data/') {
  const [brain, tracts, heart] = await Promise.all([loadPart('brain', base), loadPart(lite ? 'tracts-lite' : 'tracts', base), loadPart('heart', base)]);
  return { brain, tracts, heart };
}
