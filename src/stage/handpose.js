/* Where the two hands are. As in the reference drawing, the upper hand reaches down from the top left and the lower
   hand up from the bottom right, each tilted towards the other; both drift and turn slowly on their own rhythms.
   Positions in mm in the art's frame (+y up, +z towards the viewer), origin at each hand's wrist. */

const TAU = Math.PI * 2;
// rotation matrices, column-major (as WebGL wants): m[col*3 + row]
const rz = a => [Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const ry = a => [Math.cos(a), 0, -Math.sin(a), 0, 1, 0, Math.sin(a), 0, Math.cos(a)];
const rx = a => [1, 0, 0, 0, Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a)];
const mul = (a, b) => { const o = new Array(9); for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2]; return o; };
const wave = (t, period, phase = 0) => Math.sin(TAU * t / period + phase);

export function handPose(t) {
  const upper = {
    m: Float32Array.from(mul(rz(0.44 + 0.16 * wave(t, 11)), mul(ry(0.26 * wave(t, 15, 1)), rx(0.18 * wave(t, 13, 2))))),
    p: [-58 + 16 * wave(t, 12), 188 + 10 * wave(t, 9.5, 0.5), 12 * wave(t, 17)],
  };
  const lower = {
    m: Float32Array.from(mul(rz(0.44 + 0.16 * wave(t, 10, 3)), mul(ry(0.26 * wave(t, 14, 4)), rx(0.18 * wave(t, 16, 5))))),
    p: [58 + 16 * wave(t, 13, 2), -188 + 10 * wave(t, 11, 1.5), 12 * wave(t, 15, 2)],
  };
  return [upper, lower];
}
