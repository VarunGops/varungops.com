/* A string between two moving points: a chain of particles stepped with Verlet integration under gravity, its
   segment lengths held by repeated constraint passes. Millimetres and seconds. */

export function createRope(a, b, segments, slack) {
  const n = segments + 1, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = a[k] + (b[k] - a[k]) * i / segments;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * (1 + slack) / segments;
  return { n, pos, prev: pos.slice(), len };
}

// Each call is cut into substeps of at most 1/240 s: with a whole frame's gravity at once, a string under its own
// weight stretches visibly before the constraint passes can pull it back.
export function stepRope(rope, a, b, dt, gravity = [0, -9810, 0]) {
  const k = Math.max(1, Math.ceil(dt * 240));
  for (let s = 0; s < k; s++) substep(rope, a, b, dt / k, gravity);
}

function substep(rope, a, b, dt, gravity) {
  const { n, pos, prev, len } = rope, last = (n - 1) * 3;
  for (let i = 3; i < last; i += 3) for (let k = 0; k < 3; k++) {
    const p = pos[i + k], v = (p - prev[i + k]) * 0.985;            // a little air damping
    prev[i + k] = p; pos[i + k] = p + v + gravity[k] * dt * dt;
  }
  for (let k = 0; k < 3; k++) { pos[k] = prev[k] = a[k]; pos[last + k] = prev[last + k] = b[k]; }
  for (let it = 0; it < 12; it++) {
    for (let i = 0; i < n - 1; i++) {
      const j = i * 3, dx = pos[j + 3] - pos[j], dy = pos[j + 4] - pos[j + 1], dz = pos[j + 5] - pos[j + 2];
      const d = Math.hypot(dx, dy, dz) || 1e-9, diff = (d - len) / d;
      const wa = i === 0 ? 0 : i === n - 2 ? 1 : 0.5, wb = i === 0 ? 1 : i === n - 2 ? 0 : 0.5;   // pinned ends never move
      pos[j] += dx * diff * wa; pos[j + 1] += dy * diff * wa; pos[j + 2] += dz * diff * wa;
      pos[j + 3] -= dx * diff * wb; pos[j + 4] -= dy * diff * wb; pos[j + 5] -= dz * diff * wb;
    }
  }
}

export const ropePoints = rope => rope.pos;

// Where the simulation picks up at time t. After more than half a second without frames (another tab, scrolled away,
// back from the cache) the hands have moved on: re-hang the strings at the new pose instead of dragging them there.
export function catchUp(simT, t, gap = 0.5) {
  if (simT == null || t - simT > gap) return { rehang: true, from: t };
  return { rehang: false, from: simT };
}
