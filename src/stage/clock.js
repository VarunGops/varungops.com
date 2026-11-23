// One heartbeat clock that the brain, the smoke and the heart all read.
export const T = 0.96;               // one heartbeat, seconds (about 62 a minute)
export const TA = 0.36;              // seconds from a beat to its impulse reaching the cortex
export const SPEED = 1 / TA;         // a pathway runs from 0 at the centre of the brain to 1 at its end
export const BURST_EVERY = 4;        // every fourth beat is a full volley, with a smoke burst
export const BURST_DELAY = TA;       // the smoke leaves as that volley reaches the surface
export const SOFT = 0.42;            // strength of the three beats between volleys

export const beat = t => { const n = Math.floor(t / T); return { n, a: t - n * T }; };
export const amp = n => (n % BURST_EVERY === 0 ? 1 : SOFT);
export const flash = a => { const d = a - TA; return d < 0 ? Math.exp(-d * d / 0.004) : Math.exp(-d / 0.32); };

// Where the last four impulses have reached along a pathway (0 centre, 1 end); -1 when there is no such beat.
export const heads = (t, n) => [0, 1, 2, 3].map(i => (n < 0 || n - i < 0 ? -1 : (t - (n - i) * T) * SPEED));
export const amps = n => [0, 1, 2, 3].map(i => amp(n - i));

export const glow = t => { const { n, a } = beat(t); return Math.min(1, amp(n) * flash(a) + amp(n - 1) * flash(a + T)); };

const volley = t => Math.floor(beat(t).n / BURST_EVERY) * BURST_EVERY;
export const burstAge = (t, i) => t - ((volley(t) - i * BURST_EVERY) * T + BURST_DELAY);
export const burstSeed = (t, i) => ((((volley(t) - i * BURST_EVERY) * 0.6180339887) % 1) + 1) % 1 * 40;
