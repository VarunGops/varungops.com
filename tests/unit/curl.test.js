import { describe, it, expect } from 'vitest';
import { noise3, curl3, traceScribbles } from '../../src/stage/curl.js';

describe('the current the sparks and scribbles follow', () => {
  it('is smooth noise, the same for the same seed', () => {
    expect(noise3(0.3, 1.7, -2.2, 7)).toBe(noise3(0.3, 1.7, -2.2, 7));
    expect(noise3(0.3, 1.7, -2.2, 7)).not.toBe(noise3(0.3, 1.7, -2.2, 8));
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 2000; i++) { const v = noise3(i * 0.137, i * 0.071, i * 0.053, 1); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    expect(lo).toBeGreaterThan(-1.01); expect(hi).toBeLessThan(1.01); expect(hi - lo).toBeGreaterThan(0.8);
    expect(Math.abs(noise3(1, 1, 1, 3) - noise3(1.001, 1, 1, 3))).toBeLessThan(0.01);   // continuous
  });
  it('swirls without sources or sinks: a curl has no divergence', () => {
    const h = 1e-4;                        // as fine as the curl's own differences: coarser steps straddle the noise's kinks
    for (const [x, y, z] of [[0.2, 0.4, 0.9], [1.3, -0.7, 2.1], [-2.5, 0.1, 0.6]]) {
      const dx = (curl3(x + h, y, z, 2)[0] - curl3(x - h, y, z, 2)[0]) / (2 * h), dy = (curl3(x, y + h, z, 2)[1] - curl3(x, y - h, z, 2)[1]) / (2 * h), dz = (curl3(x, y, z + h, 2)[2] - curl3(x, y, z - h, 2)[2]) / (2 * h);
      expect(Math.abs(dx + dy + dz) / (Math.abs(dx) + Math.abs(dy) + Math.abs(dz))).toBeLessThan(0.01);   // the terms cancel to within 1%
    }
  });
});

describe('the scribbles', () => {
  const s = traceScribbles({ lines: 40, steps: 60, step: 0.02, spread: 0.3, seed: 5 });
  it('are the same tangle every time', () => { expect(traceScribbles({ lines: 40, steps: 60, step: 0.02, spread: 0.3, seed: 5 })).toEqual(s); });
  it('are continuous lines of even steps', () => {
    expect(s.length).toBe(40);
    for (const line of s) {
      expect(line.length).toBe(61 * 3);
      for (let i = 3; i < line.length; i += 3) expect(Math.hypot(line[i] - line[i - 3], line[i + 1] - line[i - 2], line[i + 2] - line[i - 1])).toBeLessThan(0.02 * 1.01);
    }
  });
  it('stay within a ball round the middle', () => { for (const line of s) for (let i = 0; i < line.length; i += 3) expect(Math.hypot(line[i], line[i + 1], line[i + 2])).toBeLessThan(1.6); });
});
