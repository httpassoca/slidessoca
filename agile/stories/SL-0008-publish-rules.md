---
id: SL-0008
type: story
title: "Publish rules: private speaker notes, size meter, 20 MB image cap"
status: done
priority: high
tags: [share, images]
depends_on: [SL-0004]
parent: null
epic: null
created: 2026-11-27
updated: 2026-11-27
---

## Description

As the owner, I want my speaker notes to stay private unless I choose to share them, to see how
big a publish will be before I hit the limit, and to be stopped early when I pick an image file
that is far too large.

## Acceptance criteria

- [x] Speaker notes are stripped from the published copy by default; the Share dialog has an
      "Include speaker notes" checkbox (unchecked by default), remembered per deck and used by
      Republish. The flag never reaches the server.
- [x] Stripping is a pure function (`publicDeck(deck, { notes })`); JSON export keeps notes.
- [x] Share dialog shows the upload size ("4.2 MB of 15 MB") with a bar; warning from 12 MB;
      Publish / Republish disabled at 15 MB with a "remove or replace images" message.
- [x] One limits module (`src/lib/deck/limits.ts`) used by the server default and the client;
      `DECK_MAX_MB` still overrides on the server.
- [x] Image files over 20 MB are refused before compression with a "<name> is over 20 MB"
      toast: editor insert / replace / drop, inspector images, quick create, Markdown import
      (files and zip).
- [x] Tests; browser pass at 1280×800 and 360×740.
- [x] Docs: README, CHANGELOG, ADR 0001 note.

## Notes

- Private field: `Deck.publishNotes` (local only). The editor keeps it beside `share`, outside
  the undo history; `publicDeck()` and `copyDeck()` drop it.
- Gate: `checkImageFile` / `checkImageSize` / `acceptImages` in `src/lib/client/images.ts`
  (`compressImage` itself is unchanged). `readImportFiles` reports `tooLarge` messages.
- The meter measures `publishBody(deck)` — the exact JSON a publish uploads.
- The client meter uses the default limit; if the server's `DECK_MAX_MB` is lowered, the server's
  413 still applies.
