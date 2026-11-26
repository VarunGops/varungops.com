# Life: breathing lungs and their glowing lines — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the real lungs on the Life page as a breathing red engraving, with the glowing-lines background trailing off their outline as they breathe.

**Architecture:** A prep script turns the Human Reference Atlas lung into `lungs.bin/json` (and a lite pair), including the lungs' front-view outline as 2D loops. `lungs.js` draws them as a wide piece (full-screen `#art` canvas mapped to its box, like the hands), breathing on a shared breath clock. The background (`bg/glow.js`, on the existing layer) draws the same outline, displaced by the same breath and fitted by the same box mapping, into a feedback buffer that is expanded and faded every frame, so the lines leave long glowing trails. The breath and the box fit live in one module (`breath.js`) that both import.

**Tech Stack:** Python 3 + numpy + PIL + matplotlib (prep), Astro 7.4, raw WebGL 2, Vitest 5, Playwright 1.65.

**Spec:** `docs/superpowers/specs/2026-11-24-section-art-design.md` — "The pieces" (Life row), "How each piece behaves" (Lungs), and the 26 Nov revision (Life: glowing lines).

## Global Constraints

- The anatomy is real and unaltered in shape: kept as given, welded, simplified, converted to mm. Nothing invented. The file is the Visible Human **Female** lung (all parts `VH_F_…`) although its NIH 3D page (3DPX-021008) says male; credit it as what it is.
- Credit: "Lungs adapted from the Human Reference Atlas 3D reference organs (NIH 3D 3DPX-021008), created from the Visible Human Female, National Library of Medicine. CC BY 4.0." and "The glowing lines are adapted from Jaume Sánchez’s Lines (Codevember 2016), CC BY 4.0."
- Red engraving like the heart; front view; resting breathing, about 12 a minute (5 s a breath: 2 s in, 3 s out); expansion mostly downwards and forwards (the diaphragm), bronchi showing through as finer lines.
- Raw WebGL 2, no libraries. Page budget 3 MB desktop / 2 MB phone (`check-dist.mjs`), with `still/lungs.webp` and `still/lungs-phone.webp`.
- Everything the eyes and hands already do: stills until live, reduced motion draws once, context loss falls back to the still, phone loads `lungs-lite`, `?hage`/`?hyaw` fix the frame.
- Background rules from the first slice: its own `#bg` canvas, dims under the words, never takes the anatomy down.

## Review Focus

1. The outline and the engraving drift apart (different fit or breath formula): the glowing lines must sit on the lungs' edge at every breath phase. Test in Task 3 (unit: one function used by both; e2e: glow pixels near the lungs' edge).
2. The cartilage rings (≈120,000 tiny pieces) sneak into the data and blow the budget. Test in Task 1 (prep classifies them out; size printed and checked by `check-dist`).
3. A resize mid-breath leaves the feedback buffer at the old size, smeared. Test in Task 3 (resize → buffer matches the canvas).
4. Reduced motion: the trails need history; one frame must still show the outline glowing, not a blank. Test in Task 3.
5. Phone: the lungs fit the narrow box and the lite data loads. Test in Task 2 (existing parametrised wide-piece tests extended to lungs).

---

### Task 1: Prep the lungs

**Files:**
- Create: `prep/prep_lungs.py`, `prep/test_prep_lungs.py`
- Modify: `prep/README.md` (source, download link, command, credit)
- Output (committed): `public/data/lungs.bin`, `lungs.json`, `lungs-lite.bin`, `lungs-lite.json`

**Interfaces:**
- Produces `lungs.json`: `{ verts, faces, lo, hi, units: "mm", classes: ["surface", "bronchus"], centre: [x,y,z], size: [w,h,d], outline: [[x0,y0,x1,y1,…], …] }` — mm, origin at the lungs' bounding-box centre, +x subject's left, +y up, +z forward; `outline` is one closed loop per lung in the front view (x, y), simplified to about 1 mm.
- Produces `lungs.bin`: per vertex 12 bytes as `eyes.bin` (uint16×3 position, int8×3 normal, class byte, spare byte), then uint32 faces.

