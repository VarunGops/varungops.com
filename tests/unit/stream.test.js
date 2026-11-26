import { describe, it, expect } from 'vitest';
import { streamSim } from '../../src/stage/bg/stream.js';

describe('the stream behind the Teaching cells', () => {
  const sig = () => 0;
  it('warms up once, over the four seconds before the first frame', () => {
    const s = streamSim(200); s.size(800);
    expect(s.advance(10, false, sig)).toBeGreaterThan(200);
  });
  it('a resize does not start it again: the next frame takes a step, not a warm-up', () => {
    const s = streamSim(200); s.size(800); s.advance(10, false, sig);
    s.size(900);
    expect(s.advance(10 + 1 / 60, false, sig)).toBeLessThanOrEqual(2);
  });
  it('back from a pause it carries on rather than catching up', () => {
    const s = streamSim(200); s.size(800); s.advance(10, false, sig);
    expect(s.advance(30, false, sig)).toBeLessThanOrEqual(2);
  });
  it('a fixed moment is warmed once, and drawing it again (as the page scrolls) runs nothing', () => {
    const s = streamSim(200); s.size(800);
    expect(s.advance(5, true, sig)).toBeGreaterThan(200);
    expect(s.advance(5, true, sig)).toBe(0);
  });
});
