# Research: the H01 neuron among its real neighbours — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put one real human pyramidal neuron (H01) on the Research page, lit from its cell body out to its tips, inside a soft-focus deep field of the real cell bodies around it in the same tissue.

**Architecture:** A prep script reads the neuron's SWC fragments and the cell-body centres (`raw/h01_cells.json`, from `fetch_h01_cells.py`), turns both into one frame (µm about the soma, apical dendrite up), resamples the neuron to about 2 µm segments with each segment's path distance from the soma, and keeps the cells within the field of view. `neuron.js` draws the segments as instanced lines on a full-screen canvas fitted to its box (as the lungs), coloured by direction like the brain's tracts, with a pulse of light running out along the path distance. The background `bg/field.js` draws the cells as soft points at their real positions, turned by the same slow sway (`cortex.js`, shared like `breath.js`).

**Tech Stack:** Python 3 + numpy + scipy (prep), Astro 7.4, raw WebGL 2, Vitest 5, Playwright 1.65.

**Spec:** `docs/superpowers/specs/2026-11-24-section-art-design.md` — Research row, "Neuron" behaviour, 26 Nov revision (Research: deep field, real H01 cells by his decision).

## Global Constraints

- Real data only: the neuron is H01 cell 3955003482 (one of the 104 proofread); the field is the H01 cell-body layer's centres. Nothing invented, nothing moved except the one rigid turn that stands the apical dendrite upright, applied to both.
- Frames: SWC voxels × (32, 32, 33) nm; checked against the cells (median soma-to-nearest-cell 11 µm, no systematic offset; spread ≈ the cells' 4 µm voxels). SWC type 3 is the soma.
- Credit: "Neuron and cell positions from the H01 dataset (Shapson-Coe et al., Science 2024; Lichtman Lab, Harvard, and Google), CC BY 4.0." and "The deep field follows Jaume Sánchez’s Starfield (Codevember 2016), CC BY 4.0."
- In colour like the brain (direction colouring: red left–right, green up–down, blue front–back, softened); light from the cell body to the tips, then fading, on a slow cycle; the cell turns slowly.
- Budgets 3 MB / 2 MB; stills `still/neuron(-phone).webp`; everything the other wide pieces do (stills, reduced motion, context loss, lite data, `?hage`/`?hyaw`).
- Background rules as before: own `#bg`, dims under the words, never takes the anatomy down.

## Review Focus

1. The neuron and the field turn differently (two camera formulas): one shared `cortex.js` for the turn and projection. Unit test.
2. The neuron's own cell body appears as a field point inside its soma: cells within 15 µm of the soma are left out in prep. Prep test.
3. Fragment roots far from the soma get a wrong path distance and light up out of order: path distance = distance along the fragment + straight distance from its nearest point to the soma. Prep test.
4. Thousands of overdrawn points blow out to a white haze on a phone: point count and gain lower in lite. E2E brightness check on phone.
5. Data size: resampled to ~2 µm; lite to ~4 µm; checked by `check-dist`.

---

### Task 1: Prep the neuron and its field
**Files:** Create `prep/prep_neuron.py`, `prep/test_prep_neuron.py`; modify `prep/README.md`. Output `public/data/neuron(.bin/.json)`, `neuron-lite(.bin/.json)`.
**Interfaces:** `neuron.json`: `{ segs, cells, lo, hi, maxDist, soma: [0,0,0], units: "um", rot }`; `neuron.bin`: per segment a(3) b(3) as int16 (0.1 µm about the soma… clamped ±3276 µm), then path distance at a and b as uint16 (0.1 µm), radius uint8 (×0.05 µm), type uint8; then per cell x y z int16 (0.1 µm) and size uint8.
- [ ] Tests: `upright(points, soma)` returns a rotation that sends the apical direction (soma → centroid of nodes > 300 µm away) to +y; `path_dist` on a two-fragment toy tree adds the gap from a fragment's nearest node to the soma; `resample` keeps both ends of every branch and spaces nodes ≤ the step; `near_cells` drops cells within 15 µm of the soma and outside the box.
- [ ] Implement, run on `raw/104_proofread_neurons_swc/3955003482.*.swc` and `raw/h01_cells.json`; print sizes (target ≤ 1 MB / 0.5 MB); commit.

### Task 2: The neuron on Research
**Files:** Create `src/stage/cortex.js` (`yaw(t)`, `PROJECT_GLSL`, `project(p, yaw, fit)` and `fitBox` reuse), `src/stage/neuron.js`; modify `stops.js` (research → `neuron`), `data.js` (`decodeNeuron`, `NEED.neuron`), `side.js`, `Art.astro`, `Credits.astro`, `make-stills.mjs`; tests `tests/unit/cortex.test.js`, `sides.spec.js` (add neuron).
- [ ] Unit: `yaw(t)` stays within ±0.35 rad and is smooth; `project` in JS matches the GLSL by construction (one formula string used to build both is not possible — test JS against known values and keep GLSL beside it).
- [ ] Implement: instanced line quads (width from radius, at least 1 device px), colour from segment direction (abs of the turned direction, mixed 60% toward a warm white), light `exp(-((d − front)/w)²)` with `front` sweeping 0 → 1.1 × maxDist over 4 s, then 3 s of fading glow, base level 35%; the soma drawn as a soft disc. Perspective with a slow yaw.
- [ ] E2E (wide-piece list): `['neuron', '/research/', /neuron/i, /H01 dataset/, 'r + g + b > 150']`; commit.

### Task 3: The deep field
**Files:** Create `src/stage/bg/field.js`; modify `layer.js` (`BG.neuron = 'field'`, MAKE loads `/data/neuron(-lite).json`+`.bin` through `loadPart`), `Art.astro`, `Credits.astro`, unit `backdrop-layer.test.js`, e2e `backgrounds.spec.js`.
- [ ] E2E: draws soft points (lit pixels > 60); the words dim (same-patch test); reduced motion shows the field; credit.
- [ ] Implement: `gl.POINTS` at the cells' real positions through `cortex.js`'s turn and the same fit; size by depth and focus (blur grows with distance from the soma's depth plane); colour a faint version of the neuron's palette by depth; drift = the shared yaw. Lite: every second cell, lower gain. Commit.

### Task 4: Critique, stills, checks, review, show.
