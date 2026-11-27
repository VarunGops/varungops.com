# Writing and Collaborate: two tracts, their backgrounds — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Writing: the left arcuate fasciculus inside a faint outline of the brain, light running along it both ways, flowing line ribbons behind. Collaborate: the corpus callosum from above, light crossing the midline both ways on the heartbeat, a two-sided complementary-colour fluid behind.

**Architecture:** One prep script (`prep_pages_tracts.py`) cuts the two bundles out of the site's own `tracts.bin` (HCP-1065, already adapted for the home page) and a light brain outline out of `brain.bin`, into `writing.bin/json` and `collab.bin/json`. One renderer (`fibres.js`) draws a bundle's streamlines as instanced lines in the tract colours (`tracts.js dirCol`), with light pulses along each streamline's own length, and optionally the outline mesh as a faint rim-lit shell; it takes a view (lateral-left or from above) and a pulse rule (Writing: two pulses, frontal→temporal and back; Collaborate: one per beat from `clock.js`, alternating sides, full on the volley). Backgrounds on the layer: `bg/ribbons.js` (Writing; a strange-attractor path drawn as ribbons of parallel lines, turning slowly) and `bg/fluid.js` (Collaborate; a small stable-fluids solver with complementary-colour pushes from each side on each volley).

**Spec:** `docs/superpowers/specs/2026-11-24-section-art-design.md` — Writing and Collaborate rows and behaviours; 26 Nov revision (5C ribbons; Collaborate fluid with "multiple complementary colours alternating from two sides"; pushes on each volley).

## Global Constraints
- Tract data is the site's existing HCP-1065 adaptation (CC BY-SA 4.0; credit already on the home page, repeated on each page). The outline is the site's MNI brain (McGill licence; credit as home). No new downloads.
- Writing has no public page until a piece is published, and Collaborate stays hidden while a draft: the art is built and previewed with `SHOW_DRAFTS=1`; in drafts mode only, Writing's page shows while empty. The production rules and their tests are unchanged.
- Credits: Writing — "The flowing line ribbons follow Jaume Sánchez’s Strange Attractors (Codevember 2016), CC BY 4.0."; Collaborate — "The fluid follows Pavel Dobryakov’s WebGL Fluid Simulation (MIT)." Plus the tract and brain credits.
- Budgets 3 MB / 2 MB; stills; everything the other wide pieces do.

## Review Focus
1. Bundle selection by index range: the streamlines of `AF_L` and `CC` must be exactly that bundle's (ranges from `bundles[].kept` in order). Prep test.
2. Pulses must run the right way: Writing frontal↔temporal (by each streamline's ends' y), Collaborate left↔right (by x). Prep orients each streamline; unit test on `fibres` pulse param.
3. The fluid's solver must stay stable at any frame rate and on phones (fixed step, fewer iterations lite).
4. Drafts-only Writing page must not leak into production builds. E2E (production test unchanged) + drafts check.
5. Both pages fit the budget with the outline mesh.

### Task 1: prep both pages' data. ### Task 2: fibres.js + Writing wiring. ### Task 3: ribbons background. ### Task 4: Collaborate wiring (fibres from above, beat pulses). ### Task 5: fluid background. ### Task 6: critique, stills, checks, review, show.
