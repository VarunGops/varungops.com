# Section art: the anatomy at the top of each section page

Design, 24 November 2026. Follows the section-page flow (commit 17b1a41), where each home-page section opens its own page that slides in from its side. This document covers what sits at the top of those pages.

## Why

The home page makes one argument with real anatomy: a brain in colour, an impulse, a line, a heart. Dr Rajan wants each section page to carry that idea forward, with a different structure in motion at the top, so that opening a section feels like moving to another part of the same body rather than onto a plain text page. Each structure is chosen to say something about its section.

## Goals

- One piece of moving anatomy at the top of each section page, placed and sized the way the brain is on the home page: centred, large, on black, with the section's text below.
- Every piece is built from real anatomical data under an open licence, credited on its page. Nothing is drawn by hand or made up. This is a standing rule from Dr Rajan ("anatomy must be real"): he is a doctor and reads wrong anatomy at once.
- The same quality bar as the home page: it holds up as an anatomical drawing when still, and its motion reads as physiology or as an obvious artistic device (the strings), never as a wrong body.

## Non-goals

- No smoke burst or shockwave on these pages. He asked for "an anatomical structure in motion ... without the force like pulse".
- No sound, no interaction that is needed to read the page.
- No change to the home page's brain, line or heart, which he scored 8/10 for the heart.

## Anti-goals (a failure even if it works)

- Anatomy that is approximate, cartoonish or "procedural". His first mockup scored 2/10 for exactly this.
- Visible seams where parts join.
- Art that makes the text hard to reach, slows a phone to a crawl, or breaks the page without WebGL.

## The pieces (decided by Dr Rajan on 24 Nov 2026, from the options offered)

| Page | Piece | What it says | Source data | Licence |
|---|---|---|---|---|
| About | The heart, beating on its own | Already built | BodyParts3D | CC BY-SA |
| Now | A large pair of eyes scanning the screen, with fine strands fanning out of the pupils | What he is looking at now | Human Reference Atlas eye, left and right (NIH 3D 3DPX-020998, 3DPX-020999), from the Visible Human Male | CC BY 4.0 |
| Clinical Experience | Two hands across from each other, moving at angles, joined by tangled red strings | Hands-on clinical work | 3D scans of plaster casts of real hands, left and right (Smithsonian National Portrait Gallery, S/NPG.71.6) | CC0 |
| Research | A single human neuron whose branches light from the cell body out to their tips | A question branching into its parts | H01 human cortex, one of the 104 proofread neurons (Shapson-Coe et al., Science 2024) | CC BY 4.0 |
| Teaching | Two real neurons that connect: a signal runs down one, crosses at the real synapse between them, and runs on through the other | Passing it on | H01, a connected pair and their synapse from the released synapse table | CC BY 4.0 |
| Writing | The arcuate fasciculus, the tract joining the brain's language areas, inside a faint outline of the brain, with light travelling along it | Language | HCP-1065 tract atlas and MNI brain, as on the home page | CC BY-SA 4.0 / McGill |
| Life | A pair of lungs breathing slowly, drawn as a red engraving like the heart, with the bronchi inside | Breath, sport | Human Reference Atlas lung (NIH 3D 3DPX-021008), from the Visible Human Male: lobes and intrapulmonary bronchi | CC BY 4.0 |
| Collaborate | The corpus callosum, the fibres joining the two halves of the brain, with light crossing the midline | Two halves working as one | HCP-1065 tract atlas | CC BY-SA 4.0 |

Teaching changed in one respect from the idea he approved: he was offered "small packets crossing the gap". H01 does not segment synaptic vesicles, so packets would be invented. The design shows the signal crossing at the real synapse instead. This keeps to the real-anatomy rule; mention it to him when the piece is shown.

Writing and Collaborate pages are not public yet (Writing has no pieces, Collaborate is a draft). Their art is built last.

## Hands: the choice

Two real sources were offered to Dr Rajan:

1. **Plaster casts of real hands, both left and right** (Smithsonian National Portrait Gallery, S/NPG.71.6, CC0, about 300,000 triangles). Fine skin detail, knuckles, creases and veins; the fingers are naturally curled, close to his pencil reference. They are the 1860 casts of Abraham Lincoln's hands, and the credit line names him.
2. **An anatomical template of the adult hand** averaged from MRI scans of 27 healthy hands (NIH 3D 3DPX-017237, CC BY). Anonymous, but averaging smooths away creases and the pose is not stated (likely flat, as scanned).

