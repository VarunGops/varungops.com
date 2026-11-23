import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeBrain, decodeTracts, stemFit, fetchRetry } from '../../src/stage/data.js';
const load = n => ({ json: JSON.parse(readFileSync(`public/data/${n}.json`, 'utf8')), buf: readFileSync(`public/data/${n}.bin`).buffer.slice(0) });
describe('anatomy data', () => {
  it('decodes the brain surface', () => { const b = load('brain'), m = decodeBrain(b.json, b.buf); expect(m.nv).toBe(74832); expect(m.index.length).toBe(149992 * 3); expect(Math.min(...m.pos.filter((_, i) => i % 3 === 2))).toBeCloseTo(-72.1, 0); });
  it('measures the medulla where the cord joins it', () => { const b = load('brain'), m = decodeBrain(b.json, b.buf), f = stemFit(m.pos, m.region, -67, 1.3); expect(f.rx).toBeGreaterThan(6.5); expect(f.rx).toBeLessThan(9); expect(f.yc).toBeGreaterThan(-46); expect(f.yc).toBeLessThan(-43); });
  it('decodes the tracts', () => { const t = load('tracts'), d = decodeTracts(t.json, t.buf); expect(d.N).toBe(16067); expect(d.P).toBe(32); expect([...d.flag].filter(f => f & 2).length).toBe(1536); });
  it('writes a lite tract file that is a prefix of the full one', () => { const t = load('tracts'), l = load('tracts-lite'); expect(l.json.streamlines).toBe(Math.floor(16067 * 0.6)); expect(decodeTracts(l.json, l.buf).point(100, 5)).toEqual(decodeTracts(t.json, t.buf).point(100, 5)); });
  it('rejects a truncated file', () => { const b = load('brain'); expect(() => decodeBrain(b.json, b.buf.slice(0, 1000))).toThrow('brain.bin is truncated'); });
  it('retries a failed fetch and then gives up', async () => { let calls = 0; globalThis.fetch = async () => { calls++; throw new TypeError('Failed to fetch'); }; await expect(fetchRetry('x', 'json', 3)).rejects.toThrow('Failed to fetch'); expect(calls).toBe(3); });
});
