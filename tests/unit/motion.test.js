import { describe, it, expect } from 'vitest';
import { gazeAt, aimAt, blendGaze, LIMIT } from '../../src/stage/gaze.js';
import { handPose } from '../../src/stage/handpose.js';
import { createRope, stepRope, ropePoints } from '../../src/stage/ropes.js';

describe('the gaze', () => {
  const run = (seed, s = 120) => Array.from({ length: s * 60 }, (_, i) => gazeAt(i / 60, seed));
  it('is the same every time for a seed', () => { expect(gazeAt(37.3, 4)).toEqual(gazeAt(37.3, 4)); expect(gazeAt(37.3, 4)).not.toEqual(gazeAt(37.3, 5)); });
  it('stays within the limits of a real eye turn', () => {
    for (const g of run(1)) { expect(Math.abs(g.yaw)).toBeLessThanOrEqual(LIMIT.yaw + 1e-9); expect(Math.abs(g.pitch)).toBeLessThanOrEqual(LIMIT.pitch + 1e-9); }
  });
  it('holds each fixation for at least 0.3 s and jumps between them', () => {
    const g = run(2), still = [];
    let n = 0;
    for (let i = 1; i < g.length; i++) {
      const d = Math.hypot(g[i].yaw - g[i - 1].yaw, g[i].pitch - g[i - 1].pitch);
      expect(d).toBeLessThan(0.9);
      if (d < 0.001) n++; else { if (n) still.push(n); n = 0; }
    }
    expect(still.length).toBeGreaterThan(40);                                   // many saccades in two minutes
    expect(Math.min(...still.slice(1))).toBeGreaterThanOrEqual(0.3 * 60 - 1);   // and every hold lasts
  });
  it('turns towards a pointer, and no further than the eye can', () => {
    const rect = { left: 0, top: 0, width: 1000, height: 600 };
    expect(aimAt(500, 300, rect, 300)).toEqual({ yaw: 0, pitch: 0 });
    const far = aimAt(100000, -100000, rect, 300);
    expect(far.yaw).toBeCloseTo(LIMIT.yaw); expect(far.pitch).toBeCloseTo(LIMIT.pitch);
    expect(aimAt(800, 300, rect, 300).yaw).toBeGreaterThan(0);                  // pointer to the right: the eyes turn right
    expect(aimAt(500, 100, rect, 300).pitch).toBeGreaterThan(0);                // pointer above: they look up
  });
  it('follows the pointer while it moves, then goes back to wandering', () => {
    const w = { yaw: 0.2, pitch: -0.1 }, a = { yaw: -0.3, pitch: 0.25 };
    expect(blendGaze(w, a, 0.5)).toEqual(a);
    expect(blendGaze(w, a, 5)).toEqual(w);
    const mid = blendGaze(w, a, 2.5); expect(mid.yaw).toBeGreaterThan(a.yaw); expect(mid.yaw).toBeLessThan(w.yaw);
    expect(blendGaze(w, null, 0)).toEqual(w);
    const bad = blendGaze(w, { yaw: NaN, pitch: 0 }, 0); expect(Number.isNaN(bad.yaw)).toBe(false);
  });
});

describe('the hands', () => {
  const axis = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
  it('turn by true rotations, the upper hand always above, reaching towards each other', () => {
    for (let t = 0; t < 90; t += 0.37) {
      const [u, l] = handPose(t);
      for (const { m } of [u, l]) {
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          const d = m[i * 3] * m[j * 3] + m[i * 3 + 1] * m[j * 3 + 1] + m[i * 3 + 2] * m[j * 3 + 2];
          expect(Math.abs(d - (i === j ? 1 : 0))).toBeLessThan(1e-5);
        }
      }
      expect(u.p[1]).toBeGreaterThan(l.p[1]);
      const fu = axis(u.m, [0, -1, 0]), fl = axis(l.m, [0, 1, 0]);      // where each hand's fingers point
      const ang = Math.acos(Math.max(-1, Math.min(1, fu[0] * fl[0] + fu[1] * fl[1] + fu[2] * fl[2]))) * 180 / Math.PI;
      expect(ang).toBeGreaterThanOrEqual(120);
    }
  });
  it('is the same every time', () => { expect(handPose(12.5)).toEqual(handPose(12.5)); });
});

describe('the strings', () => {
  const settle = (rope, a, b, s) => { for (let i = 0; i < s * 60; i++) stepRope(rope, a, b, 1 / 60); return ropePoints(rope); };
  it('stay tied to both ends', () => {
    const a = [0, 100, 0], b = [60, -100, 10], r = createRope(a, b, 16, 0.05), P = settle(r, a, b, 1);
    expect([...P.slice(0, 3)]).toEqual(a); expect([...P.slice(-3)]).toEqual(b);
  });
  it('sag under gravity when slack', () => {
    const a = [-100, 0, 0], b = [100, 0, 0], r = createRope(a, b, 16, 0.08), P = settle(r, a, b, 2);
    expect(P[8 * 3 + 1]).toBeLessThan(-5);
  });
  it('do not stretch', () => {
    const a = [-100, 0, 0], b = [100, 0, 0], r = createRope(a, b, 16, 0.08), P = settle(r, a, b, 2), rest = 200 * 1.08 / 16;
    for (let i = 0; i < 16; i++) expect(Math.abs(Math.hypot(P[i * 3 + 3] - P[i * 3], P[i * 3 + 4] - P[i * 3 + 1], P[i * 3 + 5] - P[i * 3 + 2]) / rest - 1)).toBeLessThan(0.03);
  });
});

describe('the strings after a pause', () => {
  it('are hung afresh rather than stepped across a gap', async () => {
    const { catchUp } = await import('../../src/stage/ropes.js');
    expect(catchUp(10, 10.1)).toEqual({ rehang: false, from: 10 });
    expect(catchUp(10, 14)).toEqual({ rehang: true, from: 14 });          // back from another tab: no whip
    expect(catchUp(null, 3)).toEqual({ rehang: true, from: 3 });          // first frame
  });
});
