# varungops.com: design spec

Date: 23 November 2026 (hosting revised for GitHub, Vercel and Squarespace)
Owner: Dr Varun Gopal Rajan
Status: draft for his review. The mockup exists. The site itself is not built and the domain is not bought.
Mockup: https://claude.ai/artifact/8dSqaqFpUXovFcr2hVt1Jq (private). Local copy and its sources: `docs/superpowers/mockups/`.

## 1. Purpose

A personal website for Dr Rajan's career, research and interests. The audience is broad: consultants and shortlisters who search his name, research supervisors and collaborators, and people who know him personally. The site has to make one strong first impression and then let each of those readers find their section quickly.

Success means three things. A visitor remembers the home screen. A collaborator can see what he is working on and how to reach him within a minute. Nothing on the site contradicts what his applications and his GMC entry say.

## 2. Decisions already made

| Decision | Choice | Made by |
|---|---|---|
| Domain | `varungops.com`, bought through Squarespace Domains in his own name | Dr Rajan and his brother, 23 Nov 2026 |
| Hosting | Vercel, free Hobby plan, building from a GitHub repository under his own account | Dr Rajan and his brother, 23 Nov 2026 |
| Home screen | A brain in full colour on black, his name only, a line running down | Dr Rajan |
| Anatomy | Real, never invented: built from anatomical data, not drawn by hand | Dr Rajan |
| Brain | MRI-derived cortex in lobe colours with real fibre tracts inside, drawn the way tractography is drawn: lit, depth-sorted bundles | Dr Rajan |
| Shockwave | A white, smoky burst modelled on his reference clip, on every fourth beat. It leaves from the outline of the brain, never from its centre | Dr Rajan |
| Impulse | Starts at the centre of the brain, runs out along the tracts, and the shockwave starts where it reaches the surface | Dr Rajan |
| Tracker dot | Starts where the line becomes straight, below the cord | Dr Rajan |
| Joins | No visible seams: brainstem, cord, line and heart run into one another | Dr Rajan |
| Heart | A real anatomical model drawn as a red engraving on black, beating | Dr Rajan |
| Kept from the first mockup | The travelling dot on the line, and red on black for the heart | Dr Rajan |
| Section order | About, Now, Clinical Experience, Research, Teaching, Writing, Life, Collaborate, Contact | Dr Rajan |
| Scrolling | The browser's own scrolling, with no smooth-scroll library | Proposed, accepted with the recommended set |
| Build tool | Astro static site (section 5). Vercel builds it directly, with no adapter | Proposed |

## 3. The experience

### 3.1 Home
The first screen holds the brain, the name "Varun Gopal Rajan" centred over it, and the start of the line leaving the brainstem. There is no navigation bar, no subtitle and no button.

The brain is real. Its surface is the cortex of the MNI ICBM 2009c template, the standard MRI brain, so every gyrus and sulcus is where it belongs. Each lobe has its own colour: frontal blue, parietal gold, temporal green, occipital red, cerebellum violet, brainstem orange. Inside it run about 16,000 white-matter pathways taken from a tractography atlas averaged over 1,065 scanned brains, coloured by direction in the standard tractography code. Each pathway is drawn as a lit strand with a thin dark halo and is depth-sorted against the others, so a bundle reads as a bundle and the near hemisphere sits in front of the far one. No fibre is drawn outside the outline of the cortex. The brain turns slowly through a few degrees so its depth reads.

Once per heartbeat (0.96 seconds, about 62 beats a minute) an impulse starts at the centre of the brain, at the thalamus and upper brainstem, and runs out along every pathway. It reaches the ends of the pathways together, 0.36 seconds later, and the cortex brightens as it arrives. Every fourth beat is a full volley and the three between are fainter.

### 3.2 The shockwave
On every fourth beat, at the moment the full volley reaches the surface, a smoke burst leaves the brain. It starts at the outline of the brain as it is turned at that moment: the outline lights, and the front lifts off it in the brain's own shape before it grows ragged. Nothing is drawn over the brain itself. The burst has a ragged white front and wisps of smoke hanging behind it. It spreads at the same strength in every direction, frays as it grows, and fades within about four seconds. A faint wash of the brain's colours sits in the smoke behind the white front. It does not drift or fall, and it is gone well above the heart.

### 3.3 Brainstem, cord and line
The medulla does not end. Its surface carries on as the surface of the spinal cord, measured from the medulla's own cross-section and drawn with the same shading, and the corticospinal, lemniscal and reticulospinal fibres carry on inside it. The cord narrows the way the real cord narrows into its terminal thread, its fibres end one by one, and the colour drains gradually to red. What is left is the line. It passes behind the heart and continues to the foot of the page, with no join at any point.