- [ ] **Step 1: Write the failing tests** in `prep/test_prep_lungs.py`: `classify('VH_F_cartilage_of_tertiary_bronchus_L')` is `None`; `classify('VH_F_right_apical_bronchopulmonary_segment')` is `0`; `classify('VH_F_hilum_lower_R')` is `0`; `classify('VH_F_left_superior_lobar_bronchus')` is `1`; `classify('VH_F_left_lingula_inferior_bronchi')` is `1`; an unknown name raises `SystemExit`; `outline_loops(mask)` on a mask with two separate filled discs returns two closed loops, each within 1.5 px of its disc's edge.
- [ ] **Step 2:** Run `cd prep && python3 -m pytest test_prep_lungs.py -q`. Expected: FAIL (no module).
- [ ] **Step 3: Implement `prep_lungs.py`**: `classify(name) -> 0|1|None` (segments and hilum → 0 surface; `*_bronchus`, `*_bronchi` → 1; `cartilage_of_*` → None; anything else → SystemExit); `outline_loops(mask, step) -> list[np.ndarray]` (matplotlib `contour` at 0.5 on the mask, closed loops longer than 40 px, simplified); `main(glb, out)`: m → mm, weld, `cluster_decimate` (surface 1.6 mm, bronchi 0.9 mm; lite ×1.7), centre on the surface's bounding box, front-view mask by drawing every surface triangle's (x, y) with PIL at 0.5 mm, outline from it, write both sizes.
- [ ] **Step 4:** Tests pass. Run `python3 prep/prep_lungs.py raw/3d-vh-f-lung.glb public/data`. Expected: prints both sizes; `lungs` under 1.2 MB, `lungs-lite` under 0.6 MB; `outline` has 2 loops.
- [ ] **Step 5: Commit** — "Prep: the lungs from the Human Reference Atlas (Visible Human Female)".

### Task 2: The breathing lungs on Life

**Files:**
- Create: `src/stage/breath.js`, `src/stage/lungs.js`
- Modify: `src/lib/stops.js` (`life` → `art: 'lungs'`), `src/stage/data.js` (`decodeLungs`), `src/stage/side.js` (ART entry), `src/components/Art.astro` (alt text), `src/components/Credits.astro` (lungs line), `scripts/make-stills.mjs` and `scripts/check-dist.mjs` (lungs), `tests/unit/stops.test.js`
- Test: `tests/unit/breath.test.js`, `tests/e2e/sides.spec.js` (add lungs to the wide-piece list)

**Interfaces:**
- `breath.js`:
  - `export const BREATH = 5` (seconds); `export function breath(t: number): number` — 0 at full exhale, 1 at full inhale: rises over the first 2 s with an ease-in-out, falls over the next 3 s.
  - `export function breathe([x, y]: [number, number], b: number, size: [number, number, number]): [number, number]` — the front-view displacement shared with the shader: `y -= b * 0.06 * size[1] * (1 - u)` where `u = (y + size[1]/2) / size[1]` (bases move most, apices hardly), `x *= 1 + b * 0.025`.
  - `export function fitBox(box: {left, top, width, height}, size: [number, number, number], scale: number): { s: number, cx: number, cy: number }` — mm → canvas pixels (bottom-left origin) fitting the lungs' height into 86% of the box, centred.
  - `export const BREATHE_GLSL` — the same displacement in GLSL (`vec3 breathe(vec3 p, float b, vec3 size)`), also moving z forward by `b * 0.03 * size.z * (1 - u)`.
- `lungs.js`: `export function createLungs(canvas, mesh, json, { preserve, box })` → `{ size(), draw(t, fixed), clear() }`, same shape as `createHands`.

