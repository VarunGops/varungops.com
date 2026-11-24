/* Where the fibres from the eyes are sweeping. The bundles turn slowly round the whole screen, about once every
   42 seconds, with a slower sway on top so the sweep never looks mechanical. Screen directions: x right, y up. */
const TAU = Math.PI * 2;

export function scanAt(t) {
  const angle = TAU * t / 42 + 0.55 * Math.sin(TAU * t / 19);
  return { angle, dir: [Math.cos(angle), Math.sin(angle)] };
}
