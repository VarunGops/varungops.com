/* Where the fountain of fibres from the eyes leans: it stays upright, swaying about 35 degrees either side of straight
   up, about once a minute. It never tips over sideways, where the bundle would leave the eye like a beam, and never
   down into the words beneath the eyes; the canopy's own width and fall carry the fibres across the screen. A slower sway on top keeps the sweep from looking mechanical.
   Screen directions: x right, y up. The page's shader repeats this formula (eyes.js, scanAngle). */
const TAU = Math.PI * 2;

export function scanAngle(t) {
  return Math.PI / 2 + 0.61 * Math.sin(TAU * t / 60 + 0.3 * Math.sin(TAU * t / 23));
}
export function scanAt(t) {
  const angle = scanAngle(t);
  return { angle, dir: [Math.cos(angle), Math.sin(angle)] };
}
