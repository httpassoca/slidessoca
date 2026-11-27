---
id: SL-0006
type: task
title: "Unslop pass across every screen"
status: done
priority: high
tags: [ui, polish]
depends_on: []
parent: null
epic: null
created: 2026-11-27
updated: 2026-11-27
---

## Description

Design redline pass (unslop skill, polish mode: the app already follows dssoca).

- Direction: a dark auditorium — terminal facing a projector screen. The bright element is
  always the slides themselves; chrome stays quiet.
- Signature: the zero-padded mono slide counter (`03 / 12`, `src/lib/deck/count.ts`) on the
  sorter, previews, overview, viewer, presenter, editor and deck cards.
- Home: one primary + one secondary action, "Blank deck" as a quiet link; tagline; deck cards
  with weight 500 titles, `01 slide` (plural bug fixed), shared dot, actions in a menu; the empty
  state renders three real slides from the Markdown example.
- SlideView: images that fail to load draw a dashed frame with the alt text instead of the
  broken-image glyph.
- Viewer/presenter: no shadow hairlines around the letterboxed slide; title weight 500.
- Copy: no trailing periods on toasts and single-line messages.
- Out of scope (dssoca itself): uppercase tracked field labels in Input/Select/Textarea.
