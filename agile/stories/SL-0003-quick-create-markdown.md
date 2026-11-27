---
id: SL-0003
type: story
title: "Quick create and Markdown import/export"
status: done
priority: high
tags: [import, markdown]
depends_on: [SL-0001]
parent: null
epic: null
created: 2026-11-27
updated: 2026-11-27
---

## Description

As the owner, I want to make a deck by just typing a title, some text and dropping images — and
by uploading a Markdown file (plus its images) — and have the whole presentation mounted for me.
I also want to download any deck back as Markdown.

## Acceptance criteria

- [x] /new: Quick create (deck title, theme, one block per slide: title, text, images) → deck.
- [x] /new: Markdown upload (.md + image files, drag-drop or picker) and paste; preview of the
      slides before creating; missing images listed.
- [x] In-app format help page matching `docs/markdown-format.md`.
- [x] Export: download deck as .md (+ images) and as JSON; import JSON.
- [x] Mobile friendly.
- [x] Tests; browser pass.
- [x] Documentation updated (README, format doc).

## Notes

- Quick create (`/new`): "Slide by slide" blocks (title, text, images; add / reorder / remove) or
  "One text box" — an empty line starts a slide, first line = title (a `---` line switches to
  `---` separators; a chunk starting with `>`, a list item or an image has no title). Pure logic in
  `src/lib/deck/quick.ts`; drafts survive tab switches (`src/routes/new/draft.svelte.ts`).
- Markdown tab accepts `.md`/`.markdown`/`.txt` + images, or a `.zip` (STORE + DEFLATE reader in
  `src/lib/deck/zip.ts`). Missing images are listed; adding files re-parses live.
- Export: `deckToBundle` → `deck.md` + `images/slide-N-M.ext`, zipped with the STORE-only writer
  (plain `.md` when the deck has no embedded images). JSON import via `importDeckJson`.
- Parser fixes: front-matter `# comments` (the spec example had them), layout overrides written
  only when they differ from the implied layout (section-with-subtitle used to come back as
  title), `---` lines inside a body no longer split slides on export.
- `/format` renders `docs/markdown-format.md` itself (marked + DOMPurify).
