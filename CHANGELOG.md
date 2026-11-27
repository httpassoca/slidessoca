# Changelog

All notable changes. Format: [Keep a Changelog](https://keepachangelog.com/), versions: semver.

## [Unreleased]

- Deck model, auto-layout engine, Markdown format parser, deck validation and sanitised
  rendering (`SlideView`), themes from dssoca (dark, light and every preset).
- Share storage: gzipped JSON files with a 30-day mtime expiry, `/api/decks` publish / read /
  republish / delete with an edit token.
- Quick create on `/new` (slide blocks with images, or one text box), Markdown import (`.md` +
  images or a `.zip`, paste, live preview, missing-image list), JSON import, `/format` help page,
  Markdown export as `.zip` with images, home-page deck actions (download, duplicate, delete).
  Fixed front-matter comments and layout round-trips in the Markdown format (SL-0003).
