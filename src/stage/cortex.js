/* The Research page's camera, shared by the neuron (neuron.js) and the cells around it (bg/field.js), so the field
   turns exactly with the cell: a slow sway about the vertical axis, a perspective from a camera CAMERA micrometres
   in front of the soma, and the fit of the whole cell into its box. Micrometres about the soma: +x right, +y up
   (the apical dendrite), +z towards the viewer. Screen pixels: top-left origin. */
export const CAMERA = 2600;

// the sway: about 0.3 rad either side, once every 40 s
export const yaw = t => 0.3 * Math.sin(2 * Math.PI * t / 40);

export function project([x, y, z], a, fit) {
  const c = Math.cos(a), s = Math.sin(a), xr = x * c + z * s, zr = -x * s + z * c, f = CAMERA / (CAMERA - zr);
  return [fit.cx + xr * fit.s * f, fit.cy - y * fit.s * f];
}

// the same in GLSL: uFit = (s, cx, cy) in canvas pixels, uYaw, uRes the canvas size; returns clip space
export const PROJECT_GLSL = `
uniform vec3 uFit; uniform float uYaw; uniform vec2 uRes;
vec4 cortex(vec3 p){
  float c = cos(uYaw), s = sin(uYaw), xr = p.x*c + p.z*s, zr = -p.x*s + p.z*c, f = ${CAMERA}./(${CAMERA}. - zr);
  vec2 q = vec2(uFit.y + xr*uFit.x*f, uFit.z - p.y*uFit.x*f);
  return vec4(q.x/uRes.x*2. - 1., 1. - q.y/uRes.y*2., -zr/(${CAMERA}.*2.), 1.);
}`;

// the whole cell (bounds lo, hi): its height 88% of the box's, its top 48 CSS px below the box's top (clear of the link
// home), centred across; box in window pixels, scale device px per CSS px
export const TOP = 48;
export function fitNeuron(box, scale, lo, hi) {
  const s = Math.min(0.88 * box.height * scale / (hi[1] - lo[1]), 1.1 * box.width * scale / (hi[0] - lo[0]));
  return { s, cx: (box.left + box.width / 2) * scale - (lo[0] + hi[0]) / 2 * s, cy: (box.top + TOP) * scale + hi[1] * s };
}
