---
id: SL-0004
type: story
title: "Viewer, presenter, overview and 30-day share links"
status: done
priority: high
tags: [viewer, share]
depends_on: [SL-0001]
parent: null
epic: null
created: 2026-11-27
updated: 2026-11-27
---

## Description

As the owner, I want to present a deck (fullscreen, keyboard, speaker notes), check every page at a
glance, and create a public link that lives for a month. As a viewer, I want the deck to work
nicely on my phone.

## Acceptance criteria

- [x] Share dialog in the editor: publish, copy link, republish (same link, restarts 30 days),
      unpublish; shows the expiry date.
- [x] /s/[id]: viewer with arrows/space/swipe, fullscreen, slide counter, overview grid; SSR with
      og tags; expired → friendly page.
- [x] Presenter mode: current + next slide, notes, timer.
- [x] "Make a copy" of a shared deck into my browser to edit.
- [x] Mobile: swipe, tap zones, fits portrait and landscape.
- [x] Tests; browser pass.
- [x] Documentation updated (README).

## Notes

- Player: `src/lib/components/player/` (DeckPlayer, Stage letterbox, Overview, gestures, fullscreen);
  navigation rules are the pure `src/lib/deck/nav.ts`.
- `/s/[id]` server-renders real Markdown: `render.ts` now renders through a no-raw-HTML marked
  renderer + tag/attribute allowlist (no DOM needed), with DOMPurify on top in the browser.
- Presenter audience window syncs over `BroadcastChannel` (`slidessoca:present:<deckId>`).
