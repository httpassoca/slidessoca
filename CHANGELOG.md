# Changelog

All notable changes. Format: [Keep a Changelog](https://keepachangelog.com/), versions: semver.

## [Unreleased]

- Deck model, auto-layout engine, Markdown format parser, deck validation and sanitised
  rendering (`SlideView`), themes from dssoca (dark, light and every preset).
- Share storage: gzipped JSON files with a 30-day mtime expiry, `/api/decks` publish / read /
  republish / delete with an edit token.
- Viewer, presenter and share links (SL-0004): `/s/[id]` player with keys, swipe, tap zones,
  fullscreen, `#n` deep links, overview grid, read mode, "Make a copy" and Open Graph tags;
  `/present/[id]` with next slide, notes, timer and a synced audience window; the Share dialog
  (publish, copy, republish, unpublish, expiry). Slide Markdown now renders formatted on the server.
- Deploy: Dockerfile, `deploy.yml` (develop → slides-dev.passoca.dev, main → slides.passoca.dev,
  image built in CI, skipped cleanly without SSH secrets), nginx blocks, `deploy/wizard.sh`,
  `pnpm release` helper and [docs/deploy.md](docs/deploy.md).
