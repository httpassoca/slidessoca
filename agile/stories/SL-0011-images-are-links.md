---
id: SL-0011
type: story
title: "Images are links: no uploads, URL inputs everywhere, legacy decks blocked from publishing"
status: done
priority: high
tags: [images, editor, quick-create, markdown, share, downloads]
depends_on: [SL-0002, SL-0003, SL-0007, SL-0008]
parent: null
epic: null
created: 2026-11-28
updated: 2026-11-28
---

## Description

As the owner, I want every image in a deck to be an http(s) link instead of an uploaded file,
so published decks stay tiny on the server and users' image sizes stop costing storage
(ADR 0002: "Make all images URLs. This way we do not suffer by user image size.").

## Acceptance criteria

- [x] `validateDeck(input, { allowDataImages })`: strict by default; `/api/decks` POST/PUT answer
      400 to a deck with a `data:` image, naming the slide. JSON import, backup restore and "Make
      a copy" pass `allowDataImages: true`, so legacy local decks keep loading.
- [x] The Share dialog lists the slides with uploaded images, asks for links and blocks Publish /
      Republish until they are replaced.
- [x] Editor (Image button → URL dialog, canvas drop of a link), Inspector (Replace image, content
      images) and quick create blocks take an "Image URL" with a preview and alt text. Dropping or
      pasting an image file shows a "links only" toast.
- [x] `compressImage`, `shouldKeepOriginal`, `checkImageFile`, `acceptImages`, `IMAGE_FILE_MAX_MB`
      and their tests are removed.
- [x] Markdown import keeps `![alt](https://…)`; local paths and images in a zip are not
      embedded, one warning per image ("use a full https link"). `docs/markdown-format.md` (and
      the in-app /format page) updated; the example uses Wikimedia links.
- [x] `DECK_MAX_MB` is 1; the size meter is gone. Body limits stay at 16 MB (still above).
- [x] SlideView images: `referrerpolicy="no-referrer"`, `decoding="async"`, `loading="lazy"`
      (exports switch to eager); the missing-image frame stays.
- [x] JPG/PDF/HTML downloads inline images via `fetch(mode: 'cors')` only for the export; CORS
      refusals draw the missing frame (JPG/PDF) or keep the link (HTML) and a toast says how many.
      No server proxy.
- [x] ADR 0002, ADR 0001 note, CLAUDE.md invariant 5, README, CHANGELOG.
- [x] Tests: validator strict/legacy paths, API 400, Markdown warnings, Share dialog block, export
      fallback with a failing fetch, Inspector URL input, drop/paste helpers.
