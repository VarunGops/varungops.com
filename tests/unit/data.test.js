import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeBrain, decodeTracts, stemFit, fetchRetry, loadAll, loadPart } from '../../src/stage/data.js';
const load = n => ({ json: JSON.parse(readFileSync(`public/data/${n}.json`, 'utf8')), buf: readFileSync(`public/data/${n}.bin`).buffer.slice(0) });
describe('anatomy data', () => {
  it('decodes the brain surface', () => { const b = load('brain'), m = decodeBrain(b.json, b.buf); expect(m.nv).toBe(74832); expect(m.index.length).toBe(149992 * 3); expect(Math.min(...m.pos.filter((_, i) => i % 3 === 2))).toBeCloseTo(-72.1, 0); });
  it('measures the medulla where the cord joins it', () => { const b = load('brain'), m = decodeBrain(b.json, b.buf), f = stemFit(m.pos, m.region, -67, 1.3); expect(f.rx).toBeGreaterThan(6.5); expect(f.rx).toBeLessThan(9); expect(f.yc).toBeGreaterThan(-46); expect(f.yc).toBeLessThan(-43); });
  it('decodes the tracts', () => { const t = load('tracts'), d = decodeTracts(t.json, t.buf); expect(d.N).toBe(16067); expect(d.P).toBe(32); expect([...d.flag].filter(f => f & 2).length).toBe(1536); });
  it('writes a lite tract file that is a prefix of the full one', () => { const t = load('tracts'), l = load('tracts-lite'); expect(l.json.streamlines).toBe(Math.floor(16067 * 0.6)); expect(decodeTracts(l.json, l.buf).point(100, 5)).toEqual(decodeTracts(t.json, t.buf).point(100, 5)); });
  it('rejects a truncated file', () => { const b = load('brain'); expect(() => decodeBrain(b.json, b.buf.slice(0, 1000))).toThrow('brain.bin is truncated'); });
  it('retries a failed fetch and then gives up', async () => { let calls = 0; globalThis.fetch = async () => { calls++; throw new TypeError('Failed to fetch'); }; await expect(fetchRetry('x', 'json', 3)).rejects.toThrow('Failed to fetch'); expect(calls).toBe(3); });
});

describe('loading the anatomy files', () => {
  const real = n => readFileSync(`public/data/${n}`);
  const serve = (cut = {}) => { const calls = []; globalThis.fetch = async (url, opts = {}) => { const name = url.split('/').pop(); calls.push([name, opts.cache]); const n = (cut[name] = (cut[name] ?? 0)); const body = real(name); const buf = n > 0 ? body.subarray(0, 1000) : body; if (n > 0) cut[name]--; return { ok: true, status: 200, json: async () => JSON.parse(buf.toString()), arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) }; }; return calls; };
  it('fetches a truncated file again, bypassing the cache, and then succeeds', async () => {
    const calls = serve({ 'brain.bin': 1 });
    const d = await loadAll(false, '/data/');
    expect(d.brain.buf.byteLength).toBe(readFileSync('public/data/brain.bin').byteLength);
    expect(calls.filter(c => c[0] === 'brain.bin').map(c => c[1])).toEqual([undefined, 'reload']);
  });
  it('loads one part on its own, for a page that needs only the heart', async () => {
    const calls = serve();
    const h = await loadPart('heart', '/data/');
    expect(h.buf.byteLength).toBe(readFileSync('public/data/heart.bin').byteLength);
    expect([...new Set(calls.map(c => c[0]))].sort()).toEqual(['heart.bin', 'heart.json']);
  });
  it('gives up with a clear error when a file stays truncated', async () => {
    serve({ 'heart.bin': 5 });
    await expect(loadAll(false, '/data/')).rejects.toThrow('heart.bin is truncated');
  });
});
