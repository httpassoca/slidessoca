# slidessoca

Make HTML slide decks with the [dssoca](https://github.com/httpassoca/dssoca) design system —
in the browser, on desktop or phone.

- **Quick create** — type a title, some text, drop images: slides lay themselves out. Or paste
  everything in one text box: an empty line starts a new slide, its first line is the title.
- **Markdown** — write a deck in a `.md` file ([format](docs/markdown-format.md), also in the app
  at `/format`), upload it with its images (or as one `.zip`), get the whole presentation.
- **Export / import** — download any deck as Markdown (a `.zip` with its images) or as
  `.slidessoca.json`, and import either back.
- **Editor** — PowerPoint-style: slide sorter, drag/resize anything, inline text editing, layouts,
  themes, speaker notes.
- **Share** — a public link that lives for 30 days (republishing restarts the clock). Viewers get
  a phone-friendly viewer with swipe, fullscreen and a slide overview.
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
