# varungops.com

Dr Varun Gopal Rajan's personal site. An Astro static build, hosted on Vercel from this repository.

- `docs/spec.md` is the design, `docs/plan.md` the build plan, and `mockup/` the approved mockup the site was ported from.
- The brain, cord and heart are real anatomical data. `prep/README.md` lists every source, its licence, and how to rebuild the files in `public/data/`.

## Working on it

| Command | What it does |
|---|---|
| `npm run dev` | Local site at http://localhost:4321, with the About and Collaborate drafts showing |
| `npm test` | Unit tests: content rules, data decoding, the heartbeat clock, the cord, the outline field |
| `npm run test:e2e` | Browser tests (Playwright). Slow on purpose: the test browser draws WebGL in software |
| `npm run check` | Unit tests, a production build and the file checks. This is what Vercel runs |
| `npm run stills` | Re-renders the still images and the social preview (run `npm run build` first) |

Review switches on any local address: `?age=` freezes the moment after a volley, `?yaw=` fixes the turn, `?hage=` and `?hyaw=` do the same for the heart, and `?smoke=0`, `?mesh=0`, `?tracts=0` switch parts off.

## Adding a writing post

Add a Markdown file to `src/content/writing/` with this front matter, then push:

```
---
title: The title
date: 2026-12-01
summary: One sentence for the list and the feed.
draft: false
---
```

## Hosting

- **Who owns what.** The GitHub repository, the Vercel project and the domain are all in Dr Rajan's own name.
- **What goes live.** Every push to `main` is built and published by Vercel. If the build fails (a failing test, a missing file, data over the size cap), the previous version stays live. Every other branch gets a private preview address.
- **Drafts.** The About and Collaborate text is marked `draft: true` until he has rewritten it. A production build shows only those two headings unless the environment variable `SHOW_DRAFTS` is set to `1` in the Vercel project's settings. It is unset at launch.
- **Tests on GitHub.** `.github/workflows/ci.yml` runs the unit tests, the file checks and the browser tests on every push. It never deploys. The screenshot comparisons run only on macOS, where their baselines were made.
- **Plan.** Vercel's free Hobby plan: personal, non-commercial use, and no second person in the Vercel project. His brother can be a collaborator on the GitHub repository.
- **Node.** Pinned to 26.x in `package.json` and `.nvmrc`, which Vercel lists as its default.

### Connecting the domain

1. In Vercel, Add New → Project → import `varungops.com` from GitHub. The settings come from `vercel.json`. Deploy. A `*.vercel.app` address shows the site.
2. In the Vercel project, Settings → Domains → add `varungops.com` and `www.varungops.com`.
3. In Squarespace Domains, open the DNS settings for `varungops.com`. Copy in the records Vercel shows, exactly as shown, and remove any Squarespace defaults that point the same names elsewhere.
4. Within about an hour Vercel shows both domains as valid, `https://varungops.com` loads with a padlock, and `www.varungops.com` lands on it.

Contact mail goes straight to `drvarungopal@outlook.com`, so the domain needs no email setup.
