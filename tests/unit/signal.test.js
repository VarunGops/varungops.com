import { describe, it, expect } from 'vitest';
import { CYCLE, SPEED, signalAt } from '../../src/stage/signal.js';

describe('the signal from one cell to the other', () => {
  const dSyn = 404, max = [853, 548], tSyn = dSyn / SPEED;
  it('reaches the synapses at the time its own speed says', () => {
    expect(signalAt(tSyn, dSyn, max).front1).toBeCloseTo(dSyn, 5);
  });
  it('flashes at the synapses then, and only then', () => {
    expect(signalAt(tSyn, dSyn, max).flash).toBeCloseTo(1, 5);
    expect(signalAt(tSyn - 0.6, dSyn, max).flash).toBeLessThan(0.01);
  });
  it('enters the second cell only once it has crossed', () => {
    expect(signalAt(tSyn - 0.05, dSyn, max).front2).toBeLessThan(0);
    expect(signalAt(tSyn + 1, dSyn, max).front2).toBeGreaterThan(0);
  });
  it('starts again every cycle', () => {
    const a = signalAt(0.3, dSyn, max), b = signalAt(0.3 + CYCLE, dSyn, max);
    expect(b.front1).toBeCloseTo(a.front1, 6); expect(b.front2).toBeCloseTo(a.front2, 6);
  });
});
