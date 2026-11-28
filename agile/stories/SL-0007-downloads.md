---
id: SL-0007
type: story
title: "Download a deck as HTML, JPGs or PDF"
status: done
priority: high
tags: [export, viewer, editor]
depends_on: [SL-0002, SL-0004]
parent: null
epic: null
created: 2026-11-27
updated: 2026-11-27
---

## Description

As a deck owner or a viewer of a shared link, I want to download the deck as a file I can play
offline (HTML), drop into other tools (JPGs) or print/send (PDF), so the deck outlives the
30-day link and works without the app.

## Acceptance criteria

- [x] **HTML**: one self-contained `.html` — images embedded (http images inlined when CORS allows,
      kept as links otherwise), the deck theme's dssoca CSS + preset palette, the fonts embedded as
      data: URLs (falls back to the Google Fonts link, then system fonts), slides as the static
      sanitised markup SlideView rendered, and a vanilla-JS player: ←/→ Space PageUp/PageDown
      Home/End, swipe, tap thirds, F fullscreen, `#n` hash, `03 / 12` counter. Opens from disk.
- [x] Speaker notes (N toggles a panel) only in the owner's download (editor, deck list); the
      viewer's download and decks without notes have no notes UI.
- [x] **JPGs**: `.zip` with one 1920×1080 `slide-01.jpg`… per slide, rasterised in the browser
      (SVG foreignObject → canvas, fonts and images inlined; unreachable images draw the quiet
      missing frame). Never includes notes.
- [x] **PDF**: 16:9 pages (960×540pt), one JPEG per page (DCTDecode), zero-dependency writer.
- [x] Progress toast while rendering; editor More menu, deck-list card menu, viewer bar "Download"
      menu (works at 360px).
- [x] Pure logic in `src/lib/export/` (PDF writer, HTML assembly, names) with unit tests; the
      browser part in `src/lib/client/downloads.ts`.
- [x] Browser pass: light, dark and a preset deck with uploaded/remote/dead images; HTML opened
      from disk offline and navigated; JPGs inspected; PDF parsed and rendered with pdf.js.

## Notes

- 2026-11-27: SlideView stays the only renderer: it is mounted off-screen (`mount`), left to settle
  (images, fonts, auto-fit), and its `outerHTML` is used; its scoped CSS is collected from the
  page's stylesheets by its `svelte-` hash. `svelte/server` `render` can't be used in the browser
  (client-compiled components), so DOM cloning was the robust route.
- The SVG root carries `data-theme`/`data-palette` when rasterising: dssoca derives tokens such as
  `--ss-primary` on `:root`, which would otherwise resolve with the dark palette.
- Open: the app itself shows light decks' `--ss-primary` with the dark accent (same `:root`
  derivation, the page root is dark) — the HTML/JPG/PDF downloads already use the right accent.
