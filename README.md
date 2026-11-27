# slidessoca

Make HTML slide decks with the [dssoca](https://github.com/httpassoca/dssoca) design system —
in the browser, on desktop or phone.

- **Quick create** — type a title, some text, drop images: slides lay themselves out.
- **Markdown** — write a deck in a `.md` file ([format](docs/markdown-format.md)), upload it with
  its images, get the whole presentation.
- **Editor** — PowerPoint-style: slide sorter, drag/resize anything, inline text editing, layouts,
  themes, speaker notes.
- **Share** — a public link that lives for 30 days (republishing restarts the clock; the link is a
  snapshot, so republish after editing). Viewers get a phone-friendly viewer: swipe or tap the
  left/right of a slide, arrow keys, fullscreen, an overview of every slide, a scrolling read
  mode, `#3` links to a slide, and "Make a copy" to edit the deck in their own browser.
- **Present** — presenter view with the next slide, speaker notes and a timer, plus an audience
  window that follows along. Keys: ←/→ Space PageUp/PageDown Home/End · F fullscreen ·
  O/Esc overview · N notes.
- **Themes** — dssoca dark/light plus every passoca.dev theme (Dracula, Tokyo Night, Gruvbox,
  Nord, Solarized, Coffee).

Production: <https://slides.passoca.dev> · development: <https://slides-dev.passoca.dev>

## Develop

```sh
pnpm install
pnpm dev          # http://localhost:5180
pnpm test && pnpm check && pnpm lint
```

Decks are stored in your browser; only published copies reach the server, as gzipped files that
expire after 30 days ([ADR 0001](docs/adr/0001-storage-on-the-vps.md)). Contributor and agent
notes: [CLAUDE.md](CLAUDE.md). Work tracker: [`agile/`](agile/README.md).
