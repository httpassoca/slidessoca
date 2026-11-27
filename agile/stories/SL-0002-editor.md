---
id: SL-0002
type: story
title: "PowerPoint-style editor (desktop + mobile)"
status: done
priority: high
tags: [editor]
depends_on: [SL-0001]
parent: null
epic: null
created: 2026-11-27
updated: 2026-11-27
---

## Description

As the owner, I want to open a deck and edit any slide like in PowerPoint: a slide sorter, a canvas
where I select, drag, resize and type into elements, add text/images/shapes, pick layouts and
themes, write speaker notes, undo mistakes — and do the basics on my phone.

## Acceptance criteria

- [x] Slide sorter: add, duplicate, delete, reorder (drag + keyboard).
- [x] Canvas: select, move, resize, inline text edit, delete, z-order; snapping to edges/centre.
- [x] Insert text box, image (upload → compressed), shape.
- [x] Inspector: text size/colour/align/font/bold/italic, image fit/alt, slide layout, background, deck theme, deck title.
- [x] Auto slides stay auto when only text changes; manual moves flip `manual`; Re-apply layout.
- [x] Undo/redo, autosave to IndexedDB.
- [x] Mobile: usable at 360px (sorter as strip, inspector as bottom sheet).
- [x] Tests for the editor state logic; browser pass.
- [x] Documentation updated (README).

## Notes

- Pure state logic: `src/lib/deck/edit.ts` (geometry, snapping, element/slide ops, text ↔ content
  write-back, undo history with coalescing groups) — `test/unit/edit.test.ts`.
- Components: `src/lib/components/editor/` (EditorTopBar, SlideSorter, EditorCanvas, Inspector,
  Swatches) — `test/unit/editor-components.test.ts`. Route: `src/routes/edit/[id]/+page.svelte`.
- Touch: only the selected element captures touch drags (`touch-action: none`), so the page still
  scrolls elsewhere; slide reorder on touch uses the Move earlier / later buttons.
- Browser pass (headless Chromium, 1280×800 + 360×740, dark + light deck themes): create, add
  slides, drag/resize, inline edit, undo/redo, image picker + drop, reload persists.
