/* The current the scribbles follow: 3D simplex noise (after Stefan Gustavson's public description of the method), and
   the curl of a vector field built from it, which swirls without sources or sinks, so lines traced through it wind
   and loop but never bunch into a point or scatter. Seeded, so the same seed gives the same tangle every visit.
   The sparks on Now follow the same current, computed in their shader. */

const G3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
const perms = new Map();
function perm(seed) {
  let p = perms.get(seed);
  if (p) return p;
  let s = (seed * 2654435761) >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const a = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  p = new Uint8Array(512); for (let i = 0; i < 512; i++) p[i] = a[i & 255];
  perms.set(seed, p); return p;
}

const F3 = 1 / 3, G = 1 / 6;
export function noise3(x, y, z, seed = 1) {
  const p = perm(seed);
  const s = (x + y + z) * F3, i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
  const t = (i + j + k) * G, x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) { if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; } }
  else { if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } }
  const ii = i & 255, jj = j & 255, kk = k & 255;
  const corner = (dx, dy, dz, gi) => { let t0 = 0.6 - dx * dx - dy * dy - dz * dz; if (t0 < 0) return 0; const g = G3[gi % 12]; t0 *= t0; return t0 * t0 * (g[0] * dx + g[1] * dy + g[2] * dz); };
  const n = corner(x0, y0, z0, p[ii + p[jj + p[kk]]])
    + corner(x0 - i1 + G, y0 - j1 + G, z0 - k1 + G, p[ii + i1 + p[jj + j1 + p[kk + k1]]])
    + corner(x0 - i2 + 2 * G, y0 - j2 + 2 * G, z0 - k2 + 2 * G, p[ii + i2 + p[jj + j2 + p[kk + k2]]])
    + corner(x0 - 1 + 3 * G, y0 - 1 + 3 * G, z0 - 1 + 3 * G, p[ii + 1 + p[jj + 1 + p[kk + 1]]]);
  return 32 * n;
}

// curl of the field (n(p), n(p + o1), n(p + o2)), by central differences
export function curl3(x, y, z, seed = 1) {
  const h = 1e-4, a = (x, y, z) => noise3(x, y, z, seed), b = (x, y, z) => noise3(x + 31.4, y - 17.2, z + 9.7, seed), c = (x, y, z) => noise3(x - 23.1, y + 41.9, z - 13.3, seed);
  const d = (f, ax) => (ax === 0 ? f(x + h, y, z) - f(x - h, y, z) : ax === 1 ? f(x, y + h, z) - f(x, y - h, z) : f(x, y, z + h) - f(x, y, z - h)) / (2 * h);
  return [d(c, 1) - d(b, 2), d(a, 2) - d(c, 0), d(b, 0) - d(a, 1)];
}

// Lines traced through the current from starting points scattered round the middle, each step of length `step`, held
// inside a ball of radius 1.4 so the tangle stays round. Returns one Float32Array of xyz points per line.
export function traceScribbles({ lines, steps, step, spread, seed = 1, freq = 1.3 }) {
  let s = (seed * 747796405 + 1) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const out = [];
  for (let l = 0; l < lines; l++) {
    const p = [(rnd() - 0.5) * 2 * spread, (rnd() - 0.5) * 2 * spread, (rnd() - 0.5) * 2 * spread], line = new Float32Array((steps + 1) * 3);
    line.set(p, 0);
    for (let i = 1; i <= steps; i++) {
      const c = curl3(p[0] * freq, p[1] * freq, p[2] * freq, seed), n = Math.hypot(...c) || 1;
      for (let k = 0; k < 3; k++) p[k] += c[k] / n * step;
      const r = Math.hypot(...p); if (r > 1.4) for (let k = 0; k < 3; k++) p[k] *= 1.4 / r;
      line.set(p, i * 3);
    }
    out.push(line);
  }
  return out;
}
