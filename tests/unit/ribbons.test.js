import { describe, it, expect } from 'vitest';
import { attractor } from '../../src/stage/bg/ribbons.js';

describe('the ribbons behind Writing (Lorenz trajectories)', () => {
  const a = attractor({ n: 40, len: 700 });
  const at = (i, k) => [a.pos[(i * a.len + k) * 3], a.pos[(i * a.len + k) * 3 + 1], a.pos[(i * a.len + k) * 3 + 2]];
  const spread = k => { let m = 0; for (let i = 1; i < 40; i++) { const p = at(0, k), q = at(i, k); m = Math.max(m, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); } return m; };
  it('is the same every time', () => { expect(attractor({ n: 40, len: 700 }).pos).toEqual(a.pos); });
  it('starts as one tight ribbon and fans out across the attractor', () => {
    expect(spread(0)).toBeLessThan(0.5);
    expect(spread(a.len - 1)).toBeGreaterThan(10);
  });
  it('stays on the attractor and visits both wings', () => {
    let left = 0, right = 0;
    for (let i = 0; i < a.pos.length; i += 3) {
      const [x, y, z] = [a.pos[i], a.pos[i + 1], a.pos[i + 2]];
      expect(Math.abs(x)).toBeLessThan(25); expect(Math.abs(y)).toBeLessThan(32); expect(z).toBeGreaterThan(-1); expect(z).toBeLessThan(55);
      if (x < -5) left++; if (x > 5) right++;
    }
    expect(left).toBeGreaterThan(100); expect(right).toBeGreaterThan(100);
  });
});
