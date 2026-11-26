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
out float vA; out vec3 vCol;
float hash(float n){ return fract(sin(n*12.9898)*43758.5453); }
void main(){
  vec4 c = cortex(aCell.xyz);
  float zr = -c.z*${2600 * 2}., blur = clamp(abs(zr)/120., 0., 1.);   // the soma's depth in focus
  float h = hash(float(gl_VertexID)), level = h > .99 ? 17. : h > .9 ? 1.3 : .35;   // a starfield's few bright, some middling, most faint
  float size = mix(1.2, 4.5, blur)*uPx*(h > .99 ? 2.6 : 1.);           // the bright ones with a faint halo
  float edge = 1. - smoothstep(300., 1000., length(aCell.xy - vec2(0., 250.))); edge *= edge;   // thinning out gradually long before the tissue's edges
  gl_Position = c; gl_PointSize = size;
  vA = level*edge*pow(1.2*uPx/size, 2.);        // out of focus, a point spreads its light: it grows fainter, not foggier
  vCol = mix(vec3(.75, .82, 1.), vec3(1., .9, .8), hash(float(gl_VertexID) + 7.1));
}`;
const FS = `#version 300 es
precision highp float;
in float vA; in vec3 vCol;
uniform float uGain;
${WORDS}
out vec4 o;
void main(){
  vec2 q = gl_PointCoord*2. - 1.; float r2 = dot(q, q), k = exp(-r2*3.5) + exp(-r2*14.)*.8;
  vec3 c = vCol*k*vA*uGain*clearOfWords();
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
      gl.uniform1f(u.uGain, lite ? 1.7 : 1.95); gl.uniform4fv(u.uText, v.text); gl.uniform4fv(u.uNav, v.nav);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, data.ncell);
      gl.disable(gl.BLEND); gl.bindVertexArray(null);
    },
  };
}
