// Impulse timing along each white-matter pathway, and the fibre buffer the stage draws.
export const CENTRE = [0, -18, 6];   // thalamus and upper brainstem: where every beat's impulse starts
export const STRIDE = 12;            // floats per segment: a(3) b(3) s(2) colour(3) half-width(1)

// The standard tractography colour code: left-right red, front-back green, up-down blue.
export const dirCol = (a, b) => {
  const d = [Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])], m = Math.max(d[0], d[1], d[2]) || 1;
  return d.map(v => 0.08 + 0.92 * Math.pow(v / m, 0.9));
};

// An impulse leaves the centre, joins the pathway at its deepest point and runs out along both arms.
// Its arrival time is 0 at the centre and 1 at each end, so every pathway delivers to the surface together.
export function arrival(pts) {
  const P = pts.length, arc = new Float32Array(P), s = new Float32Array(P);
  let j0 = 0, d0 = Infinity;
  for (let j = 0; j < P; j++) {
    const p = pts[j];
    arc[j] = j ? arc[j - 1] + Math.hypot(p[0] - pts[j - 1][0], p[1] - pts[j - 1][1], p[2] - pts[j - 1][2]) : 0;
    const d = Math.hypot(p[0] - CENTRE[0], p[1] - CENTRE[1], p[2] - CENTRE[2]);
    if (d < d0) { d0 = d; j0 = j; }
  }
  for (let j = 0; j < P; j++) {
    const arm = Math.abs(arc[j] - arc[j0]), len = j <= j0 ? arc[j0] : arc[P - 1] - arc[j0];
    s[j] = (d0 + arm) / (d0 + Math.max(len, 1e-3));
  }
  return s;
}

export function buildTracts({ N, P, point, flag }) {
  const data = new Float32Array(N * (P - 1) * STRIDE), starts = [], pts = new Array(P);
  let o = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < P; j++) pts[j] = point(i, j);
    const s = arrival(pts);
    for (let j = 0; j < P - 1; j++) {
      const a = pts[j], b = pts[j + 1], c = dirCol(pts[Math.max(0, j - 1)], pts[Math.min(P - 1, j + 2)]);
      data.set([a[0], a[1], a[2], b[0], b[1], b[2], s[j], s[j + 1], c[0], c[1], c[2], 1], o); o += STRIDE;
    }
    if (flag[i] & 2) {
      const a = pts[P - 3], b = pts[P - 1], dz = Math.max(0.5, a[2] - b[2]), cl = v => Math.min(0.5, Math.max(-0.5, v));
      starts.push({ p: b, tan: [cl((b[0] - a[0]) / dz), cl((b[1] - a[1]) / dz)] });
    }
  }
  return { data, starts };
}
