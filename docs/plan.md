# varungops.com Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the approved mockup (version 3) into the real varungops.com: a static site in its own GitHub repository, built and hosted by Vercel at `varungops.com`.

**Architecture:** An Astro static site. Written content lives in Markdown and renders with no script. The brain, smoke and heart are plain JavaScript modules ported from the mockup, split so the arithmetic (clock, impulse timing, cord shape, outline distance field) is testable without a browser and the WebGL drawing sits on top of it. GitHub Actions builds every push to `main` and puts the output on a `deploy` branch.

**Tech Stack:** Astro 7.4, Node 26, plain JavaScript (ES modules) with WebGL 2, Vitest 5 for unit tests, Playwright 1.65 for browser tests, Python 3 for data preparation, `@fontsource` packages for self-hosted fonts.

**Spec:** `docs/superpowers/specs/2026-11-10-varungops-site-design.md` (in the JARVIS repository). The reference implementation is the mockup at `docs/superpowers/mockups/` in the same repository: `src/main.js`, `src/smoke.js`, `src/heart.js`, `src/head.html`, `src/body.html`, `prep/`, `data/`.

## Global Constraints

- Project root is `~/Documents/Claude/Projects/varungops.com/`, a new git repository, separate from JARVIS. Every path below is relative to it unless it starts with `JARVIS:`.
- The site is static. No database, no login, no server code, no analytics, no contact form, no smooth-scroll library.
- The stage, smoke and heart use no rendering library. Raw WebGL 2 only.
- Scrolling is the browser's own. The canvases sit in the page flow and scroll with it.
- One heartbeat is 0.96 seconds. The impulse reaches the cortex 0.36 seconds after the beat. Every fourth beat is a full volley with a smoke burst; the three between run at 0.42 strength.
- The heart drawing, its shaders and its motion are ported unchanged from the mockup. Dr Rajan scored it 8/10 and asked for it to be left alone.
- Anatomy is never drawn by hand. Geometry comes only from the files the `prep/` scripts produce.
- Every fact in `src/content/` comes from `JARVIS:data/CANONICAL_FACTS.md`, `JARVIS:data/PENDING_CANONICAL_ADDITIONS.md` or the CV `JARVIS:jarvis/Output/Dr_Varun_Gopal_Rajan_CV_Nov2026_NHS.docx`. The Walton Centre role is a "Clinical Observer" post, never a fellowship.
- Content never contains: patient detail, visa status, a home address, a phone number, referees, family members, paid services or adverts. The one email address on the site is `drvarungopal@outlook.com`, as a `mailto:` link in Contact.
- Clinical Experience lists clinical posts only, newest first. Three posts carry a description of no more than 45 words, marked `described: true` in front matter: Akshaya general surgery, the Walton Centre and the neurosurgery Junior Resident year. The West Middlesex observership and the internship have none. The Writing collection is empty at launch.
- The MRes project is described only as "paediatric craniofacial surgery" until Dr Rajan confirms his supervisors agree to more.
- The About and Collaborate copy is Dr Rajan's own writing. The text carried over from the mockup is a draft, and it ships only after he has rewritten or approved it.
- All copy passes `python3 hermes/hermes_scan.py <file> --register his --stamp` (run from the JARVIS repository) before launch.
- Fonts are Outfit (name, headings), Source Serif 4 (body) and IBM Plex Mono (labels), served from the site itself.
- Colours: background `#000`, text `#f1ecec`, dim text `#a0959a`, red `#ff2338`.
- The footer carries the three data credits listed in `prep/README.md`.
- Hosting is Vercel's free Hobby plan on Dr Rajan's own account, building from the `main` branch of a GitHub repository under his own account. Astro's static output needs no Vercel adapter. The domain is bought through Squarespace Domains. Every account, the Vercel project and the domain are his.
- Vercel runs `npm run check` as its build command, so a failing unit test or file check stops a broken version going live and the previous one stays up.
- `git push` and `gh` are denied in Dr Rajan's Claude settings. Any step that pushes or creates a GitHub repository is his to run; the plan gives him the command.
- Commit only inside the new repository. Do not commit anything in the JARVIS repository.

## Review Focus

1. **JavaScript is off or fails to load.** Every section's text, the nine headings and the Research and Writing links must still read correctly. Pinned in Task 3.
2. **WebGL 2 is missing, or the context is lost mid-session.** The visitor sees the still images of the brain and heart, never a blank black rectangle or a console error loop. Pinned in Task 8.
3. **An anatomy file fails to load or arrives truncated** (slow phone, dropped connection). The written content is already on screen, the loader retries, and if it still fails the still images stay. Pinned in Tasks 5 and 8.
4. **The device asks for reduced motion.** The brain and heart are still, there is no smoke, and no animation loop runs. Pinned in Task 8.
5. **Odd or changing viewports:** a 320 px phone, a very wide short window, rotation, a browser bar that hides on scroll. There is no sideways scroll, the cord still reaches the heart, the dot stays on the line, and a canvas never exceeds its pixel cap. Pinned in Tasks 3 and 7.

---

## File structure

```
varungops.com/
  package.json  astro.config.mjs  vitest.config.js  playwright.config.js  .gitignore  README.md
  vercel.json  .nvmrc
  .github/workflows/ci.yml
  mockup/                      reference copy of the approved mockup; not built, not deployed
  prep/                        prep_brain.py prep_tracts.py prep_heart.py make_lite.py README.md requirements.txt
  public/
    data/                      brain.{bin,json} tracts.{bin,json} tracts-lite.{bin,json} heart.{bin,json}
    still/                     brain.webp heart.webp (shown without WebGL or with reduced data)
    og.png                     social preview
  src/
    content.config.ts          schemas for every collection
    content/
      about.md  now.md  life.md  collaborate.md  contact.md
      experience/*.md  research/*.md  teaching/*.md  writing/*.md
    layouts/Base.astro         head, fonts, meta, structured data, credits footer
    pages/index.astro  pages/research/[slug].astro  pages/writing/[slug].astro  pages/rss.xml.js  pages/404.astro
    components/                Home About Now Experience Research Teaching Writing Life Collaborate Contact Line Credits (.astro)
    styles/global.css
    stage/
      clock.js                 beat arithmetic: no DOM, no WebGL
      tracts.js                impulse arrival times, direction colours, fibre buffer
      cord.js                  cord shape, tube, cord fibres, thread
      outline.js               distance transform for the smoke's starting outline
      data.js                  fetch with retry, decoding of the .bin files, brainstem cross-section fit
      gl.js                    program(), the shared projection chunk, vertex-array helpers
      brain.js                 surface, fibre and line shaders; drawStage; outline render
      smoke.js                 smoke shader and drawSmoke
      heart.js                 heart shaders and drawHeart (unchanged from the mockup)
      marker.js                the travelling dot's section label
      main.js                  layout, frame loop, visibility, reduced motion, fallbacks
  tests/
    unit/                      clock tracts cord outline data content-rules (.test.js)
    e2e/                       content stage access (.spec.js)
```

