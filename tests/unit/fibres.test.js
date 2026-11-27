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
    const even = crossing(4 * T + 0.3), odd = crossing(5 * T + 0.3);
    expect(even.dir).toBe(1); expect(odd.dir).toBe(-1);
    expect(even.amp).toBe(1); expect(odd.amp).toBeLessThan(0.5);
    expect(crossing(4 * T + 0.5).s).toBeGreaterThan(crossing(4 * T + 0.2).s);   // left to right: s rises
    expect(crossing(5 * T + 0.5).s).toBeLessThan(crossing(5 * T + 0.2).s);     // right to left: s falls
  });
});
