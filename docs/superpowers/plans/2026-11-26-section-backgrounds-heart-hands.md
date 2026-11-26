# Section backgrounds, first slice: About and Clinical Experience — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the shared full-screen background layer for section pages, and the first two backgrounds on it: red pulse rings behind the About heart, and graphite flow lines behind the Clinical Experience hands.

**Architecture:** Each section page that has a background gets a second fixed canvas, `#bg`, behind the anatomy's canvas inside `main`. A small layer module (`src/stage/bg/layer.js`) owns its lifecycle: start once the anatomy is live, fade in, size within the pixel cap, run its own frame loop, dim under the words, pause when hidden, and handle a lost context. It does not touch the anatomy's renderer. Each background is a module with a `create*(canvas, opts)` factory returning `{ size(), draw(t, view), clear() }`. The rings read the shared heartbeat (`clock.js`).

**Tech Stack:** Astro 7.4, raw WebGL 2 (no libraries), Vitest 5, Playwright 1.65.

**Spec:** `docs/superpowers/specs/2026-11-24-section-art-design.md`, section "Revision, 26 November 2026: a background effect for every section page" (approved 26 Nov).

## Global Constraints

- Written afresh in raw WebGL 2, no libraries; credited on the page with source and licence.
- The anatomy is never altered to suit a background; `heart.js` and `hands.js` are not edited.
- Clear of the words: each background dims where `.side-body` and the way home (`.side-top .home-link`) sit.
- Phone (`innerWidth < 700`) gets a lighter version; the page budget stays 3 MB desktop / 2 MB phone (`scripts/check-dist.mjs`).
- Reduced motion: one still frame, no loop. Off screen: paused and cleared.
- Fades in after the anatomy is live; fades out (not slides) between pages.
- Canvas pixel cap as elsewhere: scale = `min(devicePixelRatio, 1.5, sqrt(7e6 / cssArea))`.
- Review switches `?hage=` / `?hyaw=` fix the moment, as for the anatomy (`preserveDrawingBuffer` on, draw once).
- Colours: About red `#ff2338` (`--red`) on black; Clinical Experience graphite grey, as the hands.

## Review Focus

1. Long About page scrolled to the end: the rings' centre must follow the heart and the layer must pause and clear once the heart is well off screen. Test in Task 1.
2. A phone rotated or a window resized: the `#bg` canvas resizes to the new size, not a stretched old frame. Test in Task 1.
3. The background's context lost on its own: the anatomy stays live and the page does not fall back to its still. Test in Task 1.
4. Body text over the background: pixels under `.side-body` are much darker than the same background elsewhere. Test in Task 1 (About) and Task 2 (hands).
5. Coming back to a page through the slide transition: the background is live again. Test in Task 1.

---

### Task 1: The shared background layer, and the pulse rings on About

**Files:**
- Create: `src/stage/bg/layer.js`, `src/stage/bg/rings.js`
- Modify: `src/components/Art.astro` (add `#bg` canvas for kinds that have a background), `src/stage/side.js` (start the layer after the art starts), `src/styles/global.css` (`.bg-canvas`), `src/components/Credits.astro` (heart line)
- Test: `tests/unit/backdrop-layer.test.js`, `tests/e2e/backgrounds.spec.js`

**Interfaces:**
- Produces, in `layer.js`:
  - `export const BG = { heart: 'rings', hands: 'flow' }` — which page kind has which background.
  - `export function canvasScale(cssW: number, cssH: number, dpr: number): number` — the pixel-cap rule above.
  - `export function startBackground({ canvas: HTMLCanvasElement, host: HTMLElement, kind: string, reduce: boolean, fixedAge: number|null }): void` — loads the background's module by `BG[kind]`, sets `html.dataset.bg` to `'live'` (drawing), `'off'` (no WebGL 2, failed, or lost).
  - The `view` object passed to every `draw(t, view)`: `{ W, H, scale, centre: [x, y], text: [x0, y0, x1, y1], nav: [x0, y0, x1, y1] }`, in canvas pixels with the origin at the bottom left (as `uText` in `hands.js`); `centre` is the centre of `host`.
- Produces, in `rings.js`:
  - `export function ringsAt(t: number, { count = 6, speed }: { count?: number, speed: number }): Array<{ radius: number, alpha: number, volley: boolean }>` — the rings alive at time `t`, newest first, one per past beat from `clock.beat(t)`; `radius = age * speed` (age = seconds since that beat), `alpha` falls from 1 to 0 over `count * T`, `volley` is `amp(n) === 1`.
  - `export function createRings(canvas, { lite, preserve }): { size(scale), draw(t, view), clear() } | null`.
- Consumes: `beat`, `amp`, `T` from `src/stage/clock.js`.

- [ ] **Step 1: Write the failing unit tests** in `tests/unit/backdrop-layer.test.js`:

```js
import { canvasScale, BG } from '../../src/stage/bg/layer.js';
import { ringsAt } from '../../src/stage/bg/rings.js';
import { T } from '../../src/stage/clock.js';
test('the canvas never passes 1.5x or seven million pixels', () => {
  expect(canvasScale(400, 800, 3)).toBe(1.5);
  const s = canvasScale(3840, 2160, 2); expect(3840 * 2160 * s * s).toBeLessThanOrEqual(7e6 + 1);
});
test('only the heart and the hands have a background so far', () => { expect(BG).toEqual({ heart: 'rings', hands: 'flow' }); });
test('a ring leaves with each beat and widens', () => {
  const a = ringsAt(4 * T + 0.01, { speed: 300 }), b = ringsAt(4 * T + 0.5, { speed: 300 });
  expect(a[0].radius).toBeLessThan(5); expect(b[0].radius).toBeGreaterThan(a[0].radius);
  expect(a[0].volley).toBe(true); expect(ringsAt(5 * T + 0.01, { speed: 300 })[0].volley).toBe(false);
});
test('older rings are fainter and there are never more than count', () => {
  const r = ringsAt(20 * T + 0.3, { count: 6, speed: 300 });
  expect(r.length).toBeLessThanOrEqual(6);
  for (let i = 1; i < r.length; i++) { expect(r[i].radius).toBeGreaterThan(r[i - 1].radius); expect(r[i].alpha).toBeLessThan(r[i - 1].alpha); }
});
```

- [ ] **Step 2: Run them to see them fail.** Run: `npx vitest run tests/unit/backdrop-layer.test.js`. Expected: FAIL, cannot resolve `src/stage/bg/layer.js`.

- [ ] **Step 3: Implement `canvasScale`, `BG` and `ringsAt`.** `layer.js` must import nothing that touches the DOM at module load, so the unit test can import it.

- [ ] **Step 4: Run the unit tests.** Expected: PASS (4).

- [ ] **Step 5: Write the failing e2e tests** in `tests/e2e/backgrounds.spec.js`, reusing the pixel helper pattern of `sides.spec.js` (`bright(page, sel, cond)`, `noWebGL`, `countRaf`):
  - `About draws red rings round the heart`: `/about/?hage=0.3&hyaw=0` → `html[data-bg="live"]`; `bright(page, '#bg', 'r > 60 && g < 40 && b < 50') > 40`.
  - `the rings move with the beat`: the `#bg` pixels at `?hage=0.1&hyaw=0` and `?hage=0.7&hyaw=0` differ in more than 2% of a 96×48 sample.
  - `the words sit on a dimmed background`: at `?hage=0.3&hyaw=0`, the mean brightness of `#bg` inside the `.side-body` rect is under half the mean in an equal-sized area outside it (sample with `drawImage` on a crop of the canvas, as in `bright`).
  - `the heart keeps beating when the background's context is lost`: lose `#bg`'s context → `html[data-bg="off"]`, `#bg` hidden, `html[data-stage="live"]` still.
  - `no WebGL 2: no background and the heart's still shows`: with `noWebGL` → `data-bg="off"`, `img.still-heart` visible, no page errors.
  - `reduced motion: one frame, no loop`: as in `sides.spec.js`, rAF count over 1.5 s is at most 1 with the background present.
  - `scrolled to the end, the rings stop`: scroll to the page's bottom, wait 1 s, `#bg` is blank (`bright(..., 'r > 30') === 0`).
  - `a resize resizes the background`: after `setViewportSize({ width: 600, height: 900 })`, `#bg.width === Math.round(600 * scale)` where scale comes from `canvasScale`.
  - `back from home, the background is live again`: open `/about/`, click the way home, go back, `data-bg="live"`.
  - `Now has no #bg`: `/now/` has no `#bg` element.
  - `the credit names the source`: on `/about/` the footer contains `Pulse rings adapted from Jaume Sánchez’s DOF Tunnel (Codevember 2016), CC BY 4.0.`

- [ ] **Step 6: Run them to see them fail.** Run: `npx playwright test tests/e2e/backgrounds.spec.js`. Expected: FAIL, no `#bg` element.

