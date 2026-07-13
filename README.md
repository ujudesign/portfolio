# Portfolio

Personal portfolio site. **Astro + Tailwind CSS v4 + GSAP**, with file-based markdown content and a **local-only admin panel** (Sveltia CMS). No database, no server, no public login — the built site is pure static files deployed to Cloudflare Pages.

## Run locally

```bash
npm install     # first time only
npm run dev     # start the dev server → http://localhost:4321
```

Other commands:

```bash
npm run build     # production build → ./dist
npm run preview   # preview the production build locally
```

## Editing content — two ways

### 1. Visual admin panel (local only)

With the dev server running, open **http://localhost:4321/admin/** and choose
**"Work with Local Repository"**. This is Sveltia CMS — a real admin panel to add
projects, upload thumbnails, arrange image grids, and write case studies. It edits
the files in this repo directly on your machine; nothing is uploaded anywhere.

The admin panel is **never deployed** as a working editor — it only functions
locally, so there's no public admin URL to attack. When you're happy, commit and
push, and Cloudflare builds the live site.

### 2. Edit markdown directly

Every project is a markdown file in `src/content/projects/`. Create a new file:

```markdown
---
title: My Project
description: One-line summary shown on the card.
year: 2026
role: Product Designer          # optional
client: Acme Inc.               # optional
tags: [Product Design, Web]
thumbnail: ../../assets/uploads/my-project-thumb.png
gallery:
  - ../../assets/uploads/my-project-01.png
  - ../../assets/uploads/my-project-02.png
url: https://example.com        # optional external link
featured: false                 # true floats it to the top of the homepage
draft: false                    # true hides it from the built site
---

Your case study, in markdown. Use ## headings for sections.
```

Put images in `src/assets/uploads/`. Astro optimizes them automatically
(resizes + WebP) at build time. Each project becomes its own page at `/work/<filename>`.

## Structure

```
src/
  content/projects/   Your projects (markdown) — the content
  assets/uploads/     Project images (optimized on build)
  pages/
    index.astro       Homepage (hero, work grid, about, contact)
    work/[slug].astro Case-study page template (one page per project)
  components/          ProjectCard, Header
  layouts/            BaseLayout (shared shell)
  scripts/            GSAP animations (respects reduced-motion)
  styles/             Tailwind import + custom styles
public/
  admin/              Local-only Sveltia CMS admin panel
  favicon.svg
astro.config.mjs      Update `site` to your real domain before launch
```

## Deploy (Cloudflare Pages)

Connect the repo in Cloudflare Pages with:

- **Framework preset:** Astro
- **Build command:** `npm run build`
- **Output directory:** `dist`

Every push to `main` rebuilds and deploys. Before launch, set your real domain in
`astro.config.mjs` (`site:`), and — if you ever want online editing — update the
`repo:` line in `public/admin/config.yml`.
