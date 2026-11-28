# Changelog

All notable changes. Format: [Keep a Changelog](https://keepachangelog.com/), versions: semver.

## [Unreleased]

- Deck downloads (SL-0007): one self-contained `.html` with a tiny offline player (speaker notes
  with N when downloaded by the owner), a `.zip` of 1920×1080 JPGs and a 16:9 PDF, all drawn in
  the browser from SlideView. In the editor's More menu, the deck list's card menu and the shared
  viewer's bar.
- Backup and no-fullscreen hint (SL-0010): home shows "Decks live only in this browser" with
  **Back up all decks** (one `.zip` of every deck's JSON), the last backup time and a dot when a
  deck changed since; `/new` Import JSON restores every deck from that `.zip`. The viewer and the
  audience window show a one-time, dismissable hint where fullscreen isn't available (iPhone).
- Publish rules (SL-0008): speaker notes are left out of the published copy unless "Include
  speaker notes" is ticked in the Share dialog (remembered per deck, used by Republish; JSON
  export keeps notes); an upload-size meter against the 15 MB limit (warning from 12 MB, publish
  blocked at the limit); image files over 20 MB are refused before compression everywhere images
  enter a deck. Limits live in `src/lib/deck/limits.ts`.
- Quick create's one text box splits slides only on a line with just `---`, like the Markdown format, so slides can hold several paragraphs; small JPEG/WebP images (≤1920px, ≤500 KB) keep their original bytes instead of being re-encoded, so export → import no longer loses quality (SL-0009).

## [0.1.0] - 2026-11-27

- Unslop pass (SL-0006): zero-padded slide counter everywhere, calmer home with real sample slides in the empty state, deck actions in a menu, broken images draw a quiet frame, no hairlines around the viewer stage, toast copy without trailing periods.

- Global page margin reset; ship the Caskaydia Cove fonts dssoca's theme.css requests.

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
- Viewer, presenter and share links (SL-0004): `/s/[id]` player with keys, swipe, tap zones,
  fullscreen, `#n` deep links, overview grid, read mode, "Make a copy" and Open Graph tags;
  `/present/[id]` with next slide, notes, timer and a synced audience window; the Share dialog
  (publish, copy, republish, unpublish, expiry). Slide Markdown now renders formatted on the server.
- Quick create on `/new` (slide blocks with images, or one text box), Markdown import (`.md` +
  images or a `.zip`, paste, live preview, missing-image list), JSON import, `/format` help page,
  Markdown export as `.zip` with images, home-page deck actions (download, duplicate, delete).
  Fixed front-matter comments and layout round-trips in the Markdown format (SL-0003).
- Deploy: Dockerfile, `deploy.yml` (develop → slides-dev.passoca.dev, main → slides.passoca.dev,
  image built in CI, skipped cleanly without SSH secrets), nginx blocks, `deploy/wizard.sh`,
  `pnpm release` helper and [docs/deploy.md](docs/deploy.md).
