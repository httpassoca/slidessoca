# Changelog

All notable changes. Format: [Keep a Changelog](https://keepachangelog.com/), versions: semver.

## [Unreleased]

- Editor (`/edit/[id]`, SL-0002): slide sorter (add by layout, duplicate, delete, drag / Alt+arrow
  reorder), canvas with select / move / 8-handle resize / snapping guides / z-order / inline
  Markdown editing, text box / image (picker + drop, compressed) / shape insert, inspector (text,
  image, shape, slide layout + background + content form + speaker notes), deck title + theme,
  undo/redo, autosave to IndexedDB; phone layout with a slide strip and a bottom-sheet inspector.
  Pure editing logic in `src/lib/deck/edit.ts`.
- SlideView: slide text no longer picks up dssoca's global `p`/heading sizes and colours, and the
  `.el.text` wrapper no longer clips (editor handles).
- Deck model, auto-layout engine, Markdown format parser, deck validation and sanitised
  rendering (`SlideView`), themes from dssoca (dark, light and every preset).
- Share storage: gzipped JSON files with a 30-day mtime expiry, `/api/decks` publish / read /
  republish / delete with an edit token.
- Quick create on `/new` (slide blocks with images, or one text box), Markdown import (`.md` +
  images or a `.zip`, paste, live preview, missing-image list), JSON import, `/format` help page,
  Markdown export as `.zip` with images, home-page deck actions (download, duplicate, delete).
  Fixed front-matter comments and layout round-trips in the Markdown format (SL-0003).
- Deploy: Dockerfile, `deploy.yml` (develop → slides-dev.passoca.dev, main → slides.passoca.dev,
  image built in CI, skipped cleanly without SSH secrets), nginx blocks, `deploy/wizard.sh`,
  `pnpm release` helper and [docs/deploy.md](docs/deploy.md).
