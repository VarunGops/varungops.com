import { describe, it, expect } from 'vitest';
import { BREATH, breath, breathe, fitBox } from '../../src/stage/breath.js';

describe('the breath', () => {
  it('is out at the start, in at two seconds, out again at five', () => {
    expect(BREATH).toBe(5);
    expect(breath(0)).toBeCloseTo(0, 5); expect(breath(2)).toBeCloseTo(1, 5); expect(breath(5)).toBeCloseTo(0, 5);
  });
  it('stays between 0 and 1', () => {
    for (let i = 0; i < 200; i++) { const b = breath(i * 0.05); expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(1); }
  });
  it('moves the bases down most and the apices hardly', () => {
    const size = [250, 220, 150];
    const base = breathe([0, -110], 1, size), apex = breathe([0, 110], 1, size);
    expect(-110 - base[1]).toBeCloseTo(0.06 * 220, 1);
    expect(Math.abs(110 - apex[1])).toBeLessThan(0.5);
    expect(breathe([100, 0], 1, size)[0]).toBeCloseTo(102.5, 3);
  });
  it('fits the lungs into the box: centred, the height filling 86% of it', () => {
    const f = fitBox({ left: 100, top: 50, width: 800, height: 400 }, [250, 220, 150], 2);
    expect(f.s * 220).toBeCloseTo(0.86 * 400 * 2, 3);
    expect(f.cx).toBeCloseTo(500 * 2, 3);
  });
});
