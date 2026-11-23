import { describe, it, expect } from 'vitest';
import { beat, amp, flash, heads, burstAge, glow } from '../../src/stage/clock.js';
describe('beat clock', () => {
  it('counts beats', () => { const b = beat(40 * 0.96 + 0.1); expect(b.n).toBe(40); expect(b.a).toBeCloseTo(0.1, 6); });
  it('makes every fourth beat a full volley', () => { expect([40, 41, 42, 43, 44].map(amp)).toEqual([1, 0.42, 0.42, 0.42, 1]); });
  it('peaks the cortex as the impulse arrives', () => { expect(flash(0.36)).toBe(1); expect(flash(0.2)).toBeLessThan(0.01); expect(flash(0.68)).toBeCloseTo(Math.exp(-1), 6); });
  it('puts the newest head at the surface 0.36 s after the beat', () => { const h = heads(40 * 0.96 + 0.36, 40); expect(h[0]).toBeCloseTo(1, 6); expect(h[1]).toBeCloseTo(1 + 0.96 / 0.36, 6); });
  it('has no heads before time zero or under reduced motion', () => { expect(heads(0.5, 0).slice(1)).toEqual([-1, -1, -1]); expect(heads(50, -1)).toEqual([-1, -1, -1, -1]); });
  it('starts the smoke as the full volley lands', () => { expect(burstAge(40 * 0.96 + 0.36, 0)).toBeCloseTo(0, 6); expect(burstAge(41 * 0.96, 0)).toBeCloseTo(0.6, 6); expect(burstAge(40 * 0.96 + 0.36, 1)).toBeCloseTo(3.84, 6); });
  it('never lets the cortex glow past full', () => { for (let t = 0; t < 8; t += 0.01) expect(glow(t)).toBeLessThanOrEqual(1); expect(glow(40 * 0.96 + 0.36)).toBe(1); });
});
