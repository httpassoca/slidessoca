---
id: SL-0010
type: story
title: "No-fullscreen hint in the player and a backup reminder on home"
status: done
priority: low
tags: [viewer, home, backup]
depends_on: [SL-0004, SL-0003]
parent: null
epic: null
created: 2026-11-27
updated: 2026-11-27
---

## Description

As a viewer on an iPhone, I want to know how to get the slide as big as possible, since
fullscreen isn't available there. As the owner, I want a quiet nudge to back up my decks, since
they live only in this browser's IndexedDB, and a way to restore every deck from that backup.

## Acceptance criteria

- [x] Where element fullscreen is unavailable (same capability check that hides the fullscreen
      button), the viewer (`/s/[id]`) and the presenter's audience window show a one-time,
      dismissable hint. Dismissal is remembered in localStorage (failures ignored).
- [x] The hint is announced politely, has a close button ≥ 24px, returns focus sensibly and
      sits in its own row instead of over the slide.
- [x] Home shows "Decks live only in this browser" with a "Back up all decks" button (one .zip of
      every deck's JSON) when there is at least one deck, plus "Last backup …" / "Never backed up".
- [x] An accent dot marks the reminder when a deck changed after the last backup.
- [x] /new → Import JSON accepts the backup .zip and imports every deck in it.
- [x] Pure logic (backup zip, relative time, needs-backup rule) in `src/lib/deck/backup.ts`, unit
      tested; hint component tested with a mocked no-fullscreen environment; browser pass.
