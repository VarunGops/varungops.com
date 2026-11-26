/* Life's background: the lungs' own outline drawn as a glowing red line that leaves long trails, after Jaume
   Sánchez's Lines (Codevember 2016, CC BY 4.0), written afresh. A feedback loop: every step, the last picture is
   enlarged a touch about the lungs and faded, and the outline is drawn on it where the breathing lungs' edge is now
   (breath.js, the same breath and fit the lungs use). The trails stream outwards as the lungs breathe out and hang
   back as they breathe in. */
import { program } from '../gl.js';
import { breath, breathe, fitBox } from '../breath.js';
import { WORDS } from './layer.js';

const QUAD = `#version 300 es
void main(){ vec2 p = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.); gl_Position = vec4(p, 0., 1.); }`;
// the last picture, enlarged about the lungs' centre and faded
const FEED_FS = `#version 300 es
precision highp float;
uniform sampler2D uPrev; uniform vec2 uRes, uC; uniform float uK, uFade;
out vec4 o;
void main(){
  vec2 p = uC + (gl_FragCoord.xy - uC)/uK, e = vec2(.5, 0.);
  o = (texture(uPrev, p/uRes)*2. + texture(uPrev, (p + e)/uRes) + texture(uPrev, (p - e)/uRes) + texture(uPrev, (p + e.yx)/uRes) + texture(uPrev, (p - e.yx)/uRes))/6.*uFade;   // a touch of blur each step: each echo softens as it ages
}`;
// the outline: a soft line, brightest at its core
const LINE_VS = `#version 300 es
in vec2 aP; in float aSide; uniform vec2 uRes; out float vSide;
void main(){ vSide = aSide; gl_Position = vec4(aP/uRes*2. - 1., 0., 1.); }`;
const LINE_FS = `#version 300 es
precision highp float;
in float vSide; uniform float uGain; uniform vec3 uCol; out vec4 o;
void main(){ float k = exp(-vSide*vSide*3.)*uGain; o = vec4(uCol*k, k*max(uCol.r, max(uCol.g, uCol.b))); }`;   // uCol white into the trails; red to the screen
// to the screen: red, burning towards pink where the trails pile up, dimmed under the words
const SHOW_FS = `#version 300 es
precision highp float;
uniform sampler2D uImg; uniform vec2 uRes, uShift; uniform float uCx, uGap, uTop;
${WORDS}
out vec4 o;
void main(){
  float v = texture(uImg, (gl_FragCoord.xy - uShift)/uRes).r*mix(gl_FragCoord.y > uTop ? .3 : .5, 1., smoothstep(0., uGap*1.5, abs(gl_FragCoord.x - uCx)));   // weaker in the gap, where both lungs' echoes meet, and weaker still above them
  float g = 1. - exp(-v*1.6);
  vec3 c = mix(vec3(1., .137, .22), vec3(1., .72, .74), smoothstep(.8, .98, g))*g*clearOfWords();   // pink only where the newest edge is
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;

const STEP = 1 / 60;

export function createGlow(canvas, { lite = false, preserve = false } = {}, json) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: preserve });
  if (!gl || !json || !json.outline) return null;
  const feed = program(gl, QUAD, FEED_FS), line = program(gl, LINE_VS, LINE_FS), show = program(gl, QUAD, SHOW_FS);
  if (!feed || !line || !show) return null;
  const hdr = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
  const loops = json.outline.map(L => { const out = []; for (let i = 0; i < L.length; i += 2) out.push([L[i], L[i + 1]]); return out; });
  const nSeg = loops.reduce((n, L) => n + L.length, 0), verts = new Float32Array(nSeg * 6 * 3);
  const qvao = gl.createVertexArray(), lvao = gl.createVertexArray(), lbuf = gl.createBuffer();
  gl.bindVertexArray(lvao); gl.bindBuffer(gl.ARRAY_BUFFER, lbuf); gl.bufferData(gl.ARRAY_BUFFER, verts.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(line.a('aP')); gl.vertexAttribPointer(line.a('aP'), 2, gl.FLOAT, false, 12, 0);
  gl.enableVertexAttribArray(line.a('aSide')); gl.vertexAttribPointer(line.a('aSide'), 1, gl.FLOAT, false, 12, 8);
  gl.bindVertexArray(null);
  let tex = [], fb = [], cur = 0, W = 0, H = 0, simT = null, lastB = 0, nStep = 0, warmT = null, warmC = null;
  const target = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    if (hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, W, H, 0, gl.RGBA, gl.HALF_FLOAT, null); else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return [t, f]; };
  const rebuild = () => { tex.forEach(t => gl.deleteTexture(t)); fb.forEach(f => gl.deleteFramebuffer(f)); const a = target(), b = target(); tex = [a[0], b[0]]; fb = [a[1], b[1]]; cur = 0; simT = null; warmT = null; };
  const blank = () => { for (const f of fb) { gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } gl.bindFramebuffer(gl.FRAMEBUFFER, null); nStep = 0; };

  // the lungs' edge at breath b, as soft-line triangles in canvas pixels (bottom-left origin); returns the float count
  const outline = (b, fit, half) => {
    const cx = fit.cx, cy = H - fit.cy; let n = 0;
    for (const L of loops) {
      const P = L.map(p => { const q = breathe(p, b, json.size); return [cx + q[0] * fit.s, cy + q[1] * fit.s]; });
      for (let i = 0; i < P.length; i++) {
        const a = P[i], c = P[(i + 1) % P.length], dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * half, ny = dx / l * half;
        verts[n++] = a[0] - nx; verts[n++] = a[1] - ny; verts[n++] = -1; verts[n++] = a[0] + nx; verts[n++] = a[1] + ny; verts[n++] = 1; verts[n++] = c[0] + nx; verts[n++] = c[1] + ny; verts[n++] = 1;
        verts[n++] = a[0] - nx; verts[n++] = a[1] - ny; verts[n++] = -1; verts[n++] = c[0] + nx; verts[n++] = c[1] + ny; verts[n++] = 1; verts[n++] = c[0] - nx; verts[n++] = c[1] - ny; verts[n++] = -1;
      }
    }
    return n;
  };
  const lines = (n, gain, col) => { gl.useProgram(line.p); gl.bindVertexArray(lvao); gl.bindBuffer(gl.ARRAY_BUFFER, lbuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts, 0, n); gl.uniform2f(line.u.uRes, W, H); gl.uniform1f(line.u.uGain, gain); gl.uniform3fv(line.u.uCol, col); gl.drawArrays(gl.TRIANGLES, 0, n / 3); };
  // one feedback step at time t: the old picture grows and fades; every seventh step an echo of the edge is stamped
  const step = (t, v) => {
    const b = breath(t), out = b < lastB; lastB = b; nStep++;
    const fit = fitBox(v.rect, json.size, v.scale), cx = fit.cx, cy = H - fit.cy, half = (lite ? 2.2 : 3.0) * v.scale;
    const nxt = 1 - cur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb[nxt]); gl.viewport(0, 0, W, H); gl.disable(gl.BLEND);
    gl.useProgram(feed.p); gl.bindVertexArray(qvao); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
    gl.uniform1i(feed.u.uPrev, 0); gl.uniform2f(feed.u.uRes, W, H); gl.uniform2f(feed.u.uC, cx, cy);
    gl.uniform1f(feed.u.uK, out ? 1.012 : 1.002); gl.uniform1f(feed.u.uFade, out ? 0.975 : 0.965);   // breathing out the echoes stream away; breathing in they settle and fade
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    if (nStep % 7 === 0) lines(outline(b, fit, half), 0.5, [1, 1, 1]);   // separate echoes of the edge, not a smear
    gl.disable(gl.BLEND); gl.bindVertexArray(null); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    cur = nxt;
  };
  const clear = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
  return {
    size(scale) {
      const w = Math.max(2, Math.round(canvas.clientWidth * scale)), h = Math.max(2, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h || !tex.length) { canvas.width = w; canvas.height = h; W = w; H = h; rebuild(); }
    },
    clear,
    draw(t, v) {
      const fit = fitBox(v.rect, json.size, v.scale), c = [fit.cx, H - fit.cy];
      // a fixed moment is warmed up once, over the four seconds before it (most of a breath), from a blank start, so the
      // same moment always gives the same picture; scrolling then only moves it. Running, the first frame does the same.
      const warm = () => { blank(); simT = t - 4; lastB = breath(simT); warmT = t; warmC = c; };
      if (preserve ? warmT !== t : (simT == null || t - simT > 0.5)) warm();
      let k = 0; while (simT + STEP <= t && k++ < 260) { simT += STEP; step(simT, v); }
      if (!preserve) warmC = c;                                     // running: the trails are drawn where the lungs are each step
      clear(); gl.useProgram(show.p); gl.bindVertexArray(qvao); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
      gl.uniform1i(show.u.uImg, 0); gl.uniform2f(show.u.uRes, W, H); gl.uniform2f(show.u.uShift, c[0] - warmC[0], c[1] - warmC[1]);
      gl.uniform1f(show.u.uCx, c[0]); gl.uniform1f(show.u.uGap, 14 * fit.s); gl.uniform1f(show.u.uTop, c[1] + json.size[1] / 2 * fit.s); gl.uniform4fv(show.u.uText, v.text); gl.uniform4fv(show.u.uNav, v.nav);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // the lungs' edge itself, every frame, exactly where it is now
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      lines(outline(breath(t), fit, (lite ? 1.6 : 2.0) * v.scale), 0.9, [1, 0.3, 0.36]);
      gl.disable(gl.BLEND); gl.bindVertexArray(null);
    },
  };
}
