// The cord. Below the medulla the same surface and the same fibres carry on: the surface narrows the way the cord
// narrows into its terminal thread, the fibres end one by one, the colour drains to red, and what is left is the line.
import { TAU, clamp, lerp, sstep, rng } from './util.js';
import { dirCol, STRIDE } from './tracts.js';

export const ZJ = -67, ZREF = -50;   // where the medulla becomes the cord (mm), and where the cord impulse starts its count
export const YC = -16, ZC = 15;      // the model point (mm) that sits on the page's centre line, under the name
export const CORD_RATE = 54;         // mm of cord per unit of impulse travel (about 150 mm/s)
export const TUBE = 11;              // floats per tube vertex: position(3) normal(3) colour(3) relief(1) fade(1)
export const STEM = [1, 0.58, 0.22], RED = [1, 0.137, 0.22];

export function cordShape({ stemJ: J, stemJ2, stemTop: Tp, fieldH, yAnchor, k }) {
  const zEnd = ZC - (fieldH - yAnchor) / k, total = ZJ - zEnd;
  const U = Math.min(215, 0.62 * total), thr = 1.4 / k, span = ZREF - ZJ;
  const m0 = clamp((J.yc - stemJ2.yc) / 4, -0.3, 0.1) * 0.7;      // the brainstem's own backward slope, carried into the cord
  const yc = u => {
    if (u <= 0) return lerp(J.yc, Tp.yc, clamp(-u / span, 0, 1.4));
    const t = clamp(u / U, 0, 1), t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * J.yc + (t3 - 2 * t2 + t) * U * m0 + (3 * t2 - 2 * t3) * YC;
  };
  const taper = u => Math.pow(1 - clamp((u - 26) / (U - 26), 0, 1), 1.35);
  const rad = (u, rJ, rTop, rCord) => (u <= 0 ? lerp(rJ, rTop, clamp(-u / span, 0, 1.4)) : Math.max(thr, lerp(rJ, rCord, sstep(0, 34, u)) * taper(u)));
  return { k, total, U, thr, yc, rx: u => rad(u, J.rx, Tp.rx, 6.3), ry: u => rad(u, J.ry, Tp.ry, 4.7), s: u => 1 + (u + ZREF - ZJ) / CORD_RATE };
}

export const straightFrom = (sh, yAnchor, k) => yAnchor + (ZC - ZJ + sh.U) * k;

export function buildCord(sh, starts) {
  const R = rng(5);
  // surface, in the same vertex layout as the brain so one shader draws both
  const ring = 28, du = 2.5, nr = Math.floor(sh.U / du) + 1, verts = new Float32Array(nr * ring * TUBE), index = new Uint16Array((nr - 1) * ring * 6);
  for (let i = 0, o = 0; i < nr; i++) {
    const u = i * du, rx = sh.rx(u), ry = sh.ry(u), yc = sh.yc(u), red = sstep(8, 0.8 * sh.U, u), fade = 1 - sstep(sh.U - 80, sh.U - 8, u);
    for (let j = 0; j < ring; j++) {
      const a = j / ring * TAU, c = Math.cos(a), s = Math.sin(a), nx = c / rx, ny = s / ry, nl = Math.hypot(nx, ny);
      verts.set([rx * c, yc + ry * s, ZJ - u, nx / nl, ny / nl, 0, lerp(STEM[0], RED[0], red), lerp(STEM[1], RED[1], red), lerp(STEM[2], RED[2], red), 24, fade], (i * ring + j) * TUBE);
      if (i < nr - 1) { const a0 = i * ring + j, a1 = i * ring + (j + 1) % ring; index.set([a0, a0 + ring, a1, a1, a0 + ring, a1 + ring], o); o += 6; }
    }
  }
  // fibres: each one picks up exactly where a corticospinal, lemniscal or reticulospinal streamline ends
  const segs = [], n = Math.min(starts.length, 460), dz = 2.5;
  for (let q = 0; q < n; q++) {
    const { p, tan } = starts[Math.floor(q * starts.length / n)], u0 = ZJ - p[2];
    let xi = p[0] / sh.rx(u0), eta = (p[1] - sh.yc(u0)) / sh.ry(u0); const l = Math.hypot(xi, eta); if (l > 0.8) { xi *= 0.8 / l; eta *= 0.8 / l; }
    const life = 44 + Math.pow(R(), 1.35) * Math.max(0, sh.U - u0 - 84);
    let prev = p, pd = 0;
    for (let d = dz; d <= life; d += dz) {
      const u = u0 + d, bl = sstep(0, 12, d);
      const pt = [lerp(p[0] + tan[0] * d, xi * sh.rx(u), bl), lerp(p[1] + tan[1] * d, sh.yc(u) + eta * sh.ry(u), bl), p[2] - d];
      const red = sstep(8, 0.8 * sh.U, u - dz / 2), c = dirCol(prev, pt), w = clamp((life - d + dz) / 34, 0, 1);
      if (w > 0.12) segs.push(prev[0], prev[1], prev[2], pt[0], pt[1], pt[2], 1 + pd / CORD_RATE, 1 + d / CORD_RATE, lerp(c[0], RED[0], red), lerp(c[1], RED[1], red), lerp(c[2], RED[2], red), w);
      prev = pt; pd = d;
    }
  }
  // the thread: one line on the page's centre, which the CSS line below the heart takes over from
  const th = [], u0 = Math.max(0, sh.U - 110), steps = Math.ceil((sh.total - u0) / 3), hand = 80 / sh.k;
  for (let i = 0; i < steps; i++) {
    const ua = lerp(u0, sh.total, i / steps), ub = lerp(u0, sh.total, (i + 1) / steps), um = (ua + ub) / 2;
    const a = 0.7 * sstep(sh.U - 100, sh.U - 14, um) * clamp((sh.total - um) / hand, 0, 1);
    th.push(0, sh.yc(ua), ZJ - ua, 0, sh.yc(ub), ZJ - ub, sh.s(ua), sh.s(ub), RED[0] * a, RED[1] * a, RED[2] * a, -3);
  }
  return { tube: { verts, index }, fibres: new Float32Array(segs), thread: new Float32Array(th), sEnd: sh.s(sh.total), stride: STRIDE };
}
