import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeTracts } from '../../src/stage/data.js';
import { arrival, dirCol, buildTracts } from '../../src/stage/tracts.js';
const decoded = decodeTracts(JSON.parse(readFileSync('public/data/tracts.json', 'utf8')), readFileSync('public/data/tracts.bin').buffer.slice(0));
describe('impulse timing and fibre buffer', () => {
  it('times a radial pathway from 0 at the centre to 1 at its end', () => { expect([...arrival([[0, -18, 6], [10, -18, 6], [20, -18, 6]])]).toEqual([0, 0.5, 1]); });
  it('brings both ends of a looping pathway to 1 together', () => { const s = arrival([[-10, -8, 6], [0, -8, 6], [20, -8, 6]]); expect(s[0]).toBeCloseTo(1); expect(s[2]).toBeCloseTo(1); expect(s[1]).toBeLessThan(1); });
  it('colours by direction: left-right red, front-back green, up-down blue', () => { expect(dirCol([0, 0, 0], [0, 0, 5]).map(v => +v.toFixed(6))).toEqual([0.08, 0.08, 1]); expect(dirCol([0, 0, 0], [3, 0, 0])[0]).toBeCloseTo(1, 6); });
  it('builds one 12-float record per segment and finds the cord fibres', () => { const r = buildTracts(decoded); expect(r.data.length).toBe(16067 * 31 * 12); expect(r.starts.length).toBe(1536); expect(r.starts.every(s => s.p[2] < -44)).toBe(true); });
});
