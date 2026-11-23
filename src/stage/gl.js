// Small WebGL 2 helpers shared by the brain, the smoke and the heart.
import { YC, ZC } from './cord.js';

export function program(gl, vs, fs) {
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS) && !gl.isContextLost()) console.error(gl.getShaderInfoLog(o)); return o; };
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { if (!gl.isContextLost()) console.warn('WebGL program did not link:', gl.getProgramInfoLog(p)); return null; }
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
  return { p, u, a: name => gl.getAttribLocation(p, name) };
}

// MNI millimetres (x right, y anterior, z up), seen from the right side and turned by the yaw, to page pixels.
export const PROJ = `
uniform vec4 uView;   // cos yaw, sin yaw, page px per mm, unused
uniform vec2 uAnchor; // page px of the model origin
uniform vec2 uRes;    // stage size in page px
vec3 proj(vec3 p){
  float yp = p.y - (${YC}.), zp = p.z - (${ZC}.);
  float yr = yp*uView.x - p.x*uView.y, xr = yp*uView.y + p.x*uView.x;
  return vec3(uAnchor.x + yr*uView.z, uAnchor.y - zp*uView.z, xr);
}
vec4 clip(vec3 s){ return vec4(s.x/uRes.x*2. - 1., 1. - s.y/uRes.y*2., -s.z/300., 1.); }`;

// Instanced line segments: a(3) b(3) s(2) colour(3) half-width(1) per instance, drawn as a quad.
export function lineSet(gl, stride) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  for (const [loc, size, off] of [[1, 3, 0], [2, 3, 3], [3, 2, 6], [4, 3, 8], [5, 1, 11]]) {
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, off * 4); gl.vertexAttribDivisor(loc, 1);
  }
  gl.bindVertexArray(null);
  return { vao, count: 0, set(data) { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); this.count = data.length / stride; } };
}

// The cord's surface, in the brain mesh's vertex layout: position(3) normal(3) colour(3) relief(1) fade(1).
export function tubeSet(gl, stride) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  for (const [loc, size, off] of [[0, 3, 0], [1, 3, 3], [4, 3, 6], [3, 1, 9], [5, 1, 10]]) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, off * 4); }
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bindVertexArray(null);
  return { vao, count: 0, set(v, i) { gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, v, gl.DYNAMIC_DRAW); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, i, gl.DYNAMIC_DRAW); gl.bindVertexArray(null); this.count = i.length; } };
}