---

### Task 1: Repository, tooling and an empty page that builds

**Files:**
- Create: `package.json`, `astro.config.mjs`, `vitest.config.js`, `playwright.config.js`, `.gitignore`, `README.md`, `src/layouts/Base.astro`, `src/pages/index.astro`, `src/styles/global.css`, `tests/e2e/content.spec.js`
- Copy: `JARVIS:docs/superpowers/mockups/{src,build.py,varungops-mockup.html,varungops-mockup-v1.html}` to `mockup/`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `preview`, `test` (Vitest, `tests/unit`), `test:e2e` (Playwright, `tests/e2e`, against `astro preview` on port 4321). `Base.astro` takes props `{ title: string, description: string }` and renders `<slot />` inside `<main>`. `global.css` defines the custom properties `--bg --fg --dim --faint --red --red-dim --display --body --mono`.

- [ ] **Step 1: Create the repository and scaffold**

```bash
mkdir -p ~/Documents/Claude/Projects/varungops.com && cd ~/Documents/Claude/Projects/varungops.com && git init -b main
npm create astro@latest . -- --template minimal --no-git --install --yes
npm install @fontsource/outfit @fontsource-variable/source-serif-4 @fontsource/ibm-plex-mono @astrojs/sitemap @astrojs/rss
npm install -D vitest @playwright/test && npx playwright install chromium
```

Astro 7 is newer than the mockup's author knew well. Read the Astro 7 documentation for content collections and the sitemap integration before Tasks 2 and 4, and use what it says over anything remembered.

- [ ] **Step 2: Write the failing browser test** in `tests/e2e/content.spec.js`

```js
import { test, expect } from '@playwright/test';
test('home page loads with the name and no console errors', async ({ page }) => {
  const errors = []; page.on('console', m => m.type() === 'error' && errors.push(m.text())); page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Varun Gopal Rajan');
  await expect(page).toHaveTitle('Varun Gopal Rajan');
  expect(errors).toEqual([]);
});
test('nothing is fetched from another origin', async ({ page }) => {
  const foreign = []; page.on('request', r => { if (new URL(r.url()).origin !== 'http://localhost:4321') foreign.push(r.url()); });
  await page.goto('/'); await page.waitForLoadState('networkidle');
  expect(foreign).toEqual([]);
});
```

`playwright.config.js`: `webServer: { command: 'npm run build && npm run preview', port: 4321 }`, two projects, `desktop` (1280×800) and `phone` (375×812, `isMobile: true`), and Chromium launched with `--enable-unsafe-swiftshader` so WebGL 2 works headless.

- [ ] **Step 3: Run it.** `npm run test:e2e`. Expected: FAIL, the heading is not found.

- [ ] **Step 4: Write `Base.astro`, `index.astro` and `global.css`.** Port the `:root` tokens and the `html, body, canvas.layer, main, .gutter, .label, h2, p, a` rules from `mockup/src/head.html`. Import the three font packages in `Base.astro`. `index.astro` renders `<h1 class="name">Varun Gopal Rajan</h1>` only.

