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
