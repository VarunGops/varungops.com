import { describe, it, expect } from 'vitest';
import { scanAt } from '../../src/stage/scan.js';
import { handPose, tautLine } from '../../src/stage/handpose.js';

describe('the scan of the fibres from the eyes', () => {
  const run = s => Array.from({ length: s * 60 }, (_, i) => scanAt(i / 60));
  it('is the same every time', () => { expect(scanAt(23.4)).toEqual(scanAt(23.4)); });
  it('always points somewhere: a unit direction on the screen', () => {
    for (const { dir } of run(30)) expect(Math.hypot(dir[0], dir[1])).toBeCloseTo(1, 6);
  });
  it('sweeps the whole screen within a minute', () => {
    const seen = new Set(run(60).map(({ angle }) => Math.floor((((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 4))));
    expect(seen.size).toBe(8);                       // every eighth of the circle
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

describe('the strings', () => {
  const a = [10, 80, 5], b = [-30, -90, 25];
  it('run straight through both anchors and on past them', () => {
    const [p, q] = tautLine(a, b, { reach: 1500, zNear: 560, zFar: -1500 });
    const along = v => [(v[0] - p[0]) / (q[0] - p[0]), (v[1] - p[1]) / (q[1] - p[1])];
    for (const v of [a, b]) { const [s, t] = along(v); expect(s).toBeCloseTo(t, 6); expect(s).toBeGreaterThan(0); expect(s).toBeLessThan(1); }
    expect(Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2])).toBeGreaterThan(1000);
    expect(Math.hypot(q[0] - b[0], q[1] - b[1], q[2] - b[2])).toBeGreaterThan(1000);
  });
  it('stop short of the camera', () => {
    const [p, q] = tautLine([0, 0, 0], [0, -10, 40], { reach: 1500, zNear: 560, zFar: -1500 });
    for (const v of [p, q]) { expect(v[2]).toBeLessThanOrEqual(560 + 1e-6); expect(v[2]).toBeGreaterThanOrEqual(-1500 - 1e-6); }
  });
});