- [ ] **Step 7: Implement the layer and the rings.**
  - `Art.astro`: `<canvas id="bg" class="bg-canvas" aria-hidden="true"></canvas>` as the first child of the art host when `BG[kind]` exists. The heart's host is `.art[data-art="heart"]`.
  - `global.css`: `.bg-canvas{position:fixed;inset:0;width:100%;height:100%;z-index:-2;pointer-events:none;opacity:0;transition:opacity 1.2s ease;view-transition-name:section-bg}`, `html[data-bg="live"][data-stage="live"] .bg-canvas{opacity:1}`, `html[data-bg="off"] .bg-canvas{visibility:hidden}`, `::view-transition-old(section-bg),::view-transition-new(section-bg){animation-duration:.6s}`. `main` is already `position:relative;z-index:2`, so `z-index:-2` stays above the body's black and under `.art-canvas` (−1) and the heart.
  - `side.js`: after `start()` has made `art`, if `document.getElementById('bg')`, `import('./bg/layer.js')` and call `startBackground({ canvas, host, kind, reduce, fixedAge: AGE })`.
  - `layer.js`: context made with `{ alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: fixedAge != null }`; its own rAF loop, at most 60 draws a second, none while `document.hidden`; an IntersectionObserver on `host` with `rootMargin: '60% 0px'` that calls `clear()` and pauses when it leaves; `view.text` from `.side-body`'s rect and `view.nav` from `.side-top .home-link`'s rect each frame; `webglcontextlost` → `data-bg="off"`, `webglcontextrestored` → rebuild and `data-bg="live"`. With `fixedAge` or `reduce`, draw once per layout at `t = fixedAge ?? 0.9`.
  - `rings.js`: one full-screen triangle; the fragment shader takes up to 6 rings (`uRing[6]` as vec3 radius, alpha, volley) and `uCentre`, and draws each as a thin band of `--red` whose width and softness grow with its radius (out of focus at the edge, as in the demo), brighter for a volley. Output premultiplied with alpha = max(rgb) (the compositing rule the eyes learned). `speed` = 0.45 × the screen diagonal per second; on a phone, 4 rings instead of 6. Words: multiply by `mix(.2, 1., box(text))*box(nav)`, the rounded-box SDF used in `hands.js`.
  - `Credits.astro`: add the heart's second line, exactly as in the test.

- [ ] **Step 8: Run unit and e2e.** Run: `npx vitest run && npx playwright test tests/e2e/backgrounds.spec.js tests/e2e/sides.spec.js`. Expected: all pass.

- [ ] **Step 9: Look at it.** Build, open `/about/` in the preview at desktop and 375 px, and screenshot at three moments. The rings must read as the heart's pulse, never over the words.

- [ ] **Step 10: Commit** `src/stage/bg/ src/components/Art.astro src/components/Credits.astro src/stage/side.js src/styles/global.css tests/` — "About: pulse rings leave the heart with each beat".

### Task 2: Graphite flow lines on Clinical Experience

**Files:**
- Create: `src/stage/bg/flow.js`
- Modify: `src/components/Credits.astro` (hands line)
- Test: `tests/e2e/backgrounds.spec.js`

**Interfaces:**
- Consumes: `startBackground`, the `view` object and `BG.hands === 'flow'` from Task 1.
- Produces: `export function createFlow(canvas, { lite, preserve }): { size(scale), draw(t, view), clear() } | null`.

- [ ] **Step 1: Add the failing e2e tests:**
  - `Clinical Experience draws graphite lines`: `/clinical-experience/?hage=2&hyaw=0` → `data-bg="live"`; `bright(page, '#bg', 'Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r > 35') > 300`.
  - `the lines are strokes, not a wash`: in a 96×48 sample of `#bg`, the standard deviation of brightness is above 12.
  - `the words sit on a dimmed background`: as in Task 1, on this page.
  - `the red strings still show over it`: the existing `sides.spec.js` hands test (`r > 150 && g < 90 && b < 90` on `#art`) still passes.
  - `the credit names the source`: footer contains `Flow lines adapted from Jaume Sánchez’s Lines on a sphere (Codevember 2016), CC BY 4.0.`

- [ ] **Step 2: Run to see them fail.** Expected: FAIL, `createFlow` missing, so `data-bg="off"`.

- [ ] **Step 3: Implement `createFlow`.** A full-screen line-integral-convolution pass: for each pixel, step 14 times each way along the 2D curl of 3D simplex noise at `(x, y) * freq` and `z = t * 0.02`. Sum a white-noise value hashed on a fixed pixel grid at each step, so the result is a field of short strokes all following the current. Multiply by a low-frequency noise for patches of light and dark shading, like the demo. Graphite grey (about `rgb(150,150,150)` at the brightest, alpha = max(rgb)), dimmed under the words as in Task 1. Draw it into a half-resolution buffer (quarter on a phone), at most 30 times a second, scaled up to the canvas.

- [ ] **Step 4: Run the tests.** Run: `npx playwright test tests/e2e/backgrounds.spec.js tests/e2e/sides.spec.js`. Expected: all pass.

- [ ] **Step 5: Look at it.** Desktop and 375 px, three moments. The lines must read as pencil hatching behind the hands, and the hands and red strings must stay the subject.

- [ ] **Step 6: Commit** — "Clinical Experience: graphite flow lines behind the hands".

### Task 3: Critique, stills, full checks

**Files:** none new.

- [ ] **Step 1:** Capture both pages live at 5, 10 and 16 s, desktop and phone, and run independent art-director critic rounds against the two source demos (Codevember 2016 #19 and #20) and the spec's behaviour lines. Fix what they find, re-capture, and repeat until the scores stop rising.
- [ ] **Step 2:** `node scripts/make-stills.mjs`, `npm run build`, `node scripts/check-dist.mjs` (budgets), `npx vitest run`, `npx playwright test`. Expected: all pass, budgets within 3 MB / 2 MB.
- [ ] **Step 3:** Commit, then show Dr Rajan both pages side by side with their source demos.
