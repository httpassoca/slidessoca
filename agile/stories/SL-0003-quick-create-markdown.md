---
id: SL-0003
type: story
title: "Quick create and Markdown import/export"
status: todo
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

- [ ] /new: Quick create (deck title, theme, one block per slide: title, text, images) → deck.
- [ ] /new: Markdown upload (.md + image files, drag-drop or picker) and paste; preview of the
      slides before creating; missing images listed.
- [ ] In-app format help page matching `docs/markdown-format.md`.
- [ ] Export: download deck as .md (+ images) and as JSON; import JSON.
- [ ] Mobile friendly.
- [ ] Tests; browser pass.
- [ ] Documentation updated (README, format doc).