- [ ] **Step 1: Write the failing unit tests** `tests/unit/breath.test.js`: `breath(0) === 0`; `breath(2)` ≈ 1; `breath(5)` ≈ 0; `breath` is between 0 and 1 for 200 samples over 10 s; `breathe([0, -size/2], 1, …)` moves y down by about 6% of the height while `breathe([0, +size/2], 1, …)` barely moves; `fitBox` centres `[0,0]` on the box centre and fits the height to 86%. `stops.test.js`: Life's art is `'lungs'`.
- [ ] **Step 2:** Run `npx vitest run`. Expected: FAIL.
- [ ] **Step 3: Implement** `breath.js`, then `lungs.js`: the heart's two-pass engraving (solid depth pass, then additive lines) on the lung surface — lines ringing the lungs horizontally (`vP.y * 0.42`), swelling in the light, a crossing hatch only in full light, a rim; the bronchi drawn after with depth test off at 45% strength as finer, brighter lines, so they show through. Breathing through `BREATHE_GLSL` with `breath(t)`; a slow sway of ±0.12 rad. Mapping via `fitBox` on the host box, full-screen canvas like the hands.
- [ ] **Step 4:** Wire it in: `stops.js`, `data.js` `decodeLungs` (as `decodeEyes`), `side.js` ART `lungs` (lite part `lungs-lite`, `box: host`), `Art.astro` alt "A pair of human lungs from the front, drawn as a red engraving, breathing", credits, stills and dist checks.
- [ ] **Step 5: Add lungs to the e2e wide-piece list** in `sides.spec.js`: `['lungs', '/life/', /lungs/i, /Lungs adapted from the Human Reference Atlas[\s\S]*Visible Human Female/, 'r > 70 && g < 60 && b < 70']`.
- [ ] **Step 6:** Run unit and `npx playwright test tests/e2e/sides.spec.js`. Expected: all pass.
- [ ] **Step 7:** Look at it at desktop and 375 px. The lungs must read at a glance, breathe visibly but calmly, and the bronchi must show through.
- [ ] **Step 8: Commit** — "Life: the lungs breathe, drawn as a red engraving".

### Task 3: The glowing lines behind the lungs

**Files:**
- Create: `src/stage/bg/glow.js`
- Modify: `src/stage/bg/layer.js` (`BG.lungs = 'glow'`, MAKE entry), `src/components/Art.astro` (`BG` set gains `lungs`), `src/components/Credits.astro`, `tests/unit/backdrop-layer.test.js` (`BG` now includes lungs)
- Test: `tests/e2e/backgrounds.spec.js`

**Interfaces:**
- Consumes `breath`, `breathe`, `fitBox` from Task 2, and the layer's `view` (needs `box`: the host's rect in canvas pixels — add `box: [left, bottom, width, height]` to `view`).
- Produces `createGlow(canvas, { lite, preserve }, json)` → `{ size(scale), draw(t, view), clear() }`. The layer passes the page's data JSON when the background needs it (`MAKE.glow` loads `/data/lungs(-lite).json` itself through `loadPart`'s JSON only).

- [ ] **Step 1: Write the failing tests**: unit — `BG` is `{ heart: 'rings', hands: 'flow', lungs: 'glow' }`; e2e — `Life draws glowing red lines` (`?hage=2&hyaw=0`, red pixels > 40); `the lines sit on the lungs' edge` (with `?hage=2`, the brightest `#bg` pixels lie within 24 CSS px of the outline drawn by `fitBox`+`breathe` in the page, checked by evaluating those functions in the page); `the words sit on a dimmed background` (the same-patch test); `with reduced motion the outline still glows` (no `?hage`, reduced motion, red pixels > 40); `a resize keeps the trails clean` (after resize, `#bg` size matches and red pixels > 40); credit line.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement `glow.js`**: two ping-pong textures at the canvas size. Each frame: draw the previous texture scaled about the lungs' centre by `1 + 0.006 * (exhaling ? 1 : 0.2)` and faded by 0.94 (the trails stream outwards as the lungs breathe out and hang back as they breathe in), then draw the current outline (each loop through `breathe` and `fitBox`) as a soft line 2.5 px wide in `--red`, brighter at its core; copy to the screen with the words' dim. With a fixed moment or reduced motion, run 90 steps of the feedback from `t − 1.5 s` to `t` before the one frame, so the trails exist.
- [ ] **Step 4:** Run unit and e2e. Expected: all pass.
- [ ] **Step 5:** Look at it; the trails should read as Lines (2016 #25) drawn by the breathing lungs.
- [ ] **Step 6: Commit** — "Life: glowing lines trail off the breathing lungs".

### Task 4: Critique, stills, full checks

- [ ] Critic rounds on Life (desktop and phone) against the spec and 2016 #25 until scores stop rising; `make-stills`, `build`, `check-dist`, full unit and e2e; commit; show Dr Rajan with the demo beside it.