- [ ] **Step 5: Run it.** `npm run test:e2e`. Expected: PASS on both projects.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold Astro site, test tooling and mockup reference"
```

---

### Task 2: Content files and their schemas

**Files:**
- Create: `src/content.config.ts`, `src/content/{about,now,life,collaborate,contact}.md`, `src/content/experience/*.md` (5), `src/content/research/*.md` (5), `src/content/teaching/*.md` (4), `src/content/writing/.gitkeep`
- Test: `tests/unit/content-rules.test.js`

**Interfaces:**
- Produces: collections `experience` `{ title, place, start: 'YYYY-MM', end?: 'YYYY-MM' | 'present', order: number, described: boolean }` (order 1 is the newest), `research` `{ title, status: 'published' | 'in progress' | 'presented', when: string, venue?: string, doi?: string, order: number }`, `teaching` `{ title, place?: string, when?: string, order: number }`, `writing` `{ title, date: Date, summary: string, draft: boolean }`, and `sections` (the five single files) `{ heading: string, draft?: boolean, updated?: 'YYYY-MM' }`. Body text is the Markdown below the front matter.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const walk = d => readdirSync(d).flatMap(f => statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith('.md') ? [join(d, f)] : []);
const files = walk('src/content'), text = files.map(f => readFileSync(f, 'utf8')).join('\n');
const bodies = files.map(f => readFileSync(f, 'utf8').replace(/^---[\s\S]*?---/, '')).join('\n');   // dates and the DOI live in front matter
describe('content rules', () => {
  it('has all the content files', () => { expect(files.length).toBe(19); });
  it('never carries a phone number', () => { expect(bodies).not.toMatch(/\+?\d[\d ()-]{8,}\d/); });
  it('carries one email address only, the Outlook one', () => { expect([...new Set(text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g))]).toEqual(['drvarungopal@outlook.com']); });
  it('describes exactly the three chosen clinical posts, briefly', () => { const ex = walk('src/content/experience').map(f => readFileSync(f, 'utf8')).map(t => ({ described: /described: true/.test(t), title: t.match(/title: (.*)/)[1], words: t.replace(/^---[\s\S]*?---/, '').trim().split(/\s+/).filter(Boolean).length })); const d = ex.filter(e => e.described); expect(d.map(e => e.title).sort()).toEqual(['Clinical Observer, Neurosurgery', 'Junior Resident Doctor, General Surgery', 'Junior Resident Doctor, Neurosurgery']); expect(d.every(e => e.words > 0 && e.words <= 45)).toBe(true); expect(ex.filter(e => !e.described).every(e => e.words === 0)).toBe(true); });
  it('never mentions visa status or sponsorship', () => { expect(text).not.toMatch(/\bvisa\b|sponsorship|right to work/i); });
  it('never calls the Walton Centre post a fellowship', () => { expect(text).not.toMatch(/fellow/i); });
  it('keeps the MRes project to its agreed description', () => { expect(text).not.toMatch(/craniosynostosis|deprivation|Alder Hey/i); });
  it('uses none of the banned phrases', () => { expect(text).not.toMatch(/\b(passionate|dedicated|genuinely|truly|delighted|leverage|robust|pivotal)\b/i); });
});
```

The phone-number rule reads the body text only, because dates and the DOI sit in front matter and would trip it. The GMC number is written `No. 7993092`: seven digits, under the pattern's length.

- [ ] **Step 2: Run it.** `npm test`. Expected: FAIL, 0 files found.

- [ ] **Step 3: Write `content.config.ts` and the content files.** Take the wording exactly from `mockup/src/body.html`: one file per `<li>` in the Experience, Research and Teaching lists, and one file per remaining section. Lines marked `class="note"` in the mockup are notes to Dr Rajan and are not content: leave them out. Set `draft: true` on `about.md` and `collaborate.md`. Set `updated: 2026-11` on `now.md`. The Writing collection starts empty and the Writing section shows its heading only.

- [ ] **Step 4: Run it.** `npm test`. Expected: PASS, 7 tests. `npm run build`. Expected: builds with no schema errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: content collections with schemas and content-rule tests"
```

---

### Task 3: Sections, the line and the dot

**Files:**
- Create: `src/components/{Home,About,Now,Experience,Research,Teaching,Writing,Life,Collaborate,Contact,Line,Credits}.astro`, `src/stage/marker.js`
- Modify: `src/pages/index.astro`, `src/styles/global.css`, `tests/e2e/content.spec.js`

**Interfaces:**
- Consumes: the collections from Task 2.
- Produces: the page markup the stage attaches to. Exact hooks: `canvas#stage.layer`, `canvas#smoke.layer`, `section#home > h1.name`, `div.descent`, `section#about[data-label="About"]` containing `canvas#heart.heart`, eight `section.stop[data-label]` in the order Now, Clinical Experience, Research, Teaching, Writing, Life, Collaborate, Contact (the last with `id="last"`), `div.spine`, `div.track > div.marker > i + b#mlabel`. `marker.js` exports `label(): void`, which sets `#mlabel` to the `data-label` of the last section whose top is at or above the dot, or `Scroll` before the first.

- [ ] **Step 1: Add the failing tests** to `tests/e2e/content.spec.js`

```js
const ORDER = ['About', 'Now', 'Clinical Experience', 'Research', 'Teaching', 'Writing', 'Life', 'Collaborate', 'Contact'];
test('the nine sections are present in order', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('[data-label]').evaluateAll(els => els.map(e => e.dataset.label))).toEqual(ORDER);
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(9);
});
test('there is no sideways scroll at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 }); await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
test('the dot names the section it has reached', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-label="Research"]').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 300));
  await expect(page.locator('#mlabel')).toHaveText(/Research|Teaching/);
});
test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false });
  test('the content still reads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(9);
    await expect(page.getByText('adaptation of the WHO Surgical Safety Checklist', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'drvarungopal@outlook.com' })).toHaveAttribute('href', 'mailto:drvarungopal@outlook.com');
    await expect(page.getByRole('link', { name: /doi:10\.7759\/cureus\.114519/ })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run it.** `npm run test:e2e`. Expected: the four new tests FAIL.

- [ ] **Step 3: Build the components and styles.** Port the markup shape from `mockup/src/body.html` and every remaining rule from `mockup/src/head.html`, including the `@media (max-width:820px)` block. Each component reads only its own collection. A section whose file has `draft: true` renders normally in `dev` and is replaced by its heading alone in a production build unless the environment variable `SHOW_DRAFTS=1` is set, so unapproved About and Collaborate copy cannot ship by accident. Without the stage script, `.track` and `.spine` get their position from CSS alone: `top: 200svh; bottom: 0` so the line and dot still run beside the sections.

- [ ] **Step 4: Run it.** `SHOW_DRAFTS=1 npm run test:e2e`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: section components, line and travelling dot"
```

---

### Task 4: Research and Writing pages, feed and sitemap

**Files:**
- Create: `src/pages/research/[slug].astro`, `src/pages/writing/[slug].astro`, `src/pages/rss.xml.js`, `src/pages/404.astro`
- Modify: `astro.config.mjs` (`site: 'https://varungops.com'`, sitemap integration), `src/components/{Research,Writing}.astro`, `tests/e2e/content.spec.js`

**Interfaces:**
- Consumes: `research` and `writing` collections.
- Produces: routes `/research/<slug>/`, `/writing/<slug>/`, `/rss.xml`, `/sitemap-index.xml`. Writing entries with `draft: true` produce no page and no feed item.

- [ ] **Step 1: Add the failing tests**

```js
test('each research entry has its own page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Mapping Half a Century of Global Brain Abscess Research/ }).click();
  await expect(page).toHaveURL(/\/research\/[a-z0-9-]+\/$/);
  await expect(page.getByRole('link', { name: /doi:10\.7759\/cureus\.114519/ })).toHaveAttribute('href', 'https://doi.org/10.7759/cureus.114519');
  await expect(page.getByRole('link', { name: 'Varun Gopal Rajan' })).toHaveAttribute('href', '/');
});
test('the feed and sitemap exist', async ({ request }) => {
  expect((await request.get('/rss.xml')).status()).toBe(200);
  expect((await request.get('/sitemap-index.xml')).status()).toBe(200);
});
test('an unknown address shows the 404 page', async ({ page }) => {
  const r = await page.goto('/nothing-here/'); expect(r.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Varun Gopal Rajan' })).toBeVisible();
});
```

- [ ] **Step 2: Run it.** Expected: FAIL, 404 on the research page.
- [ ] **Step 3: Write the pages.** Detail pages use `Base.astro`, a plain black page with the red line down the left margin and the name linking home. No canvas on detail pages.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: research and writing pages, RSS and sitemap"`

---

### Task 5: Anatomy data and its loader

**Files:**
- Copy: `JARVIS:docs/superpowers/mockups/prep/*` to `prep/`; `JARVIS:docs/superpowers/mockups/data/{brain,tracts,heart}.{bin,json}` to `public/data/`
- Create: `prep/make_lite.py`, `prep/requirements.txt`, `src/stage/data.js`
- Modify: `.gitignore` (add `raw/`, where the 270 MB of source downloads go if the data is ever rebuilt)
- Test: `tests/unit/data.test.js`

**Interfaces:**
- Produces:
  - `fetchRetry(url: string, kind: 'json' | 'arrayBuffer', tries = 3): Promise<any>`: waits 500 ms between tries, throws after the last.
  - `decodeBrain(json, buf): { nv, pos: Float32Array, nrm: Int8Array, depth: Uint8Array, region: Uint8Array, relief: Int8Array, index: Uint32Array }`: throws `RangeError('brain.bin is truncated')` when `buf.byteLength < nv*12 + faces*12`.
  - `decodeTracts(json, buf): { N, P, point(i, j): [x, y, z], flag: Uint8Array }`: throws `RangeError('tracts.bin is truncated')` when `buf.byteLength < N*P*6 + 2*N`.
  - `stemFit(pos, region, z: number, tol: number): { yc, ry, rx }`: the brainstem (region 8) cross-section at height `z`.
  - `loadAll(lite: boolean): Promise<{ brain, tracts, heart: { json, buf } }>`: fetches `tracts-lite` when `lite` is true.
  - `prep/make_lite.py <data_dir> [fraction=0.6]` writes `tracts-lite.bin` and `tracts-lite.json` holding the first 60% of streamlines. `tracts.bin` is already shuffled, so a prefix keeps every bundle. It needs no raw download.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeBrain, decodeTracts, stemFit, fetchRetry } from '../../src/stage/data.js';
const load = n => ({ json: JSON.parse(readFileSync(`public/data/${n}.json`, 'utf8')), buf: readFileSync(`public/data/${n}.bin`).buffer.slice(0) });
describe('anatomy data', () => {
  it('decodes the brain surface', () => { const b = load('brain'), m = decodeBrain(b.json, b.buf); expect(m.nv).toBe(74832); expect(m.index.length).toBe(149992 * 3); expect(Math.min(...m.pos.filter((_, i) => i % 3 === 2))).toBeCloseTo(-72.1, 0); });
  it('measures the medulla where the cord joins it', () => { const b = load('brain'), m = decodeBrain(b.json, b.buf), f = stemFit(m.pos, m.region, -67, 1.3); expect(f.rx).toBeGreaterThan(6.5); expect(f.rx).toBeLessThan(9); expect(f.yc).toBeGreaterThan(-46); expect(f.yc).toBeLessThan(-43); });
  it('decodes the tracts', () => { const t = load('tracts'), d = decodeTracts(t.json, t.buf); expect(d.N).toBe(16067); expect(d.P).toBe(32); expect([...d.flag].filter(f => f & 2).length).toBe(1536); });
  it('writes a lite tract file that is a prefix of the full one', () => { const t = load('tracts'), l = load('tracts-lite'); expect(l.json.streamlines).toBe(Math.floor(16067 * 0.6)); expect(decodeTracts(l.json, l.buf).point(100, 5)).toEqual(decodeTracts(t.json, t.buf).point(100, 5)); });
  it('rejects a truncated file', () => { const b = load('brain'); expect(() => decodeBrain(b.json, b.buf.slice(0, 1000))).toThrow('brain.bin is truncated'); });
  it('retries a failed fetch and then gives up', async () => { let calls = 0; globalThis.fetch = async () => { calls++; throw new TypeError('Failed to fetch'); }; await expect(fetchRetry('x', 'json', 3)).rejects.toThrow('Failed to fetch'); expect(calls).toBe(3); });
});
```

- [ ] **Step 2: Run it.** `npm test`. Expected: FAIL, module not found.
- [ ] **Step 3: Write `make_lite.py`, run it, and write `data.js`.** The byte layouts are documented at the top of each `prep/*.py` script and used in `mockup/src/main.js` `buildMesh` (lines 167 to 187) and `buildTracts` (lines 214 to 220). `python3 prep/make_lite.py public/data`.
- [ ] **Step 4: Run it.** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: anatomy data, lite tract file and loader"`

---

### Task 6: The arithmetic under the stage

**Files:**
- Create: `src/stage/clock.js`, `src/stage/tracts.js`, `src/stage/cord.js`, `src/stage/outline.js`
- Test: `tests/unit/{clock,tracts,cord,outline}.test.js`

**Interfaces:**
- Consumes: `decodeTracts`, `stemFit` from Task 5.
- Produces:
  - `clock.js`: `T = 0.96`, `TA = 0.36`, `SPEED = 1 / TA`, `BURST_EVERY = 4`; `beat(t): { n, a }`; `amp(n): 1 | 0.42`; `flash(a): number`; `heads(t, n): number[4]` (−1 for a beat before time zero or when `n < 0`); `glow(t): number` (cortex brightness, at most 1); `burstAge(t, i: 0 | 1): number`; `burstSeed(t, i): number`.
  - `tracts.js`: `CENTRE = [0, -18, 6]`, `STRIDE = 12`; `arrival(points: number[][]): Float32Array`; `dirCol(a, b): [r, g, b]`; `buildTracts(decoded): { data: Float32Array, starts: { p: number[], tan: [number, number] }[] }`.
  - `cord.js`: `ZJ = -67`, `ZREF = -50`, `YC = -16`, `ZC = 15`, `CORD_RATE = 54`, `TUBE = 11`; `cordShape({ stemJ, stemJ2, stemTop, fieldH, yAnchor, k }): { total, U, thr, yc(u), rx(u), ry(u), s(u) }`; `buildCord(shape, starts): { tube: { verts: Float32Array, index: Uint16Array }, fibres: Float32Array, thread: Float32Array, sEnd: number }`; `straightFrom(shape, yAnchor, k): number` (page y where the line becomes straight).
  - `outline.js`: `distanceTo(mask: Uint8Array, w, h, want: 0 | 1): Float32Array`; `signedDistance(mask, w, h): Float32Array` (positive outside, negative inside).

- [ ] **Step 1: Write the failing tests.** Each test file builds its fixtures at the top: `decoded` from `public/data/tracts.*` with `decodeTracts`, `starts` from `buildTracts(decoded).starts`, and `sh` from `cordShape` with the values given in the comment.

```js
// clock.test.js
it('counts beats', () => { const b = beat(40 * 0.96 + 0.1); expect(b.n).toBe(40); expect(b.a).toBeCloseTo(0.1, 6); });
it('makes every fourth beat a full volley', () => { expect([40, 41, 42, 43, 44].map(amp)).toEqual([1, 0.42, 0.42, 0.42, 1]); });
it('peaks the cortex as the impulse arrives', () => { expect(flash(0.36)).toBe(1); expect(flash(0.2)).toBeLessThan(0.01); expect(flash(0.68)).toBeCloseTo(Math.exp(-1), 6); });
it('puts the newest head at the surface 0.36 s after the beat', () => { const h = heads(40 * 0.96 + 0.36, 40); expect(h[0]).toBeCloseTo(1, 6); expect(h[1]).toBeCloseTo(1 + 0.96 / 0.36, 6); });
it('has no heads before time zero or under reduced motion', () => { expect(heads(0.5, 0).slice(1)).toEqual([-1, -1, -1]); expect(heads(50, -1)).toEqual([-1, -1, -1, -1]); });
it('starts the smoke as the full volley lands', () => { expect(burstAge(40 * 0.96 + 0.36, 0)).toBeCloseTo(0, 6); expect(burstAge(41 * 0.96, 0)).toBeCloseTo(0.6, 6); expect(burstAge(40 * 0.96 + 0.36, 1)).toBeCloseTo(3.84, 6); });

// tracts.test.js
it('times a radial pathway from 0 at the centre to 1 at its end', () => { expect([...arrival([[0, -18, 6], [10, -18, 6], [20, -18, 6]])]).toEqual([0, 0.5, 1]); });
it('brings both ends of a looping pathway to 1 together', () => { const s = arrival([[-10, -8, 6], [0, -8, 6], [20, -8, 6]]); expect(s[0]).toBeCloseTo(1); expect(s[2]).toBeCloseTo(1); expect(s[1]).toBeLessThan(1); });
it('colours by direction: left-right red, front-back green, up-down blue', () => { expect(dirCol([0, 0, 0], [0, 0, 5]).map(v => +v.toFixed(6))).toEqual([0.08, 0.08, 1]); expect(dirCol([0, 0, 0], [3, 0, 0])[0]).toBeCloseTo(1, 6); });
it('builds one 12-float record per segment and finds the cord fibres', () => { const r = buildTracts(decoded); expect(r.data.length).toBe(16067 * 31 * 12); expect(r.starts.length).toBe(1536); expect(r.starts.every(s => s.p[2] < -44)).toBe(true); });

// cord.test.js  (shape built with stemJ {yc:-44.2, ry:7.8, rx:7.8}, stemJ2 {yc:-42.8,...}, stemTop {yc:-36.5, ry:11.5, rx:12}, fieldH 1870, yAnchor 434, k 3.72)
it('leaves the medulla at its own centre and width', () => { expect(sh.yc(0)).toBeCloseTo(-44.2); expect(sh.rx(0)).toBeCloseTo(7.8); });
it('settles onto the centre of the page as a thread', () => { expect(sh.U).toBeCloseTo(Math.min(215, 0.62 * sh.total)); expect(sh.yc(sh.U)).toBeCloseTo(-16); expect(sh.rx(sh.U)).toBeCloseTo(1.4 / 3.72); expect(sh.yc(sh.total)).toBeCloseTo(-16); });
it('never widens on the way down', () => { for (let u = 34; u < sh.U; u += 5) expect(sh.ry(u + 5)).toBeLessThanOrEqual(sh.ry(u)); });
it('ends the thread at the heart', () => { const c = buildCord(sh, starts); const last = c.thread.slice(-12); expect(last[5]).toBeCloseTo(-67 - sh.total, 3); expect(c.sEnd).toBeCloseTo(1 + (sh.total + 17) / 54, 6); expect(last[8]).toBeLessThan(0.05); });   // faded out, for the CSS line to take over
it('puts the dot where the line is straight', () => { expect(straightFrom(sh, 434, 3.72)).toBeCloseTo(434 + (15 + 67 + sh.U) * 3.72, 3); });

// outline.test.js
it('measures distance from a single texel', () => { const m = new Uint8Array(25); m[12] = 1; const d = signedDistance(m, 5, 5); expect(d[0]).toBeCloseTo(Math.SQRT2 * 2, 5); expect(d[12]).toBeCloseTo(-1, 5); expect(d[13]).toBeCloseTo(1, 5); });
it('is negative inside a filled square and positive outside it', () => { const m = new Uint8Array(81); for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) m[y * 9 + x] = 1; const d = signedDistance(m, 9, 9); expect(d[4 * 9 + 4]).toBeCloseTo(-3, 5); expect(d[0]).toBeCloseTo(Math.sqrt(8), 5); expect(d[4 * 9 + 1]).toBeCloseTo(1, 5); });
```

- [ ] **Step 2: Run it.** `npm test`. Expected: FAIL, modules not found.
- [ ] **Step 3: Port the four modules** from `mockup/src/main.js`: `clock.js` from lines 4 to 11, 354 and the timing arithmetic in `drawStage` and `frame`; `tracts.js` from `dirCol` and `buildTracts` (lines 212 to 240); `cord.js` from `cordShape` and `buildCord` (lines 242 to 291) and the `straight` line in `layout`; `outline.js` from `dt1` and `distanceTo` (lines 295 to 308). The mockup functions read a global `G`; the ported ones take arguments and return values and touch no DOM and no WebGL. Do not change any number.
- [ ] **Step 4: Run it.** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: beat clock, impulse timing, cord shape and outline field"`

---

### Task 7: Drawing the brain, the smoke and the heart

**Files:**
- Create: `src/stage/gl.js`, `src/stage/brain.js`, `src/stage/smoke.js`, `src/stage/heart.js`, `src/stage/main.js`, `tests/e2e/stage.spec.js`
- Modify: `src/components/Home.astro` (loads `main.js` as a module script)

**Interfaces:**
- Consumes: everything from Tasks 5 and 6, and the page hooks from Task 3.
- Produces:
  - `gl.js`: `program(gl, vs, fs): { p, u }`; `PROJ: string`; `lineSet(gl)`, `tubeSet(gl)` as in the mockup.
  - `brain.js`: `createBrain(canvas, data): Brain | null` (null when WebGL 2 is missing); `Brain.layout(geom)`, `Brain.draw(t, n, glow, yaw)`, `Brain.outline(yaw): Float32Array` (224 × 192 signed distance field, 1 texel per mm), `Brain.fit: { stemJ, stemJ2, stemTop }`.
  - `smoke.js`: `createSmoke(canvas): Smoke | null`; `Smoke.size(geom)`, `Smoke.field(f32, w, h)`, `Smoke.draw(t, geom)`.
  - `heart.js`: `createHeart(canvas, data): Heart | null`; `Heart.size()`, `Heart.draw(t, arrive)`.
  - `main.js`: owns `geom = { W, H, k, cx, yAnchor, fieldH, box, px, py, sc }`, the frame loop, and the review switches `?age= ?yaw= ?hage= ?hyaw= ?smoke=0 ?mesh=0 ?tracts=0`. It sets `document.documentElement.dataset.stage` to `loading`, `live`, `still` or `failed`. It places the dot's track at `min(straightFrom(...), fieldH - 120)`. It re-lays out only when the width changes or the height changes by more than 90 px, so a phone's address bar hiding does not rebuild the stage. When any review switch is in the address, the three WebGL contexts are created with `preserveDrawingBuffer: true` so a test can read their pixels.
  - Pixel caps: stage canvas `sc = min(devicePixelRatio, 2, sqrt(7e6 / (W * fieldH)))`; smoke canvas at half resolution and no taller than `1.9 * H`.

- [ ] **Step 1: Write the failing tests** in `tests/e2e/stage.spec.js`

```js
const frozen = '/?age=0.35&yaw=0.2';
test('the stage goes live and draws something', async ({ page }) => {
  await page.goto(frozen); await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 20000 });
  const lit = await page.evaluate(() => { const c = document.querySelector('#stage'), o = document.createElement('canvas'); o.width = 64; o.height = 64; const x = o.getContext('2d'); x.drawImage(c, 0, 0, 64, 64); return [...x.getImageData(0, 0, 64, 64).data].filter((v, i) => i % 4 !== 3 && v > 40).length; });
  expect(lit).toBeGreaterThan(300);
});
test('frozen frames match the approved mockup', async ({ page }) => {
  for (const [name, url] of [['rest', '/?age=4.38&yaw=0.2&smoke=0'], ['impulse', '/?age=-0.17&yaw=0.2'], ['launch', '/?age=0.03&yaw=0.2'], ['burst', '/?age=0.35&yaw=0.2']]) {
    await page.goto(url); await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 20000 });
    await expect(page).toHaveScreenshot(`${name}.png`, { maxDiffPixelRatio: 0.02 });
  }
});
test('the smoke starts at the outline, not over the brain', async ({ page }) => {
  await page.goto('/?age=0.03&yaw=0.2&mesh=0&tracts=0'); await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 20000 });
  const a = await page.evaluate(() => { const c = document.querySelector('#smoke'), o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const x = o.getContext('2d'); x.drawImage(c, 0, 0); const at = (fx, fy) => x.getImageData(Math.round(c.width * fx), Math.round(c.height * fy), 1, 1).data[3]; const H = innerHeight / c.clientHeight; return { centre: at(0.5, 0.47 * H), far: at(0.03, 0.47 * H) }; });
  expect(a.centre).toBe(0); expect(a.far).toBe(0);
});
test('the heart is drawn and the line runs behind it', async ({ page }) => {
  await page.goto('/?hage=0.3&hyaw=0'); await page.locator('#heart').scrollIntoViewIfNeeded();
  await expect(page.locator('#about')).toHaveScreenshot('heart.png', { maxDiffPixelRatio: 0.02 });
});
test('canvases stay within their pixel caps on a large dense screen', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 2 })).newPage();
  await page.goto(frozen); await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 20000 });
  const px = await page.evaluate(() => [...document.querySelectorAll('canvas')].map(c => c.width * c.height));
  for (const p of px) expect(p).toBeLessThanOrEqual(7.1e6);
});
test('after rotation the cord still reaches the heart and the dot is on the line', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto(frozen); await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 20000 });
  await page.setViewportSize({ width: 812, height: 375 }); await page.waitForTimeout(400);
  const g = await page.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(), y = scrollY; return { stageBottom: r('#stage').bottom + y, heartTop: r('#heart').top + y, heartBottom: r('#heart').bottom + y, trackLeft: r('.track').left, mid: innerWidth / 2, sw: document.documentElement.scrollWidth }; });
  expect(g.stageBottom).toBeGreaterThan(g.heartTop); expect(g.stageBottom).toBeLessThan(g.heartBottom); expect(Math.abs(g.trackLeft - g.mid)).toBeLessThan(1); expect(g.sw).toBe(812);
});
test('a phone address bar hiding does not rebuild the stage', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 752 }); await page.goto(frozen); await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 20000 });
  const before = await page.evaluate(() => document.querySelector('#stage').height);
  await page.setViewportSize({ width: 375, height: 812 }); await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.querySelector('#stage').height)).toBe(before);
});
test('nothing is drawn once the stage and heart are scrolled away', async ({ page }) => {
  await page.addInitScript(() => { window.__draws = 0; for (const k of ['drawArrays', 'drawElements', 'drawArraysInstanced']) { const f = WebGL2RenderingContext.prototype[k]; WebGL2RenderingContext.prototype[k] = function (...a) { window.__draws++; return f.apply(this, a); }; } });
  await page.goto('/'); await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 20000 });
  await page.locator('#last').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.__draws); await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__draws)).toBe(before);
});
```

The four `toHaveScreenshot` baselines are created on the first run with `--update-snapshots`. Before accepting them, open each beside the same URL on the mockup (`python3 -m http.server 8765 --directory mockup`, then `http://localhost:8765/varungops-mockup.html?age=…`) and confirm they match by eye. Headless SwiftShader renders slightly differently from a real GPU, so the baselines are compared against themselves afterwards, not against the mockup's own screenshots.

- [ ] **Step 2: Run it.** Expected: FAIL, `data-stage` is never set.
- [ ] **Step 3: Port the drawing code.** Shader sources and the draw order come from `mockup/src/main.js` lines 32 to 151 and 355 to 408 unchanged, including the stencil pass that keeps fibres inside the cortex outline. `smoke.js` and `heart.js` come from the mockup files of the same name, with their globals turned into the objects named above. `main.js` takes `layout`, `frame`, `relayout` and the loader from lines 330 to 351 and 413 to 455. Drop the base64 loader: the real server serves `.bin`. Load `tracts-lite` when `W < 700`. The frame loop draws the stage only while `scrollY < fieldH + 80` and the heart only while it is within 600 px of the viewport, as in the mockup.
- [ ] **Step 4: Run it.** `SHOW_DRAFTS=1 npm run test:e2e -- --update-snapshots`, compare the four baselines with the mockup by eye, then run again without the flag. Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: brain, smoke and heart stage ported from the mockup"`

---

### Task 8: Reduced motion, fallbacks and text alternatives

**Files:**
- Create: `public/still/brain.webp`, `public/still/heart.webp`, `scripts/make-stills.mjs`, `tests/e2e/access.spec.js`
- Modify: `src/stage/main.js`, `src/components/{Home,About}.astro`, `src/styles/global.css`

**Interfaces:**
- Consumes: `data-stage` states from Task 7.
- Produces: `scripts/make-stills.mjs` (Playwright script: opens `/?age=4.38&yaw=0.2&smoke=0` and `/?hage=0.3&hyaw=0`, saves the stage cropped to the first screen and the heart canvas as WebP on black). `Home.astro` and `About.astro` each carry an `<img class="still" alt="…">` behind the canvas. CSS shows the still when `html[data-stage]` is `loading`, `still` or `failed`, or absent, and hides it when `live`. Alt texts: "A human brain seen from the right side, its lobes in colour, with the white-matter pathways visible inside it" and "An anatomical heart drawn as a red engraving".

- [ ] **Step 1: Write the failing tests**

```js
test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('draws one still frame, no smoke, and runs no animation loop', async ({ page }) => {
    await page.addInitScript(() => { window.__raf = 0; const r = requestAnimationFrame; window.requestAnimationFrame = f => { window.__raf++; return r(f); }; });
    await page.goto('/'); await expect(page.locator('html')).toHaveAttribute('data-stage', /live|still/, { timeout: 20000 });
    const before = await page.evaluate(() => window.__raf); await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__raf) - before).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => { const c = document.querySelector('#smoke'), o = document.createElement('canvas'); o.width = 32; o.height = 32; const x = o.getContext('2d'); x.drawImage(c, 0, 0, 32, 32); return x.getImageData(0, 0, 32, 32).data.some(v => v > 0); })).toBe(false);
  });
});
test('without WebGL 2 the still images are shown', async ({ page }) => {
  await page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, ...a) { return /webgl/.test(k) ? null : g.call(this, k, ...a); }; });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/'); await expect(page.locator('html')).toHaveAttribute('data-stage', 'still');
  await expect(page.locator('#home img.still')).toBeVisible(); await expect(page.locator('#about img.still')).toBeVisible(); expect(errors).toEqual([]);
});
test('if an anatomy file never arrives the still images stay and the page reads', async ({ page }) => {
  await page.route('**/data/tracts*.bin', r => r.abort());
  await page.goto('/'); await expect(page.locator('html')).toHaveAttribute('data-stage', 'failed', { timeout: 20000 });
  await expect(page.locator('#home img.still')).toBeVisible(); await expect(page.getByRole('heading', { level: 2 })).toHaveCount(9);
});
test('a lost WebGL context falls back to the still and recovers', async ({ page }) => {
  await page.goto('/?age=0.35&yaw=0.2'); await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 20000 });
  await page.evaluate(() => { window.__ext = document.querySelector('#stage').getContext('webgl2').getExtension('WEBGL_lose_context'); window.__ext.loseContext(); });
  await expect(page.locator('html')).toHaveAttribute('data-stage', 'still');
  await page.evaluate(() => window.__ext.restoreContext()); await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 20000 });
});
test('the stills carry text alternatives and the canvases are hidden from assistive technology', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#home img.still')).toHaveAttribute('alt', /human brain seen from the right side/);
  await expect(page.locator('#stage')).toHaveAttribute('aria-hidden', 'true'); await expect(page.locator('#heart')).toHaveAttribute('aria-hidden', 'true');
});
test('every section is reachable by keyboard', async ({ page }) => {
  await page.goto('/'); for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.tagName)).toBe('A');
});
```

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** On `webglcontextlost`, call `preventDefault()`, stop drawing and set `still`; on `webglcontextrestored`, rebuild every program and buffer from the data already in memory and set `live`. Under reduced motion, draw the brain and heart once at `t = T * 0.03` with `n = -1`, redraw only on resize, and never request an animation frame. Run `node scripts/make-stills.mjs` to produce the two images.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: reduced motion, still-image fallbacks and context recovery"`

