---
id: SL-0002
type: story
title: "PowerPoint-style editor (desktop + mobile)"
status: todo
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

- [ ] Slide sorter: add, duplicate, delete, reorder (drag + keyboard).
- [ ] Canvas: select, move, resize, inline text edit, delete, z-order; snapping to edges/centre.
- [ ] Insert text box, image (upload → compressed), shape.
- [ ] Inspector: text size/colour/align/font/bold/italic, image fit/alt, slide layout, background, deck theme, deck title.
- [ ] Auto slides stay auto when only text changes; manual moves flip `manual`; Re-apply layout.
- [ ] Undo/redo, autosave to IndexedDB.
- [ ] Mobile: usable at 360px (sorter as strip, inspector as bottom sheet).
- [ ] Tests for the editor state logic; browser pass.
- [ ] Documentation updated (README).