Each beat sends one impulse down the line. The line and everything on it are part of the page and scroll with it natively, so nothing lags behind the scroll.

### 3.4 About and the heart
The About section opens on the heart: a real anatomical model with both atria, the ventricles, the aorta and its arch branches, the pulmonary arteries, the venae cavae, and the full coronary artery tree with the cardiac veins. It is drawn as a red engraving on black, with lines that ring the form and swell in the light.

When an impulse arrives from the brain, activation sweeps across the atria from the sinoatrial node, then up the ventricles from the apex, and the heart contracts: atria first, then the ventricles, with the wall moving in and the apex twisting. Nothing radiates from the heart.

On a desktop screen the About text sits either side of the heart. On a phone the heart comes first and the text follows beneath it.

### 3.5 The rest of the page
Below the heart the red line continues to the foot of the page. Sections hang off it on alternating sides on desktop and stack in the centre on a phone. A dot travels down the line as the visitor scrolls and names the current section. The dot starts where the cord has settled onto the centre of the page and the line is straight.

### 3.6 Motion and access
- Visitors who have asked their device to reduce motion get a still brain, a still heart and no smoke.
- Devices without WebGL 2 get a still image of the brain and the heart in place of the live versions.
- The brain and heart have text alternatives, and the written content reads correctly with no script running.
- Every section is reachable by keyboard and by heading navigation.

## 4. Content

### 4.1 Sections

| Section | What it holds | Source |
|---|---|---|
| About | Why medicine, why the brain, what he is working towards | His own words |
| Now | What he is working on this month | A short file he edits monthly |
| Clinical Experience | Clinical posts only, newest first. Three carry a short description (Akshaya general surgery, the Walton Centre, the neurosurgery Junior Resident year) and the rest are a single line. Credentials and CV download beneath | `CANONICAL_FACTS.md` |
| Research | One entry per project with its status (published, in progress, planned), talks, and his ORCID iD 0009-0001-4362-1531. The pathology paper carries no link | `CANONICAL_FACTS.md`, Ares ledger |
| Teaching | What he has taught and built, and for whom | `CANONICAL_FACTS.md` |
| Writing | Essays and notes, newest first. Empty at launch | Files he adds over time |
| Life | Interests and a photo gallery | His own photos |
| Collaborate | What he can contribute, what he is looking for, how to start | His own words |
| Contact | drvarungopal@outlook.com as a mail link, with LinkedIn and ORCID | Dr Rajan, 23 Nov 2026 |

Research projects and Writing posts each get their own page. Everything else lives on the one long home page.

### 4.2 Content rules
- Every fact comes from `CANONICAL_FACTS.md`. The Walton Centre role stays an observership. No figure appears that is not documented there.
- The About and Collaborate copy is his own writing. Drafts are offered as suggestions and he rewrites them.
- All copy passes the Hermes final pass before it goes live.
- No patient detail in text or photographs.
- No visa status, home address or phone number. The only email address on the site is drvarungopal@outlook.com.
- No paid services, adverts or affiliate links.
- The MRes project is described in public only after his supervisors agree.

## 5. How it is built

### 5.1 Approach
A static site built with Astro. Content lives in Markdown files, and the build produces a folder of ordinary HTML, CSS, JavaScript and data files that any web server can serve. There is no database, no login and no server code.

Two alternatives were considered. Next.js matches what his brother's own site appears to use, but it adds a Node server or an export step for no gain on a content site. Hand-written HTML is the simplest to host, but adding a Writing post or a research project would mean editing page markup each time. If his brother prefers to keep one stack on his server, Next.js with static export is an acceptable substitute and the rest of this spec still applies.

### 5.2 Parts

| Part | Job |
|---|---|
| Content files | One Markdown file per research project, writing post and experience entry, plus one each for About, Now and Collaborate |
| Section components | One component per section, each reading only its own content |
| Stage | Draws the brain surface, the tracts, the cord and the line in WebGL 2, on one canvas that sits in the page and scrolls with it |
| Smoke | Draws the shockwave as a shader on its own half-resolution canvas |
| Heart | Draws and animates the heart in WebGL 2 on its own canvas |
| Clock | One heartbeat clock that the stage, the smoke and the heart all read, so they stay in step |
| Line and marker | The red line below the heart and the travelling section dot, in plain CSS |
| Data preparation | Three Python scripts that turn the source anatomy into the small files the page loads |

The stage, smoke and heart are ported from the mockup, which works at desktop and phone widths. They are plain JavaScript with no library dependency.