---

### Task 9: Search, sharing and credits

**Files:**
- Modify: `src/layouts/Base.astro`, `src/components/Credits.astro`, `tests/e2e/content.spec.js`
- Create: `public/og.png` (1200 × 630, from `scripts/make-stills.mjs`: the brain with the name over it), `public/robots.txt`, `public/favicon.svg`

**Interfaces:**
- Produces: `<meta name="description">` "Dr Varun Gopal Rajan: a doctor working towards a life in surgery and the brain. Experience, research, teaching and how to collaborate."; Open Graph and Twitter card tags pointing at `/og.png`; one `application/ld+json` block of type `Person` with `name`, `url`, `jobTitle: "Doctor"`, `alumniOf`, and `sameAs` holding the LinkedIn address and `https://orcid.org/0009-0001-4362-1531`; a `<footer>` with the three credits from `prep/README.md` word for word and the share-alike sentence that follows them.

- [ ] **Step 1: Add the failing tests**

```js
test('the page describes itself for search and sharing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://varungops.com/og.png');
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(ld['@type']).toBe('Person'); expect(ld.name).toBe('Varun Gopal Rajan'); expect(ld.sameAs).toContain('https://www.linkedin.com/in/varun-g-rajan-a4a80a213'); expect(ld.sameAs).toContain('https://orcid.org/0009-0001-4362-1531');
});
test('the footer credits all three anatomy sources', async ({ page }) => {
  await page.goto('/'); const f = page.getByRole('contentinfo');
  for (const s of ['MNI ICBM 152 2009c', 'HCP-1065 tractography atlas', 'Human Connectome Project', 'BodyParts3D', 'CC BY-SA 4.0']) await expect(f).toContainText(s);
});
```

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: metadata, social preview, structured data and credits"`

