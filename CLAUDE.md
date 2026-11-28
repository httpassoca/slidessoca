# slidessoca — Claude / agent context

HTML slide decks on the [dssoca](https://www.npmjs.com/package/dssoca) design system. A
PowerPoint-style editor, a "just give me text and images" quick-create that lays slides out by
itself, a Markdown import format, a viewer/presenter that works on phones, and public share
links that live for 30 days. Read this before working.

## Stack

- **SvelteKit 2 + Svelte 5 (runes)**, `@sveltejs/adapter-node`: ONE Node process serves the app
  and the `/api` routes. Runs as a Docker container on the VPS (ADR 0001).
- **dssoca** for every piece of chrome (Button, Input, Modal, Select, SegmentedControl, Toaster…).
  Read `node_modules/dssoca/dist/components/*.svelte.d.ts` before using a component. Style with
  `--ss-*` tokens only — no colour literals, **zero border-radius**, logical properties.
- **pnpm only**, Node ≥ 24, ESM. Vitest + Testing Library (jsdom). ESLint + Prettier (no semi,
  single quotes, 100 cols). `svelte-check` must be clean.

## Layout

```
src/lib/
  deck/        PURE deck logic — no DOM, no Svelte, no fetch (unit-tested in isolation)
    types.ts     Deck / Slide / SlideElement / SlideContent model, canvas 1600×900
    layout.ts    auto-layout: SlideContent → positioned elements (autoLayout, layoutElements, relayout)
    factory.ts   makeDeck / makeSlide / cloneSlide / publicDeck
    markdown.ts  the Markdown format (spec: docs/markdown-format.md) ↔ Deck
    validate.ts  untrusted JSON → Deck (server + client). Image src: http(s) only; legacy raster
                 data: URLs only with { allowDataImages: true } (browser-local paths)
    images.ts    image links: checkImageUrl, legacy data:-image detection (ADR 0002)
    render.ts    Markdown → sanitised HTML (no-raw-HTML marked + allowlist, works on the server;
                 + DOMPurify in the browser), COLOR_VAR token map
    nav.ts       player navigation: keys, swipe/tap gestures, #n hash, presenter sync messages
    meta.ts      plain-text deck facts (Open Graph description)
  themes.ts    THEMES = dssoca dark/light + every dssoca preset (same menu as passoca.dev)
  client/      browser-only: db.ts (IndexedDB decks), images.ts (drop/paste → link or toast), share.ts (publish API)
  server/      server-only: store.ts (gzipped JSON files, mtime = expiry), instance.ts, http.ts, ratelimit.ts
  components/  SlideView.svelte — THE renderer, shared by editor, thumbnails, viewer, presenter
               player/ — DeckPlayer (viewer + audience window), Stage (16:9 letterbox), Overview
               ShareDialog.svelte — publish / republish / unpublish (opened by the editor)
src/routes/
  /            deck list (IndexedDB)
  /new         quick create + Markdown import
  /edit/[id]   editor
  /present/[id] presenter (local deck; ?start=n, ?audience=1 = synced audience window)
  /s/[id]      public viewer (SSR — the only SSR page; everything else is ssr=false)
  /api/decks   POST publish · /api/decks/[id] GET / PUT (Bearer token) / DELETE
  /health      container probe
agile/         work tracker (board = index.html, `pnpm agile`). Slug: SL
docs/          adr/, markdown-format.md, deploy.md
deploy/        nginx blocks + wizard.sh (owner's one-time VPS setup)
scripts/       release.mjs (`pnpm release`)
```

## Invariants — do not break these

1. **One renderer.** Every surface draws slides with `SlideView.svelte`. Positions are % of the
   1600×900 canvas and font sizes are `cqw` (container query units) so slides scale with pure
   CSS and render on the server. Never add a second renderer or JS-based scaling.
2. **Content vs elements.** A slide has `content` (what it says) and `elements` (where things
   sit). While `manual === false`, elements are derived: `layoutElements(slide.id, layout,
content)`. Moving/resizing/adding an element sets `manual = true`; "Re-apply layout" calls
   `relayout()`. Editing the text of a role element (title/subtitle/body…) on an auto slide
   writes back to `content`, so it stays auto.
3. **Decks live in the browser** (IndexedDB). The server only holds _published_ copies. The edit
   token for a published copy is stored in the local deck's `share` and is never sent anywhere
   except as `Authorization: Bearer` to `/api/decks/[id]`. `publicDeck()` strips it.
4. **All slide text goes through `renderMarkdown()`** (DOMPurify). Never `{@html}` raw deck text.
   Images are only `http(s)` URLs (`safeImageSrc`) — never SVG data, never javascript:.
5. **Images are links** (ADR 0002). No image file ever enters a deck: every image input is an
   "Image URL" field (`ImageUrlField.svelte`), and the server rejects `data:` images (400). That
   is what keeps storage cheap. Legacy decks with embedded images still load locally
   (`validateDeck(x, { allowDataImages: true })`) but the Share dialog blocks publishing them.
   Image tags use `referrerpolicy="no-referrer"`; exports inline images via CORS fetch only for
   the download. Never add a server-side image proxy (SSRF, bandwidth).
6. **Expiry = file mtime.** `store.ts` sets a deck file's mtime to its expiry; the hourly sweep
   deletes past ones. Republishing restarts the 30 days. Don't add a database for this.
7. **Mobile works.** Every page is usable at 360px wide; touch targets ≥ 24px; the viewer
   supports swipe.

## Commands

```sh
pnpm install
pnpm dev            # http://localhost:5180
pnpm test           # Vitest (run once)
pnpm check          # svelte-check
pnpm lint && pnpm format:check
pnpm build && pnpm start   # production build on :3000 (DATA_DIR=./data)
pnpm agile          # rebuild agile/index.html
pnpm release        # on release/x.y.z: validate bump vs last tag, draft CHANGELOG section
```

## Deploy (docs/deploy.md)

- `deploy.yml`: push to `develop` → container `slidessoca-dev` (127.0.0.1:3005, volume
  `slidessoca-dev-data`); push to `main` → `slidessoca` (127.0.0.1:3004, `slidessoca-data`). The
  image is built **in CI, never on the VPS** (memory), shipped as a tarball, started by the
  `docker:*` scripts in `package.json` (run with npm on the VPS), then probed on `/health` and `/`.
- No SSH secrets → the run ends as "skipped deploy (no secrets)" (green). One-time setup:
  `bash deploy/wizard.sh` (owner only). Changing a port/domain means package.json scripts,
  deploy.yml, the nginx block and the wizard together.
- The container sets `BODY_SIZE_LIMIT=16M`; nginx `client_max_body_size 16m`. Keep both above
  `DECK_MAX_MB` (1 MB default since images became links).

## Rules

- **Tests are a RULE**: add/extend tests for any change; `pnpm test`, `pnpm check`, `pnpm lint`,
  `pnpm format:check` green before a PR.
- **Agile is a RULE**: every change updates its `agile/` story/task (status, `updated`), then
  `pnpm agile`. New work = new item `SL-NNNN` (next free number across stories/tasks/epics).
- **Docs**: user-facing changes update `README.md`, and the Markdown format change updates
  `docs/markdown-format.md` **and** the in-app format help.
- Browser pass for UI work: run the app and check it with headless Chromium at desktop and
  360×740, in a dark and a light deck theme.

## Git flow — ALL changes follow this

Same model as dssoca: **git-flow**.

- `main` — production (deploys to slides.passoca.dev). `develop` — integration (deploys to
  slides-dev.passoca.dev).
- `feature/<slug>` off `develop`, PR back into `develop`. `release/<x.y.z>` off `develop` → PR into
  `main` (tag `vX.Y.Z`) and back-merge into `develop`. `hotfix/<x.y.z>` off `main`.
- No direct pushes to `main`/`develop`; merge via PR with green CI (`test` check).
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`…), co-author trailer at the end.
- `CHANGELOG.md` keeps an `## [Unreleased]` section; every PR adds its bullet there.
