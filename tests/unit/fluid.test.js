import { describe, it, expect } from 'vitest';
import { pairOf, fluidClock } from '../../src/stage/bg/fluid.js';
import { T, amp } from '../../src/stage/clock.js';

const hue = ([r, g, b]) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h / 6) % 1 + 1) % 1;
};
const gap = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };

describe('the colours poured from each side', () => {
  it('are a complementary pair on every push', () => {
    for (let n = 0; n < 12; n++) { const p = pairOf(n); expect(gap(hue(p.left), hue(p.right))).toBeCloseTo(0.5, 2); }
  });
  it('change with each push, round the colour wheel', () => {
    for (let n = 0; n < 12; n++) expect(gap(hue(pairOf(n).left), hue(pairOf(n + 1).left))).toBeGreaterThan(0.05);
    const seen = new Set(); for (let n = 0; n < 12; n++) seen.add(Math.round(Math.min(hue(pairOf(n).left), hue(pairOf(n).right)) * 12));
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });
  it('are bright, never grey', () => {
    for (let n = 0; n < 12; n++) for (const c of [pairOf(n).left, pairOf(n).right]) { expect(Math.max(...c)).toBeGreaterThan(0.8); expect(Math.max(...c) - Math.min(...c)).toBeGreaterThan(0.5); }
  });
});

describe('the fluid clock', () => {
  const run = () => { const pushes = [], c = fluidClock(); return { c, pushes, step: () => {}, push: (n, a) => pushes.push([n, a]) }; };
  it('pushes once on every heartbeat, as strong as that beat', () => {
    const { c, pushes, step, push } = run();
    c.advance(10, false, step, push); pushes.length = 0;
    for (let t = 10; t < 15; t += 1 / 60) c.advance(t, false, step, push);
    const ns = pushes.map(p => p[0]);
    expect(new Set(ns).size).toBe(ns.length);
    expect(ns.length).toBeGreaterThanOrEqual(Math.floor(5 / T) - 1);
    for (let i = 1; i < ns.length; i++) expect(ns[i]).toBe(ns[i - 1] + 1);
    for (const [n, a] of pushes) expect(a).toBe(amp(n));
  });
  it('warms up over the four seconds before the first frame, pushes and all', () => {
    const { c, pushes, step, push } = run();
    expect(c.advance(10, false, step, push)).toBeGreaterThan(200);
    expect(pushes.length).toBeGreaterThanOrEqual(3);
  });
  it('back from a pause it carries on rather than catching up', () => {
    const { c, step, push } = run(); c.advance(10, false, step, push);
    expect(c.advance(30, false, step, push)).toBeLessThanOrEqual(2);
  });
  it('a fixed moment is warmed once, and drawing it again runs nothing', () => {
    const { c, step, push } = run();
    expect(c.advance(5, true, step, push)).toBeGreaterThan(200);
    expect(c.advance(5, true, step, push)).toBe(0);
  });
  it('the same fixed moment gives the same pushes', () => {
    const a = run(), b = run(); a.c.advance(5, true, a.step, a.push); b.c.advance(5, true, b.step, b.push);
    expect(a.pushes).toEqual(b.pushes);
  });
});