---

### Task 10: Vercel build, checks and hand-over

**Files:**
- Create: `vercel.json`, `.nvmrc`, `.github/workflows/ci.yml`, `scripts/check-dist.mjs`
- Modify: `README.md`, `package.json` (script `check`: `npm test && npm run build && node scripts/check-dist.mjs`; `engines.node` pinned)

**Interfaces:**
- Produces:
  - `vercel.json`: `{ "framework": "astro", "buildCommand": "npm run check", "outputDirectory": "dist", "trailingSlash": true }`, plus a `headers` rule for `/data/(.*)\\.bin` setting `Content-Type: application/octet-stream` and `Cache-Control: public, max-age=31536000, immutable`, and a `redirects` rule sending host `www.varungops.com` to `https://varungops.com/$1` permanently. `trailingSlash` matches the `/research/<slug>/` routes from Task 4.
  - Node: `.nvmrc` and `engines.node` name the newest Node major that Vercel's build image offers. Check Vercel's current list of supported Node versions; it may not include Node 26, which runs locally.
  - `ci.yml`: on every push and pull request, `npm ci`, `npm run check` and the Playwright tests on Ubuntu. It does not deploy; Vercel does.
  - `check-dist.mjs` exits non-zero unless: `dist/index.html` exists; every `href` and `src` beginning `/` in every HTML file resolves to a file in `dist/`; `dist/data/` holds the eight data files; no file in `dist/` is under `mockup/` or `prep/`; the total of `dist/data/*.bin` is under 9 MB and `tracts-lite.bin` plus `brain.bin` plus `heart.bin` is under 7 MB.

