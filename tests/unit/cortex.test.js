import { describe, it, expect } from 'vitest';
import { yaw, project, fitNeuron, CAMERA } from '../../src/stage/cortex.js';

describe('the turn shared by the neuron and its field', () => {
  it('sways slowly within ±0.35 rad', () => {
    for (let t = 0; t < 120; t += 0.37) { expect(Math.abs(yaw(t))).toBeLessThanOrEqual(0.35); expect(Math.abs(yaw(t + 0.01) - yaw(t))).toBeLessThan(0.01); }
  });
  it('projects the soma to the fit centre, and nearer points further out', () => {
    const fit = { s: 2, cx: 500, cy: 400 };
    expect(project([0, 0, 0], 0, fit)).toEqual([500, 400]);
    const far = project([100, 0, -500], 0, fit), near = project([100, 0, 500], 0, fit);
    expect(near[0] - 500).toBeGreaterThan(far[0] - 500);
    expect(project([0, 100, 0], 0, fit)[1]).toBeLessThan(400);       // up the cell is up the screen
    expect(CAMERA).toBeGreaterThan(1000);
  });
  it('turns about the vertical axis', () => {
    const a = project([100, 0, 0], Math.PI / 2, { s: 1, cx: 0, cy: 0 });
    expect(Math.abs(a[0])).toBeLessThan(1e-9);
  });
  it("fits the cell's height into 90% of its box, the soma placed so the whole cell is centred", () => {
    const f = fitNeuron({ left: 0, top: 0, width: 1000, height: 600 }, 1, [-300, -300, -100], [300, 900, 100]);
    expect(f.s * 1200).toBeCloseTo(540, 5);
    expect(f.cy - 300 * f.s).toBeCloseTo(300 - 0, 0);                  // the cell's middle (y 300) at the box's middle
  });
});
