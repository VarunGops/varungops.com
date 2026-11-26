/* The lungs' breath, shared by the lungs (lungs.js) and the glowing lines behind them (bg/glow.js), so the lines stay
   on the lungs' edge at every moment: the breathing cycle, how the breath moves a point, and how the lungs fit their box.
   Resting breathing, about twelve a minute: two seconds in, three out. The lungs fill mostly downwards, as the
   diaphragm descends, and a little forwards and outwards; the apices hardly move. */
export const BREATH = 5;

// 0 at full breath out, 1 at full breath in
export function breath(t) {
  const p = ((t % BREATH) + BREATH) % BREATH;
  return p < 2 ? 0.5 - 0.5 * Math.cos(Math.PI * p / 2) : 0.5 + 0.5 * Math.cos(Math.PI * (p - 2) / 3);
}

// a point of the lungs seen from the front, in mm about their centre, moved by the breath b (0..1)
export function breathe([x, y], b, size) {
  const u = (y + size[1] / 2) / size[1];
  return [x * (1 + b * 0.025), y - b * 0.06 * size[1] * (1 - u)];
}

// the same in GLSL, with the forward movement too
export const BREATHE_GLSL = `
vec3 breathe(vec3 p, float b, vec3 size){
  float u = clamp((p.y + size.y*.5)/size.y, 0., 1.);
  return vec3(p.x*(1. + b*.025), p.y - b*.06*size.y*(1. - u), p.z + b*.03*size.z*(1. - u));
}`;

// mm to canvas pixels (top-left origin): the lungs' height fills 86% of the box, centred. box in window pixels.
export function fitBox(box, size, scale) {
  const s = 0.86 * box.height * scale / size[1];
  return { s: Math.min(s, 0.84 * box.width * scale / size[0]), cx: (box.left + box.width / 2) * scale, cy: (box.top + box.height / 2) * scale };
}