- [ ] **Step 1: Write `check-dist.mjs` and run it against a broken build.** Delete `dist/data/heart.bin` after `npm run build` and run `node scripts/check-dist.mjs`. Expected: exit 1, "missing dist/data/heart.bin".
- [ ] **Step 2: Run it against a good build.** `npm run check`. Expected: exit 0, and it prints the size of each data file.
- [ ] **Step 3: Write `vercel.json`, `.nvmrc` and `ci.yml`** to the Interfaces above. Run `npx vercel build` locally only if Dr Rajan has already linked the project; otherwise `npm run check` is the local stand-in. Expected: exit 0.
- [ ] **Step 4: Write the README hosting section.** It covers: the repository and the Vercel project are both Dr Rajan's; `main` is live and other branches get preview addresses; the `SHOW_DRAFTS` environment variable in Vercel's project settings controls drafts (unset at launch); how to add a writing post (a Markdown file in `src/content/writing/`, then push); the free Hobby plan's limits (personal, non-commercial use, no second team member); and the domain steps from Step 7.
- [ ] **Step 5: Commit** `git add -A && git commit -m "ci: Vercel build config, CI workflow, dist checks and hosting notes"`
- [ ] **Step 6 (Dr Rajan): create the GitHub repository and push.** He creates an empty repository named `varungops.com` under his own account, public or private as he chooses, then runs:

