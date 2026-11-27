---
id: SL-0001
type: story
title: "Foundation: deck model, auto-layout, Markdown parser, share storage"
status: done
priority: high
tags: [core, api]
depends_on: []
parent: null
epic: null
created: 2026-11-27
updated: 2026-11-27
---

## Description

As the owner, I want a solid core every surface builds on: one deck model, one renderer, a layout
engine that places title/text/images by itself, the Markdown format parser, and a cheap share
store with 30-day expiry.

## Acceptance criteria

- [x] `Deck`/`Slide`/`SlideElement` model on a 1600×900 canvas (`src/lib/deck/types.ts`).
- [x] `autoLayout` + `layoutElements` for 9 layouts; every element stays inside the canvas.
- [x] Markdown format parser + exporter that round-trips content (`docs/markdown-format.md`).
- [x] `validateDeck` rejects unsafe image sources and malformed decks; text rendered via DOMPurify.
- [x] `SlideView` renders with pure CSS scaling (cqw) and auto-fits overflowing text.
- [x] Store: gzipped files, mtime = expiry, sweep, token-hashed ownership, quota; `/api/decks` routes.
- [x] Themes: dssoca dark/light + all presets.
- [x] Documentation updated (README, CLAUDE.md, ADR 0001, format spec).

## Notes

- `pnpm test` (markdown, layout, validate, store suites).
