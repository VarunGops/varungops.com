import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeTracts } from '../../src/stage/data.js';
import { buildTracts } from '../../src/stage/tracts.js';
import { cordShape, buildCord, straightFrom } from '../../src/stage/cord.js';
const decoded = decodeTracts(JSON.parse(readFileSync('public/data/tracts.json', 'utf8')), readFileSync('public/data/tracts.bin').buffer.slice(0));
const starts = buildTracts(decoded).starts;
const sh = cordShape({ stemJ: { yc: -44.2, ry: 7.8, rx: 7.8 }, stemJ2: { yc: -42.8, ry: 8.5, rx: 8.6 }, stemTop: { yc: -36.5, ry: 11.5, rx: 12 }, fieldH: 1870, yAnchor: 434, k: 3.72 });
describe('cord', () => {
  it('leaves the medulla at its own centre and width', () => { expect(sh.yc(0)).toBeCloseTo(-44.2); expect(sh.rx(0)).toBeCloseTo(7.8); });
  it('settles onto the centre of the page as a thread', () => { expect(sh.U).toBeCloseTo(Math.min(215, 0.62 * sh.total)); expect(sh.yc(sh.U)).toBeCloseTo(-16); expect(sh.rx(sh.U)).toBeCloseTo(1.4 / 3.72); expect(sh.yc(sh.total)).toBeCloseTo(-16); });
  it('never widens on the way down', () => { for (let u = 34; u < sh.U; u += 5) expect(sh.ry(u + 5)).toBeLessThanOrEqual(sh.ry(u)); });
  it('ends the thread at the heart', () => { const c = buildCord(sh, starts); const last = c.thread.slice(-12); expect(last[5]).toBeCloseTo(-67 - sh.total, 3); expect(c.sEnd).toBeCloseTo(1 + (sh.total + 17) / 54, 6); expect(last[8]).toBeLessThan(0.05); });
  it('puts the dot where the line is straight', () => { expect(straightFrom(sh, 434, 3.72)).toBeCloseTo(434 + (15 + 67 + sh.U) * 3.72, 3); });
  it('stays finite when the page measures nothing for a moment', () => {
    // a window resized through zero width once sent the thread's step count to infinity and froze the tab
    const flat = cordShape({ stemJ: { yc: -44.2, ry: 7.8, rx: 7.8 }, stemJ2: { yc: -42.8, ry: 8.5, rx: 8.6 }, stemTop: { yc: -36.5, ry: 11.5, rx: 12 }, fieldH: 1870, yAnchor: 434, k: 0 });
    expect(Number.isFinite(flat.total)).toBe(true);
    const c = buildCord(flat, starts.slice(0, 20));
    expect(c.thread.length).toBeLessThan(20000); expect(c.fibres.length).toBeLessThan(400000);
  });
});