```bash
cd ~/Documents/Claude/Projects/varungops.com && git remote add origin git@github.com:<his-username>/varungops.com.git && git push -u origin main
```

Expected: the CI workflow runs green on GitHub.
- [ ] **Step 7 (Dr Rajan, with his brother if he likes): connect Vercel and the domain.**
  1. In Vercel, Add New → Project → import `varungops.com` from GitHub. The settings come from `vercel.json`; leave `SHOW_DRAFTS` unset. Deploy. Expected: a `*.vercel.app` address showing the site.
  2. In Squarespace Domains, buy `varungops.com` in his own name with WHOIS privacy and auto-renew on, and decline everything else at checkout.
  3. In the Vercel project, Settings → Domains → add `varungops.com` and `www.varungops.com`. Copy the DNS records Vercel shows into Squarespace's DNS settings for the domain, exactly as shown, and remove any default Squarespace records that point the same names elsewhere.
  4. Expected, within about an hour: Vercel shows both domains as valid, `https://varungops.com` loads with a padlock, and `www.varungops.com` lands on it.

---

### Task 11: Before launch (checks that need Dr Rajan)

These are not code. Each is a gate from section 7 of the spec, and the site does not go live until all are ticked.

- [ ] **His words.** He rewrites or approves `src/content/about.md` and `src/content/collaborate.md`, then removes `draft: true` from each.
- [ ] **Missing items supplied:** a CV file for download (into `public/` and linked from Experience), and photographs for the Life gallery, none showing a patient or a clinical area.
- [ ] **Supervisors.** He confirms whether his MRes supervisors agree to a public description of the project. If they do, update `now.md` and the research entry and relax the content-rule test to match the agreed wording.
- [ ] **Facts.** Read every line of `src/content/` against `JARVIS:data/CANONICAL_FACTS.md`, the pending-additions queue and the November CV. Anything not traceable comes out.
- [ ] **Hermes.** From the JARVIS repository, run `python3 hermes/hermes_scan.py` with `--register his --stamp` on a text export of `src/content/`. Record the one-line result in the README.
- [ ] **His own devices.** He opens the built site on his laptop and his phone and judges the motion: scrolling stays smooth, the brain appears within a few seconds on a phone connection. If the phone is slow, lower the `make_lite.py` fraction from 0.6 and rebuild.
- [ ] **Visual check** at 375, 768 and 1280 px wide, and once with reduced motion switched on in the device settings.
- [ ] **Domain live.** Task 10 Step 7 is done: `https://varungops.com` loads with a valid certificate, `www` and plain `http://` both land on it, and the Squarespace account holds no other purchases. Contact mail goes straight to `drvarungopal@outlook.com`, so no forwarding is needed.
- [ ] **Data compression.** He runs this on the live site and pastes the output back:

```bash
curl -sI -H 'Accept-Encoding: br, gzip' https://varungops.com/data/brain.bin | grep -iE 'content-(encoding|length|type)'
```

If there is no `content-encoding` line, Vercel is sending the anatomy files uncompressed. Then lower the `make_lite.py` fraction, or rename the data to a type Vercel compresses and update `data.js` to match, and check again on his phone.
- [ ] **Housekeeping in JARVIS.** Once the new repository holds the mockup, delete `docs/superpowers/mockups/data/` and the `site-mockup` entry in `.claude/launch.json` from the JARVIS working tree, with his agreement.

---

## Not in this plan

A sign-in gated timeline, a contact form, comments, a newsletter, visitor analytics and an editing interface are out of the first version, as the spec says. A paid Vercel plan is not needed. If the site ever earns money or needs a second person in the Vercel project, the Hobby plan stops fitting and that decision comes back to him.
