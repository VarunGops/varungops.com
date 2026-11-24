import { describe, it, expect } from 'vitest';
import { scanAt } from '../../src/stage/scan.js';
import { handPose, rayOut } from '../../src/stage/handpose.js';
import { createRope, stepRope, ropePoints, catchUp } from '../../src/stage/ropes.js';

describe('the scan of the fibres from the eyes', () => {
  const run = s => Array.from({ length: s * 60 }, (_, i) => scanAt(i / 60));
  it('is the same every time', () => { expect(scanAt(23.4)).toEqual(scanAt(23.4)); });
  it('always points somewhere: a unit direction on the screen', () => {
    for (const { dir } of run(30)) expect(Math.hypot(dir[0], dir[1])).toBeCloseTo(1, 6);
  });
  it('sways either side of straight up within a minute, never tipping over sideways', () => {
    const deg = run(60).map(({ dir }) => Math.atan2(dir[1], dir[0]) * 180 / Math.PI);
    expect(Math.min(...deg)).toBeLessThan(65); expect(Math.max(...deg)).toBeGreaterThan(115);   // a real sway each way
    expect(Math.min(...deg)).toBeGreaterThan(50); expect(Math.max(...deg)).toBeLessThan(130);   // but the fountain stays upright
  });
  it('never points down into the words below the eyes', () => {
    for (const { dir } of run(300)) expect(dir[1]).toBeGreaterThan(0.3);
  });
  it('moves smoothly, never in jumps', () => {
    const r = run(90);
    for (let i = 1; i < r.length; i++) expect(Math.abs(r[i].angle - r[i - 1].angle)).toBeLessThan(0.5 / 60);
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

describe('the strings held between the hands', () => {
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
  it('are hung afresh after a pause rather than stepped across it', () => {
    expect(catchUp(10, 10.1)).toEqual({ rehang: false, from: 10 });
    expect(catchUp(10, 14)).toEqual({ rehang: true, from: 14 });
    expect(catchUp(null, 3)).toEqual({ rehang: true, from: 3 });
  });
});

describe('the strings running out from the hands', () => {
  const opts = { reach: 3000, zNear: 550, zFar: -3000 };
  it('start at the hand and run taut, straight out', () => {
    const a = [10, 80, 5], d = [0.6, 0.8, 0], [p, q] = rayOut(a, d, opts);
    expect(p).toEqual(a);
    const v = q.map((x, k) => x - a[k]), n = Math.hypot(...v);
    expect(n).toBeGreaterThan(2500);
    v.forEach((x, k) => expect(x / n).toBeCloseTo(d[k], 6));
  });
  it('stop short of the camera', () => {
    const [, q] = rayOut([0, 0, 0], [0, 0.2, 0.98], opts);
    expect(q[2]).toBeLessThanOrEqual(550 + 1e-6);
  });
});
