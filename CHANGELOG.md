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
