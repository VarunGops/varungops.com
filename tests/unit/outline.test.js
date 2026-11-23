import { describe, it, expect } from 'vitest';
import { signedDistance } from '../../src/stage/outline.js';
describe('outline distance field', () => {
  it('measures distance from a single texel', () => { const m = new Uint8Array(25); m[12] = 1; const d = signedDistance(m, 5, 5); expect(d[0]).toBeCloseTo(Math.SQRT2 * 2, 5); expect(d[12]).toBeCloseTo(-1, 5); expect(d[13]).toBeCloseTo(1, 5); });
  it('is negative inside a filled square and positive outside it', () => { const m = new Uint8Array(81); for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) m[y * 9 + x] = 1; const d = signedDistance(m, 9, 9); expect(d[4 * 9 + 4]).toBeCloseTo(-3, 5); expect(d[0]).toBeCloseTo(Math.sqrt(8), 5); expect(d[4 * 9 + 1]).toBeCloseTo(1, 5); });
});
