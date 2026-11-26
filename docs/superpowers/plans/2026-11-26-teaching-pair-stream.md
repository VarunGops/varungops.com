# Teaching: two real H01 cells and the synapses between them — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Teaching page, a signal leaves one real neuron's cell body, runs out along its axon to the real synapses it makes onto a second real cell, flashes there, and runs on into the second cell; behind them a particle stream flows from the first cell towards the second and quickens as the signal crosses.

**Architecture:** As Research. `prep_pair.py` turns the proofread sender (SWC) and its partner (c3 skeleton, `raw/h01_partner.json`) into one frame, turned so the partner's apical dendrite points up, each cell resampled with its path distance (sender: from its soma; partner: from the synapses), plus the synapse points. `pair.js` draws both with the Research neuron's line shader in two colours, on one timeline (`signal.js`: phase, the time the signal reaches the synapses, the partner's front). `bg/stream.js` draws a 2D curl-noise particle stream between the two somas' screen positions (through `cortex.js`), brighter and faster while the signal crosses.

**Tech Stack:** as before.

**Spec:** `docs/superpowers/specs/2026-11-24-section-art-design.md` — Teaching row, "Synapse" behaviour, 26 Nov revision (particle stream). Dr Rajan chose on 26 Nov: "Checked cell + real partner" (none of the 104 proofread cells connect inside the sample).

## Global Constraints
- Real only: sender = proofread cell 1900905433 (SWC, 32×32×33 nm voxels); partner = c3 cell 1332939895 (automated reconstruction, skeleton in nm); the 9 synapses from the c3 synapse table that the dataset assigns to both. All within 0.2–0.7 µm of both cells. No connection drawn that is not in the table; no cell-type or excitatory/inhibitory claim.
- Credit: "Neurons and synapses from the H01 dataset (Shapson-Coe et al., Science 2024; Lichtman Lab, Harvard, and Google), CC BY 4.0: proofread cell 1900905433 and the cell it synapses onto, 1332939895, an automated reconstruction." and "The particle stream follows Jaume Sánchez’s Plasma waves (Codevember 2017), CC BY 4.0."
- Colours: sender warm amber, partner cool cyan; the synapses flash white.
- Everything the other wide pieces do; budgets 3 MB / 2 MB.

## Review Focus
1. The signal reaches the synapses before the sender's light gets there, or the partner lights before the flash: one timeline in `signal.js`, unit-tested.
2. The two cells drift apart on screen (two fits): one `fitNeuron` over both cells' bounds.
3. The partner's skeleton has many disconnected pieces: path distance from the synapses must not leave `Infinity` (fall back as in `prep_neuron.path_dist`).
4. The stream's ends do not follow the somas when the page scrolls or the cells turn: ends projected each frame through `cortex.js`.
5. Stream particle count on phones: fewer, and no blow-out.

### Task 1: Prep the pair — `prep/prep_pair.py`, tests; output `public/data/pair(.bin/.json)` (+ lite). Record per segment as neuron.bin plus a cell byte (0 sender, 1 partner); json: segs, synapses (µm), somas, dSyn (sender path distance at the synapses), maxDist per cell.
### Task 2: The pair on Teaching — `signal.js` (+ unit tests), `pair.js`, wiring (stops `teaching` → `pair`, data, side, Art, Credits, stills, e2e list).
### Task 3: The stream — `bg/stream.js` on the layer (`BG.pair = 'stream'`), e2e.
### Task 4: Critique, stills, checks, review, show.
