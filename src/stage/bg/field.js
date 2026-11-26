/* Research's background: the real cell bodies around the neuron, from the same cubic millimetre of human cortex (H01),
   each a soft point at its true position, after the deep field of Jaume Sánchez's Starfield (Codevember 2016, CC BY
   4.0), written afresh. Points at the neuron's depth are small and sharp; nearer and further ones grow soft and faint,
   as out of focus. They turn with the neuron (cortex.js), so the cell sits inside its tissue, not in a void. */
import { program } from '../gl.js';
import { yaw, PROJECT_GLSL, fitNeuron } from '../cortex.js';
import { WORDS } from './layer.js';

const VS = `#version 300 es
in vec4 aCell;                                   // x y z (um about the soma), size (voxels at 4 um)
${PROJECT_GLSL}
uniform float uPx;
out float vBlur; out float vDepth; out float vEdge;
void main(){
  vec4 c = cortex(aCell.xyz);
  vEdge = 1. - smoothstep(350., 820., length(aCell.xy - vec2(0., 250.)));   // the field fades out before the tissue's edges
  float zr = -c.z*${2600 * 2}.;                  // back to um towards the viewer
  float blur = clamp(abs(zr)/140., 0., 1.);      // the soma's depth in focus
  float r = (1.2 + sqrt(aCell.w)*.7)*uFit.x*1.8; // a cell body some 10 um across, in device px
  gl_Position = c; gl_PointSize = clamp(r*(1. + 3.*blur), 1.5*uPx, 26.*uPx);
  vBlur = blur; vDepth = clamp(zr/200., -1., 1.);
}`;
const FS = `#version 300 es
precision highp float;
in float vBlur; in float vDepth; in float vEdge;
uniform float uGain;
${WORDS}
out vec4 o;
void main(){
  vec2 q = gl_PointCoord*2. - 1.; float d = dot(q, q);
  float a = exp(-d*mix(9., 2.2, vBlur))*mix(1., .28, vBlur);           // sharp in focus; soft and faint out of it
  vec3 col = mix(vec3(.72, .78, 1.), vec3(1., .86, .78), .5 + .25*vDepth);   // a faint, cool-white light, a touch warmer nearer
  vec3 c = col*a*vEdge*uGain*clearOfWords();
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;

export function createField(canvas, { lite = false, preserve = false } = {}, data) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: preserve });
  if (!gl || !data) return null;
  const pr = program(gl, VS, FS); if (!pr) return null;
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data.cells, gl.STATIC_DRAW);
  const l = pr.a('aCell'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  const clear = () => { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
  return {
    size(scale) {
      const W = Math.max(2, Math.round(canvas.clientWidth * scale)), H = Math.max(2, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    },
    clear,
    draw(t, v) {
      const fit = fitNeuron(v.rect, v.scale, data.lo, data.hi), a = v.fixedYaw != null ? v.fixedYaw : yaw(t);
      clear(); gl.useProgram(pr.p); gl.bindVertexArray(vao);
      const u = pr.u;
      gl.uniform3f(u.uFit, fit.s, fit.cx, fit.cy); gl.uniform1f(u.uYaw, a); gl.uniform2f(u.uRes, canvas.width, canvas.height); gl.uniform1f(u.uPx, v.scale);
      gl.uniform1f(u.uGain, lite ? 0.16 : 0.12); gl.uniform4fv(u.uText, v.text); gl.uniform4fv(u.uNav, v.nav);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, data.ncell);
      gl.disable(gl.BLEND); gl.bindVertexArray(null);
    },
  };
}