**Decided 24 Nov 2026: the casts.** Both are rigid: the fingers do not bend, the hands move as wholes. Credit line on the Clinical Experience page: "Hands from 3D scans of plaster casts of Abraham Lincoln's hands, after Leonard Wells Volk, 1860. National Portrait Gallery, Smithsonian Institution, CC0." (CC0 needs no credit; it is given anyway, as with every other source.)

## How each piece behaves

Shared by all pieces:

- Drawn with WebGL 2 on one canvas at the top of the page, like the heart on About. It shows a still image until the first frame is drawn, and keeps the still if WebGL is missing, the data fails, or the context is lost (the stage states `loading`, `live`, `still` and `failed`, as on the home page and About).
- Animates only while on screen. Reduced motion draws one still frame.
- Review switches as on the home page (a fixed moment and turn in the URL) so tests and stills are reproducible.
- Credits for its source appear at the foot of its page.
- Data: each page loads only its own files. Budget per page about 3 MB compressed on a desktop and a lighter cut for phones, checked in `scripts/check-dist.mjs` like the brain's budget.
- Colour: the eyes, neurons and tracts are in colour, like the brain; the heart and lungs are red engravings; the hands are graphite-grey engravings, like his pencil reference, with red strings.

Per piece:

- **Eyes.** Revised twice on 24 Nov 2026 after Dr Rajan's looks: first "they just look like real eyes ... I want an aspect of abstract art" with strands that are "curvy lines originating at a point and then moving together parallelly across the screen", that "scan the screen ... away from the written text", without following the pointer; then (2/10) "make the lasers ... 3D instead of 2D", "spread out more", "originate from the centre of the eyes", "looks very artificial". Now: each eye is the light source. The globes are the scan's own geometry drawn as dark glass with a cool rim, the iris a faint ring of radial fibres with a limbal ring, the pupil glowing. From a small disc on each pupil a tight bundle of fibres rises in 3D, opens wide towards the tips and falls away under its own weight like a fountain or willow, turning over within the frame; each fibre is pale along its shaft, takes the fibre-lamp colour (softened) as it opens, and ends in a glowing tip on every other strand. The fountain stays upright, swaying about 35 degrees either side of vertical about once a minute; each strand follows the sway a little late, tips later than roots; a slow camera drift gives parallax and far fibres are fogged. On wide screens the two fountains lean together, on phones apart. Behind the page, the drawing layer covers the whole screen; fibres fade fully over the words and the link home, and fade out as the eyes scroll off. An independent visual critic scored the eyes 4, then 6, then 7.5 out of 10 across three rounds against his reference photograph.
- **Hands.** One hand reaches down from the top, the other up from the bottom, as in his reference drawing, drifting and turning slowly. Revised 24 Nov 2026 ("the hands need to hold the thread like how they were before in between the two of them and ... spread out from the hand ... in a taut manner ... across the screen"): slack red strings, simulated as ropes, are held between the hands, tied just inside the fingers so the finger hides the contact; eight more strings run out taut and straight from the four outermost anchors on each hand across the whole screen. String width follows depth; strings fade fully over the words; the page's red edge line steps back to 22% so it does not read as another string. Drawn in graphite with engraved hatching, coarser on phones. The poses are the real casts and stay as they are (the right hand a fist round a cut broom handle). Critic scores 6, 6.5, 7 out of 10.
- **Neuron.** A pyramidal neuron, apical dendrite upwards, as a fine branching drawing in colour. Light starts at the cell body and runs out along every branch to the tips, then fades, on a slow cycle. The cell turns slowly.
- **Synapse.** Two real neurons from the same tissue that synapse onto each other, drawn as on the Research page but in two colours. A signal runs from the first cell body along its axon to the real synapse site, flashes, and runs from there along the second cell's dendrite to its body.
- **Arcuate fasciculus.** The left arcuate fasciculus in colour, inside a faint translucent outline of the brain (the home page's surface, dimmed). Light runs along the fibres between the frontal and temporal ends, both ways.
- **Lungs.** Front view. Inhale and exhale at a resting rate (about 12 a minute): the lungs expand mostly downwards and forwards as the diaphragm would move them, the engraving lines spreading and closing. The bronchi show through the lung surface as finer lines.
- **Corpus callosum.** Seen from above or the front, the commissural fibres in the standard direction colouring (left to right in red). Light crosses the midline in both directions.

## His two reference images

Kept in `raw/refs/` (git-ignored: they are other people's images, for reference only, never published).

- `eyes-fibre-optic-reference.jpg`: a person lying on a pillow in the dark, with two dense fans of fibre-optic strands rising from the eyes. Each fan spreads to roughly a right angle and the two merge overhead into one wide canopy that fills the top of the frame. The strands are thin, straight and very many (thousands), brightest and tightly bunched at the eye and thinning out as they spread. Colour runs across the canopy: blue and cyan on the left, violet in the middle, green and yellow-green on the right, with a pink-violet glow at the eyes themselves.
- `hands-strings-reference.jpg`: a graphite pencil drawing on white of two older hands. The upper hand reaches down from the top left, palm down, fingers curled and hooked. The lower hand reaches up from the bottom right, palm up, fingers open and spread. Dark strings loop around single fingers and the thumb of each hand and run as straight, taut lines between the hands and off past the edges of the frame, crossing each other. Fine cross-hatching models the skin, knuckle creases and veins. On the site this becomes graphite-grey on black, with the strings red.

## Calls made in review (the builder's, recorded here)

- **Downloads.** The `curl` denial applies to the assistant, not to Dr Rajan. The prep scripts may fetch over HTTPS when he runs them himself. NIH 3D files come from their download links. H01 data comes from the public bucket over plain HTTPS (`https://storage.googleapis.com/h01-release/...`): the SWC skeletons of the 104 proofread neurons (`data/20210601/proofread_104/skeletons/104_proofread_neurons_swc.zip`), their meshes if wanted, and the exported synapse table. No gsutil or cloud-volume is needed. He runs one documented command per source.
- **What the eye mesh holds.** The NIH page names the cornea, iris, optic nerve, extraocular muscles and the long posterior ciliary artery. Inspect the GLB first. If the muscles are not separate parts the muscle stretch is dropped and the globe turns alone with the optic nerve bending, rather than adding a second source.
- **"In colour" for the eyes.** It means atlas colour-coding by structure, like the lobe colours on the brain (for example cornea, iris, sclera, muscles and nerve each in its own hue), not a lifelike iris pigment, which would be made up.
- **If H01 has no clean connected pair.** Use the best-proofread pair with a real synapse between them and show the signal along the parts that exist. Never draw a connection that is not in the synapse table. If no proofread pair connects at all, report back before choosing another piece.
- **Data budget.** Section art is checked page by page, separately from the home page's 9 MB / 7 MB limit: each section page at most 3 MB on a desktop and 2 MB on a phone, added to `scripts/check-dist.mjs`.

## Order of building

1. Eyes (Now) and hands (Clinical Experience), which he specified himself.
2. Lungs (Life), then neuron (Research), then synapse (Teaching).
3. Arcuate fasciculus (Writing) and corpus callosum (Collaborate), before those pages go public.

Each piece is shown to him as soon as it works, and is pushed live only when he approves it.

## Constraints

- The site repository is `~/Documents/Claude/Projects/varungops.com/` (Astro, raw WebGL 2, Vitest and Playwright). The pieces follow the patterns of `src/stage/heart.js` and `src/stage/side.js`.
- `curl` is denied in this project: Dr Rajan runs the download commands himself. Raw downloads go in `raw/` (git-ignored); prep scripts in `prep/` turn them into small binary files in `public/data/`, with a README listing sources, licences and the exact credits, as the home page's prep did.
- Browser tests run on software WebGL, which is slow: frozen frames, long timeouts and two workers, as already set up.
- Every fact or label shown on a page follows the site's content rules (no visa wording, the MRes project kept to its agreed description).

## Left to the builder

- Exact mesh decimation, file layouts and shader details, within the data budget.
- Which H01 neuron and which connected pair to use, picking clear, complete, well-proofread cells; landmark points for the hand strings; the rope solver.
- Camera angles and sizes within "centred and large, like the brain".
- Making the still images for each page with `scripts/make-stills.mjs`.
