---
id: SL-0012
type: story
title: "Example decks: four ready-made decks to read, present and copy"
status: done
priority: medium
tags: [examples, home, new, markdown, present]
depends_on: [SL-0003, SL-0004, SL-0011]
parent: null
epic: null
created: 2026-11-28
updated: 2026-11-28
---

## Description

As a new user, I want a few finished example decks I can open, read, present and copy, so I can
see what slidessoca makes and start from something real ("Generate a few examples for users,
with random themes").

## Acceptance criteria

- [x] Four decks as Markdown files in `src/lib/examples/` (the repo's own format, parsed at
      runtime): Stalker (gruvbox), The first computer bug (light), Why democracy fails (nord),
      Miracles you can witness (coffee). 8–12 slides each, title/section/bullets/image/gallery/
      quote layouts, speaker notes on most slides.
- [x] Images are https links to `upload.wikimedia.org` only (free licences, CORS-enabled),
      credited on each deck's last slide; no film stills.
- [x] Home page (with or without decks) and `/new` → Examples show them as real slide thumbnails
      with title, one line and a mono slide count.
- [x] `/examples/[slug]`: slideshow and read mode, **Make a copy** (new local deck, opens the
      editor) and **Present** (presenter at `/present/example:<slug>`, Exit returns to the example).
- [x] Fix: `/new?tab=markdown&example` opened directly preloads the Markdown example.
- [x] Tests: each example parses with no warnings, 8–12 slides, valid distinct theme, links only
      to upload.wikimedia.org, passes the strict validator; list, copy and present actions.