### 5.3 Anatomical data

| Data | Source | Licence | Shipped size |
|---|---|---|---|
| Brain surface | MNI ICBM 2009c template, McGill | Free to use and modify with the copyright notice kept | 2.7 MB |
| Lobe labels | CerebrA atlas, McGill | CC0 | Inside the brain file |
| Fibre tracts | HCP-1065 tractography atlas (Yeh 2022) | CC BY-SA 4.0, with a Human Connectome Project acknowledgement | 3.1 MB |
| Heart | BodyParts3D, Database Center for Life Science | Treated as share-alike | 2.0 MB |

The raw downloads (about 270 MB) stay out of the repository. The preparation scripts and a README listing every source sit in the repository, so the shipped files can be rebuilt.

One part of the heart is reconstructed and the site should say so in its credits. The source model has the ventricular chambers but no outer ventricular wall. That wall is rebuilt by thickening each chamber to the depth at which the model's own coronary arteries lie: about 7 mm on the left and 2 mm on the right. Everything else in the heart is the source mesh unchanged.

The footer carries one credits line for the three sources. The adapted tract and heart files are offered under the same share-alike terms. His own text, photographs and code are not affected.

### 5.4 Performance limits
- The page loads about 7.8 MB of anatomical data. Vercel compresses text files in transit; whether it also compresses the `.bin` files is checked on the live site before launch. A phone draws 60% of the fibres. The written content appears first, and the brain and heart appear when their data arrives.
- Each canvas is capped in pixel count so that large or high-density screens do not exhaust memory.
- Drawing stops for anything scrolled out of view.
- The data should be thinned before launch if a phone on mobile data takes more than a few seconds to show the brain.
- Fonts are three families: Outfit for the name and headings, Source Serif 4 for body text, IBM Plex Mono for labels. They are served from the site itself.

### 5.5 Search and sharing
- Page title, description and a social preview image showing the brain and his name.
- Structured data identifying him as a person, linked to ORCID and LinkedIn.
- A sitemap and an RSS feed for Writing.

## 6. Hosting and deployment

The setup is his brother's choice, and Dr Rajan owns every account in it.

1. The site lives in a GitHub repository under Dr Rajan's own account. His brother can be added to it as a collaborator.
2. A Vercel project on Dr Rajan's free Hobby account is connected to that repository. Every push to the main branch builds and publishes the site, and the previous version stays live if the build fails. Pushes to any other branch get a private preview address, which is where changes are checked before they reach the main branch.
3. Vercel runs the unit tests and a check of the finished files as part of every build, so a failing test stops a broken version going live. The browser tests run in GitHub Actions on every push.
4. Drafts are controlled by one Vercel environment variable, so the About and Collaborate drafts stay off the live site until he switches them on.
5. Dr Rajan buys `varungops.com` through Squarespace Domains in his own name, with WHOIS privacy and auto-renew on, and buys nothing else there. He adds the domain to the Vercel project, copies the DNS records Vercel shows into Squarespace, and Vercel issues the HTTPS certificate. `www.varungops.com` redirects to `varungops.com`.
6. Contact goes straight to drvarungopal@outlook.com, so no email forwarding is needed at launch.

The free Hobby plan covers a personal, non-commercial site, and it does not let a second person into the Vercel project. His brother helps from the GitHub side or alongside him, never with his password.

The project sits in its own folder, `~/Documents/Claude/Projects/varungops.com/`, separate from JARVIS. The mockup, its data and its scripts move there when the build starts.

## 7. Checks before launch
- The site builds with no errors and every internal link resolves.
- Visual check at phone, tablet and desktop widths, and with reduced motion on.
- Scrolling and animation stay smooth on his own laptop and phone.
- The brain appears within a few seconds on a phone connection.
- Every fact on the site is traced to `CANONICAL_FACTS.md`.
- The credits line is present and names all three data sources.
- `https://varungops.com` loads with a valid certificate, and `www.varungops.com` and plain `http://` both land on it.
- Hermes pass recorded on the final copy.

## 8. Not in the first version
- A sign-in gated timeline like his brother's.
- A contact form, comments or a newsletter.
- Visitor analytics.
- An editing interface. He edits Markdown files, or asks for the change.

## 9. Open questions
1. Does his brother want to set up the Vercel project alongside him, given the free plan cannot add a second person to it?
2. Is the rebuilt ventricular surface acceptable to him as a doctor, or should the heart come from a different source model?
3. Which photographs go in the Life gallery?
4. Have his MRes supervisors agreed to a public description of the project?
5. Should the repository be public or private?
