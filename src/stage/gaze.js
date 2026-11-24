/* Where the eyes look. A real gaze holds still on a point, then jumps to the next (a saccade) in a few tens of
   milliseconds, larger jumps taking longer. Deterministic from the time, so any frame can be reproduced. */

export const LIMIT = { yaw: 0.42, pitch: 0.30 };        // radians either side of straight ahead

const mulberry32 = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ease = x => x * x * (3 - 2 * x);
const plans = new Map();     // seed -> { rnd, list: [{ start, dur, from, to }] }

function plan(seed, t) {
  let p = plans.get(seed);
  if (!p) { p = { rnd: mulberry32(seed * 7919 + 1), list: [{ start: 0, dur: 0, hold: 0.6, from: { yaw: 0, pitch: 0 }, to: { yaw: 0, pitch: 0 } }] }; plans.set(seed, p); }
  while (p.list[p.list.length - 1].start + p.list[p.list.length - 1].dur + p.list[p.list.length - 1].hold <= t) {
    const last = p.list[p.list.length - 1], r = p.rnd;
    const to = { yaw: (r() * 2 - 1) * LIMIT.yaw, pitch: (r() * 2 - 1) * LIMIT.pitch };
    const amp = Math.hypot(to.yaw - last.to.yaw, to.pitch - last.to.pitch);
    p.list.push({ start: last.start + last.dur + last.hold, dur: Math.min(0.07, 0.03 + 0.04 * amp / 1.03), hold: 0.4 + r() * 1.0, from: last.to, to });
  }
  return p.list;
}

export function gazeAt(t, seed = 1) {
  const list = plan(seed, t);
  let lo = 0, hi = list.length - 1;                       // the last saccade that started at or before t
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (list[m].start <= t) lo = m; else hi = m - 1; }
  const s = list[lo], k = s.dur > 0 ? ease(Math.min(1, Math.max(0, (t - s.start) / s.dur))) : 1;
  return { yaw: s.from.yaw + (s.to.yaw - s.from.yaw) * k, pitch: s.from.pitch + (s.to.pitch - s.from.pitch) * k };
}

const clamp = (v, m) => Math.max(-m, Math.min(m, v));

// The turn that points the eyes at a pointer at page position (px, py), the eyes being centred in rect at height eyeY.
export function aimAt(px, py, rect, eyeY) {
  const cx = rect.left + rect.width / 2, D = rect.width * 0.8;     // a viewing distance in pixels
  const yaw = clamp(Math.atan((px - cx) / D), LIMIT.yaw) || 0, pitch = clamp(Math.atan((eyeY - py) / D), LIMIT.pitch) || 0;
  return { yaw, pitch };
}

// Follow the pointer fully for 2 s after it last moved, then ease back to the wander over 1 s.
export function blendGaze(wander, aim, sinceMove) {
  if (!aim || !Number.isFinite(aim.yaw) || !Number.isFinite(aim.pitch)) return wander;
  const w = sinceMove <= 2 ? 1 : sinceMove >= 3 ? 0 : 1 - ease(sinceMove - 2);
  if (w === 1) return aim;
  if (w === 0) return wander;
  return { yaw: wander.yaw + (aim.yaw - wander.yaw) * w, pitch: wander.pitch + (aim.pitch - wander.pitch) * w };
}
