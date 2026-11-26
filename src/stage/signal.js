/* The Teaching page's one timeline, shared by the two cells (pair.js) and the stream behind them (bg/stream.js): a
   signal leaves the first cell's body and runs out along its axon at SPEED; when it reaches the synapses (dSyn along
   the cell) they flash, and the signal runs on into the second cell from the synapses. Then both rest until the
   cycle starts again. */
export const CYCLE = 8, SPEED = 320;   // seconds; micrometres a second

// fronts in micrometres along each cell (negative: not started), the synapses' flash (0..1), and how lit the cells
// still are as they settle
export function signalAt(t, dSyn, max) {
  const ph = ((t % CYCLE) + CYCLE) % CYCLE, tSyn = dSyn / SPEED, tEnd = tSyn + max[1] * 1.1 / SPEED;
  const front1 = Math.min(ph * SPEED, max[0] * 1.1), front2 = ph >= tSyn ? (ph - tSyn) * SPEED : -1;
  const flash = Math.exp(-Math.pow((ph - tSyn) / 0.12, 2));
  const settle = ph < tEnd ? 1 : Math.max(0, 1 - (ph - tEnd) / 1.5);
  return { ph, tSyn, front1, front2, flash, settle };
}

// the turn (from the front) that shows the two cell bodies furthest apart on screen: a choice of view only, the cells stay as they are
import { project } from './cortex.js';
export function viewYaw(somas) {
  const fit = { s: 1, cx: 0, cy: 0 };
  let best = 0, far = -1;
  for (let i = 0; i <= 160; i++) {                                   // front-facing views only (no mirror from behind)
    const a = -1.4 + i * 2.8 / 160, p = project(somas[0], a, fit), q = project(somas[1], a, fit), d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d > far) { far = d; best = a; }
  }
  return best;
}

// what the view is fitted to: the second cell and both cell bodies; the first cell's long axon may run on past the box
export function pairBounds(data) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], g = data.seg;
  const take = p => { for (let k = 0; k < 3; k++) { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; } };
  for (let i = 0; i < data.nseg; i++) if (g[i * 14 + 13] > 0.5) { take([g[i * 14], g[i * 14 + 1], g[i * 14 + 2]]); take([g[i * 14 + 3], g[i * 14 + 4], g[i * 14 + 5]]); }
  data.json.somas.forEach(take);
  return { lo, hi };
}

// the box the two cells are fitted to: on a narrow screen a little inside the art's own box, clear of the edge rule
// and the heading below (window pixels)
export function pairBox(r, narrow) {
  if (!narrow) return r;
  return { left: r.left + r.width * 0.075 + 12, top: r.top + r.height * 0.04, width: r.width * 0.85 - 12, height: r.height * 0.85 };
}
