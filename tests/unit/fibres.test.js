import { describe, it, expect } from 'vitest';
import { writingPulses, crossing, WRITE_CYCLE } from '../../src/stage/fibres.js';
import { T } from '../../src/stage/clock.js';

describe('the light along the arcuate fasciculus', () => {
  it('runs frontal to temporal and back: one pulse forward, one returning', () => {
    const a = writingPulses(0.5), b = writingPulses(1.0);
    expect(b.fwd).toBeGreaterThan(a.fwd);          // the forward pulse moves on along the tract (s up)
    expect(b.back).toBeLessThan(a.back);           // the returning one moves back (s down)
    for (const t of [0, 0.7, 2.2, 5]) { const p = writingPulses(t); expect(p.fwd).toBeGreaterThanOrEqual(-0.15); expect(p.fwd).toBeLessThanOrEqual(1.2); /* it slides in from just before the frontal end */ }
  });
  it('repeats every cycle', () => { expect(writingPulses(0.4 + WRITE_CYCLE).fwd).toBeCloseTo(writingPulses(0.4).fwd, 6); });
});

describe('the light across the corpus callosum', () => {
  it('crosses on each beat, alternating sides, full on the volley', () => {
    for (let n = 4; n < 7; n++) expect(crossing((n + 1) * T + 0.3).dir).toBe(-crossing(n * T + 0.3).dir);
    expect(crossing(4 * T + 0.3).amp).toBe(1); expect(crossing(5 * T + 0.3).amp).toBeLessThan(0.5);
    for (const n of [4, 5]) {                                                   // s rises left to right, falls right to left
      const d = crossing(n * T + 0.3).dir, ds = crossing(n * T + 0.5).s - crossing(n * T + 0.2).s;
      expect(Math.sign(ds)).toBe(d);
    }
  });
  it('the full volley crosses one way, then the other way on the next volley', () => {
    expect(crossing(4 * T + 0.3).dir).toBe(-crossing(0 * T + 0.3).dir);
    expect(crossing(8 * T + 0.3).dir).toBe(-crossing(4 * T + 0.3).dir);
  });
});
