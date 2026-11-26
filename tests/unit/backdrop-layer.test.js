import { test, expect } from 'vitest';
import { canvasScale, BG } from '../../src/stage/bg/layer.js';
import { ringsAt } from '../../src/stage/bg/rings.js';
import { T } from '../../src/stage/clock.js';

test('the canvas never passes 1.5x or seven million pixels', () => {
  expect(canvasScale(400, 800, 3)).toBe(1.5);
  const s = canvasScale(3840, 2160, 2); expect(3840 * 2160 * s * s).toBeLessThanOrEqual(7e6 + 1);
});

test('only the heart and the hands have a background so far', () => { expect(BG).toEqual({ heart: 'rings', hands: 'flow' }); });

test('a ring leaves with each beat and widens', () => {
  const a = ringsAt(4 * T + 0.01, { speed: 300 }), b = ringsAt(4 * T + 0.5, { speed: 300 });
  expect(a[0].radius).toBeLessThan(5); expect(b[0].radius).toBeGreaterThan(a[0].radius);
  expect(a[0].volley).toBe(true); expect(ringsAt(5 * T + 0.01, { speed: 300 })[0].volley).toBe(false);
});

test('older rings are fainter and there are never more than count', () => {
  const r = ringsAt(20 * T + 0.3, { count: 6, speed: 300 });
  expect(r.length).toBeLessThanOrEqual(6);
  for (let i = 1; i < r.length; i++) { expect(r[i].radius).toBeGreaterThan(r[i - 1].radius); expect(r[i].alpha).toBeLessThan(r[i - 1].alpha); }
});
