# Section art, slice 1: the eyes (Now) and the hands (Clinical Experience)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a real, moving pair of eyes at the top of /now/ and a real pair of hands joined by red strings at the top of /clinical-experience/.

**Architecture:** Python prep scripts turn the raw downloads into small quantised binary parts in `public/data/`, the same way the heart was made. On the page, `src/stage/side.js` reads which art the page asks for and starts that renderer, with the stage states, stills, reduced motion and context-loss handling it already has for the heart. Motion that can be tested without a GPU (the gaze, the hand poses, the rope strings) lives in small pure modules.

**Tech Stack:** Astro 7.4, raw WebGL 2, Vitest 5, Playwright 1.65, Python 3 with numpy and scipy only.

**Spec:** `docs/superpowers/specs/2026-11-24-section-art-design.md`

## Global Constraints

- Every mesh comes from the named real source, unchanged except for decimation, centring and orientation. Nothing anatomical is drawn by hand.
- No smoke burst, no shockwave on these pages.
- Animate only while the canvas is on screen. Reduced motion draws one still frame and runs no animation loop.
- The stage states are `loading`, `live`, `still` and `failed` on `<html data-stage>`, with `live` set only after a frame is drawn. The still image shows unless the stage is `live`.
- The review switches `?hage=` and `?hyaw=` fix the moment and the turn and keep the drawing buffer readable (`preserveDrawingBuffer`).
- Data budget: each section page at most 3 MB desktop and 2 MB phone (phone loads the `-lite` file if one exists), checked in `scripts/check-dist.mjs` separately from the home page's 9 MB / 7 MB.
- Colours: the eyes are in atlas colour-coding by structure (no lifelike iris pigment); the strands run blue/cyan at the left of the screen, violet in the middle, green/yellow-green at the right, with a pink-violet glow at the pupils. The hands are graphite grey engraving on black, the strings red (`#ff2338`, the site's `--red`).
- Credits on each page's foot. Eyes: "Eyes from the Human Reference Atlas 3D reference organs (NIH 3D 3DPX-020998 and 3DPX-020999), created from the Visible Human Male, National Library of Medicine. CC BY 4.0." Hands: "Hands from 3D scans of plaster casts of Abraham Lincoln's hands, after Leonard Wells Volk, 1860. National Portrait Gallery, Smithsonian Institution, CC0."
- Raw downloads live in `raw/` (git-ignored) and are never committed. Dr Rajan downloads them himself; `curl` is denied to the assistant.
- Nothing is pushed: Dr Rajan approves each piece before he pushes.

## Review Focus

- A phone at 375 px wide: the art fits the width, the page has no sideways scroll, and the lite data is loaded.
- A lost WebGL context on /now/ or /clinical-experience/: the still image comes back, and the art returns when the context does.
- Reduced motion: one frame, no `requestAnimationFrame` loop, the strands and strings drawn at rest.
- A pointer that leaves the window, or a touch screen with no pointer: the gaze goes back to wandering and never becomes NaN.
- Going back to the home page and forward again (bfcache): no errors, and no frames drawn while the canvas is off screen.

---

### Task 1: Read and inspect the downloads

**Files:**
- Create: `prep/meshio.py`, `prep/inspect_mesh.py`, `prep/test_meshio.py`

**Interfaces:**
- Produces: `read_glb(path) -> list[Part]`, `read_obj(path_or_zip) -> list[Part]` where `Part = (name: str, V: float32[n,3], F: int32[m,3])` with GLB node transforms applied; `components(F, n) -> int32[n]` (connected-component label per vertex); `cluster_decimate(V, F, cell_mm) -> (V2, F2)` (vertex clustering on a grid, degenerate faces dropped); `vertex_normals(V, F) -> float32[n,3]`; `quantise(V) -> (uint16[n,3], lo, hi)`.

- [ ] **Step 1: Write the failing tests** in `prep/test_meshio.py` (unittest): `test_glb_roundtrip` writes a two-node GLB (a unit cube and a tetrahedron, the second node translated by (10,0,0)) with a hand-built JSON and BIN chunk, reads it, and asserts two parts, 12 and 4 faces, and the tetrahedron's minimum x ≥ 9.99; `test_components` asserts two labels for the cube plus the separate tetrahedron; `test_cluster_decimate` takes a subdivided sphere of 20,480 faces, decimates at 0.25 of the radius, and asserts fewer than 2,000 faces, no face with repeated vertices, and every output vertex within 0.15 radius of the sphere surface.
- [ ] **Step 2: Run** `python3 -m unittest prep/test_meshio.py -v`. Expected: FAIL, `No module named 'meshio'` (run from `prep/` or with `prep` on the path).
- [ ] **Step 3: Implement `prep/meshio.py`** with numpy and scipy only (GLB: parse the 12-byte header, the JSON chunk and the BIN chunk, walk the node tree multiplying matrices or TRS, read POSITION and indices accessors; components via `scipy.sparse.csgraph.connected_components`).
- [ ] **Step 4: Run the tests.** Expected: 3 passed.
- [ ] **Step 5: Write `prep/inspect_mesh.py <file>`** that prints, per part: name, vertex and face counts, bounding box in the file's units, and the number of connected components with the five largest sizes. Run it on each file Dr Rajan has put in `raw/`. Paste the output into `progress.md` in the plan workspace and make these rulings there: which part names map to which eye classes (Task 2), whether the extraocular muscles are separate parts, the units (metres or millimetres), and which components of the hand scan are the left hand, the right hand and any base or plinth to drop.
- [ ] **Step 6: Commit**

```bash
git add prep/meshio.py prep/inspect_mesh.py prep/test_meshio.py
git commit -m "prep: GLB and OBJ readers, decimation and an inspector for the new anatomy downloads"
```

### Task 2: The eyes as a data part

**Files:**
- Create: `prep/prep_eyes.py`
- Modify: `src/stage/data.js` (NEED table, new `decodeEyes`), `prep/README.md`
- Test: `tests/unit/data.test.js`

**Interfaces:**
- Consumes: `read_glb`, `vertex_normals`, `quantise` from Task 1.
- Produces: `public/data/eyes.bin` + `eyes.json`, and `decodeEyes(json, buf) -> { nv, pos: Float32Array, nrm: Int8Array, cls: Uint8Array, follow: Uint8Array, side: Uint8Array, index: Uint32Array }`. `eyes.json`: `{ verts, faces, lo, hi, units: "mm", classes: [...], centre: [[x,y,z],[x,y,z]], radius: [r0, r1], gaze: [x,y,z] }`, left eye `side=0`, right eye `side=1`, both eyes in one frame at their Visible Human positions (if the two files are separate organs, place them at the Visible Human interpupillary distance read from their own coordinates; if their coordinates are not shared, at 63 mm). Byte layout per vertex: 3 × uint16 position, 3 × int8 normal, uint8 class, uint8 follow (0 = fixed behind the eye, 255 = moves with the globe), uint8 side, 1 pad byte (12 bytes), then uint32 indices.
- Classes, in this order: `globe` (sclera), `cornea`, `iris`, `muscles`, `optic nerve`, `artery`. A part name that matches no class stops the script with the list of names.

- [ ] **Step 1: Write the failing test** in `tests/unit/data.test.js`: `it('decodes the eyes', ...)` loads `public/data/eyes.{json,bin}` and asserts both sides present, every class index below `classes.length`, `follow` is 255 on every `globe`, `cornea` and `iris` vertex, the two `centre`s 55–70 mm apart, and `NEED.eyes` (exported for the test) equals the file length; plus `rejects a truncated eyes file`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/data.test.js`. Expected: FAIL, `decodeEyes is not exported` or the file is missing.
- [ ] **Step 3: Implement `prep/prep_eyes.py <left.glb> <right.glb> <out_dir>`**. Follow weights for muscles and the optic nerve: per vertex, `clamp((r_max - d) / (r_max - r_globe), 0, 1)` where `d` is the distance from that eye's centre, `r_globe` the globe radius and `r_max` the farthest vertex of that part. Keep full resolution unless the file exceeds the 3 MB budget; decimate with `cluster_decimate` only if it does.
- [ ] **Step 4: Implement `decodeEyes`** in `src/stage/data.js` and add `eyes` to `NEED`.
- [ ] **Step 5: Run the tests.** Expected: PASS. Add the eye source, licence and credit to `prep/README.md`.
- [ ] **Step 6: Commit** `prep/prep_eyes.py src/stage/data.js tests/unit/data.test.js prep/README.md public/data/eyes.*` with message `data: the eyes from the Human Reference Atlas, quantised with a follow weight for the muscles`.

### Task 3: The hands as a data part, with string anchors

**Files:**
- Create: `prep/prep_hands.py`
- Modify: `src/stage/data.js` (NEED, `decodeHands`), `prep/README.md`
- Test: `tests/unit/data.test.js`

**Interfaces:**
- Consumes: Task 1 readers, `components`, `cluster_decimate`, `vertex_normals`, `quantise`, and the Task 1 ruling on which components are which hand.
- Produces: `public/data/hands.bin` + `hands.json`, and `public/data/hands-lite.bin` + `hands-lite.json` (coarser cell). `decodeHands(json, buf) -> { nv, pos, nrm, hand: Uint8Array, index }`. Per vertex: 3 × uint16 position, 3 × int8 normal, uint8 hand (0 = upper hand, 1 = lower hand), 1 pad (10 bytes, padded to a multiple of 4 before the uint32 indices). `hands.json`: `{ verts, faces, lo, hi, units: "mm", anchors: [{ hand, name, p: [x,y,z] }], strings: [[a, b], ...] }`. Each hand is centred on its wrist (the centroid of its proximal 15 mm) and oriented with the fingers along −y for the upper hand and +y for the lower, palm facing the viewer for the lower hand and away for the upper, as in his reference drawing. The base or plinth, if the scan has one, is dropped.
- Anchors: per hand, the five fingertips plus two knuckles (index and little), each a real mesh vertex. Strings: 8 pairs, each joining an anchor on the upper hand to one on the lower, chosen so that at least three pairs cross in the front view.

- [ ] **Step 1: Write the failing tests:** `it('decodes the hands', ...)` asserts two hands present, 7 anchors per hand, every anchor within 0.5 mm of a vertex of its own hand, anchors on one hand at least 8 mm apart, 8 strings each joining hand 0 to hand 1, and `NEED.hands` matches; `it('the lite hands are lighter', ...)` asserts the lite file is under 60% of the full one and still has every anchor; plus `rejects a truncated hands file`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/data.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement `prep/prep_hands.py <scan file> <out_dir> --upper <left|right>`**. Decimate the full file to fit the 3 MB budget with the eyes' strings and stills aside (aim near 120,000 faces for both hands), the lite file near 50,000. Fingertips: for each hand, take the vertices within the distal 25% along the hand axis, cluster them (`scipy.cluster.hierarchy.fcluster`, 10 mm), and take the most distal vertex of each of the five largest clusters. Knuckles: the most dorsal vertex near the base of the index and little fingers. Write anchors as real vertex positions after decimation.
- [ ] **Step 4: Implement `decodeHands`** and add `hands` to `NEED` (the `-lite` file uses the same rule through `kindOf`).
- [ ] **Step 5: Run the tests.** Expected: PASS. Render a quick check: `python3 prep/inspect_mesh.py public/data/hands.json --anchors` prints anchor names and positions; look at them against the reference drawing before committing. Add the source and credit to `prep/README.md`.
- [ ] **Step 6: Commit** with message `data: the hands from the Smithsonian casts, oriented as in the reference, with string anchors`.

### Task 4: Motion that needs no GPU: gaze, hand poses, ropes

**Files:**
- Create: `src/stage/gaze.js`, `src/stage/handpose.js`, `src/stage/ropes.js`
- Test: `tests/unit/motion.test.js`

**Interfaces:**
- Produces:
  - `gazeAt(t: number, seed?: number) -> { yaw, pitch }` (radians): a deterministic wander of fixations held 0.35–1.4 s at targets within |yaw| ≤ 0.42 and |pitch| ≤ 0.30, joined by saccades lasting 30–70 ms that follow a smooth ease.
  - `aimAt(px, py, rect, eyeY) -> { yaw, pitch }`: the gaze toward a pointer at page coordinates, clamped to the same limits.
  - `blendGaze(wander, aim, sinceMove: number) -> { yaw, pitch }`: follows the pointer fully for 2 s after it last moved, then eases back to the wander over 1 s; `aim` may be null.
  - `handPose(t: number) -> [{ m: Float32Array(9), p: [x,y,z] }, { m, p }]`: each hand's rotation and position in mm in the art's frame, on separate slow periods (between 9 s and 17 s), the upper hand above the lower.
  - `createRope(a, b, segments: number, slack: number) -> Rope`, `stepRope(rope, a, b, dt, gravity = [0, -9810, 0])` (positions in mm, verlet with 12 constraint iterations), `ropePoints(rope) -> Float32Array`.

- [ ] **Step 1: Write the failing tests** in `tests/unit/motion.test.js`: gaze is deterministic for a seed, stays within the limits over 120 s sampled at 60 Hz, holds still (change < 0.001 rad) for at least 0.3 s at a time, and never moves more than 0.9 rad in one 16 ms step; `aimAt` with the pointer at the eye's own position returns yaw 0, pitch 0, and clamps a far pointer; `blendGaze` with `aim` null returns the wander and is never NaN; `handPose` rotations are orthonormal (|MᵀM − I| < 1e−5), the upper hand stays above the lower, and the angle between the two hands' finger axes stays between 120° and 200°; ropes keep both ends exactly on `a` and `b`, a slack rope's midpoint sags below the chord under gravity after 2 s of 60 Hz steps, and each segment stays within 3% of its rest length.
- [ ] **Step 2: Run** `npx vitest run tests/unit/motion.test.js`. Expected: FAIL, modules missing.
- [ ] **Step 3: Implement** the three modules. The wander uses a small seeded generator (mulberry32) so every frame is reproducible from `t`.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** with message `stage: gaze, hand poses and rope strings, tested without a GPU`.

### Task 5: The eyes on /now/

**Files:**
- Create: `src/stage/eyes.js`, `src/components/Art.astro`
- Modify: `src/stage/side.js` (a renderer per art), `src/components/HeartArt.astro` (folded into `Art.astro`), `src/layouts/Side.astro`, `src/lib/stops.js` (`now` → `art: 'eyes'`), `src/components/Credits.astro` (an `art` prop picks the lines), `src/styles/global.css`
- Test: `tests/e2e/sides.spec.js`, `tests/unit/stops.test.js`

**Interfaces:**
- Consumes: `loadPart`, `decodeEyes`, `gazeAt`, `aimAt`, `blendGaze`.
- Produces: `createEyes(canvas, part, { preserve }) -> { size(), draw(t, { age?, yaw?, gaze? }) } | null`. `Art.astro` takes `kind: 'heart' | 'eyes' | 'hands'` and renders `<div class="art" data-art={kind}>` with the still `<img class="still still-art">` (`/still/<kind>.webp`, alt text per kind) and `<canvas id="art" class="art-canvas" aria-hidden="true">`; the heart keeps `id="heart"` and its classes so its existing tests hold. `side.js` picks the renderer from `data-art`. The art canvas on /now/ spans the content width (max 1100 px) at about 62 svh tall.
- Drawing: the globes turn by the gaze about their centres; vertices with `follow` < 255 blend between fixed and turned by `follow/255`. Strands: about 6,000 per eye on a desktop and 2,500 on a phone, drawn as instanced additive lines from the pupil along the gaze inside a cone of half-angle 0.5 rad, longest reaching the canvas edge, fixed random offsets per strand (seeded) so they sway together as the gaze moves, coloured by their screen x across the blue, violet and green stops above.

- [ ] **Step 1: Write the failing tests:** in `stops.test.js`, `now` has `art: 'eyes'`; in `sides.spec.js`, `/now/?hage=0.3&hyaw=0` goes `live` and draws more than 40 bright pixels in a 64 × 40 downsample of `#art`; without WebGL 2 the still shows with alt text mentioning eyes; reduced motion runs no animation loop (the `__raf` counter from `stage.spec.js` rises by at most 1 in 1.5 s); a lost context hides the canvas and shows the still, and restoring it returns to `live`; the page has no sideways scroll at 375 px and requests `eyes-lite` if a lite file exists, else `eyes`; the credits line names the Human Reference Atlas and the Visible Human Male; moving the mouse then leaving the window logs no errors.
- [ ] **Step 2: Run** `npx playwright test tests/e2e/sides.spec.js -g eyes --project=desktop`. Expected: FAIL.
- [ ] **Step 3: Implement `eyes.js`, `Art.astro`, the `side.js` registry and the credits prop.** Keep the heart's behaviour on /about/ unchanged.
- [ ] **Step 4: Run** the eyes tests on both projects, then the whole `sides.spec.js`. Expected: PASS, including every heart test.
- [ ] **Step 5: Check by eye** in the preview (`varungops-site`, port 4330): desktop and 375 px, against `raw/refs/eyes-fibre-optic-reference.jpg`. Note what differs in `progress.md`.
- [ ] **Step 6: Commit** with message `art: the eyes on Now, turning with a real gaze, strands fanning from the pupils`.

### Task 6: The hands on /clinical-experience/

**Files:**
- Create: `src/stage/hands.js`
- Modify: `src/stage/side.js`, `src/lib/stops.js` (`clinical-experience` → `art: 'hands'`), `src/components/Credits.astro`
- Test: `tests/e2e/sides.spec.js`, `tests/unit/stops.test.js`

**Interfaces:**
- Consumes: `decodeHands`, `handPose`, `createRope`, `stepRope`, `ropePoints`, `Art.astro` and the `side.js` registry from Task 5.
- Produces: `createHands(canvas, part, { preserve }) -> { size(), draw(t, { age?, yaw? }) } | null`.
- Drawing: each hand transformed by `handPose(t)`; graphite engraving in the heart's two-pass manner (a solid black depth pass, then lines): hatching that follows the form, swelling in light, plus a rim; strings as red lines 1.5 px wide (device pixels × DPR, capped at 3) from `ropePoints`, stepped at a fixed 1/60 s regardless of frame rate, drawn after the hands and depth-tested against them so a string passes behind a finger correctly. With `?hage=` the ropes are settled by stepping 4 s from rest before the frozen frame is drawn.

- [ ] **Step 1: Write the failing tests:** `clinical-experience` has `art: 'hands'`; `/clinical-experience/?hage=2&hyaw=0` goes `live`, the downsampled `#art` has bright grey pixels (r, g and b within 20 of each other, above 60) and red pixels (r > 150, g and b < 90); without WebGL 2 the still shows; reduced motion runs no loop; no sideways scroll at 375 px; the credits line names the Smithsonian casts and CC0; the CV link and the WHO checklist text are still on the page.
- [ ] **Step 2: Run** the hands tests. Expected: FAIL.
- [ ] **Step 3: Implement `hands.js`** and register it.
- [ ] **Step 4: Run** the hands tests on both projects, then the whole e2e suite. Expected: PASS.
- [ ] **Step 5: Check by eye** against `raw/refs/hands-strings-reference.jpg`, desktop and phone. Note differences in `progress.md`.
- [ ] **Step 6: Commit** with message `art: the hands on Clinical Experience, cast from life, with red strings between them`.

### Task 7: Stills, budgets and the full check

**Files:**
- Modify: `scripts/make-stills.mjs`, `scripts/check-dist.mjs`, `tests/e2e/stage.spec.js-snapshots/` (only if a baseline legitimately changes)

**Interfaces:**
- Consumes: the review switches of Tasks 5 and 6.
- Produces: `public/still/eyes.webp`, `public/still/hands.webp`; a per-page budget in `check-dist.mjs` keyed by art (`heart: ['heart']`, `eyes: ['eyes']`, `hands: ['hands']`, phone using `-lite` where present).

- [ ] **Step 1: Write the failing check:** add the per-page budget to `check-dist.mjs` (3 MB desktop, 2 MB phone, per art) and the missing-still rule (every art in `STOPS` has `public/still/<art>.webp`). Run `npm run check`. Expected: FAIL on the missing stills.
- [ ] **Step 2: Add the eyes and hands to `make-stills.mjs`** at the review moments used in the tests, run `npm run build && npm run stills`.
- [ ] **Step 3: Run** `npm run check` then `npx playwright test`. Expected: all pass; on darwin the screenshot baselines unchanged.
- [ ] **Step 4: Run the Hermes pass** on any new visible copy (alt texts, credits): `python3 hermes/hermes_scan.py <file> --register report --stamp` from the JARVIS repo.
- [ ] **Step 5: Commit** with message `build: stills and per-page data budgets for the eyes and hands`. Do not push: show Dr Rajan both pages in the preview and wait for his approval.
