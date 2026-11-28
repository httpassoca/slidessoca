# slidessoca

Make HTML slide decks with the [dssoca](https://github.com/httpassoca/dssoca) design system —
in the browser, on desktop or phone.

- **Quick create** — type a title, some text, drop images: slides lay themselves out. Or paste
  everything in one text box: an empty line starts a new slide, its first line is the title.
- **Markdown** — write a deck in a `.md` file ([format](docs/markdown-format.md), also in the app
  at `/format`), upload it with its images (or as one `.zip`), get the whole presentation.
- **Export / import** — download any deck as Markdown (a `.zip` with its images) or as
  `.slidessoca.json`, and import either back.
- **Downloads** — any deck (from the editor, the deck list or a shared link) as one
  self-contained `.html` that plays offline by double-clicking (←/→ Space Home/End, swipe, tap,
  F fullscreen, `#n` links; N shows speaker notes when the owner downloads it), as 1920×1080 JPGs
  in a `.zip`, or as a 16:9 PDF. Everything is drawn in the browser; notes never go in images.
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

## Editor

Click to select, drag to move, pull any of the 8 handles to resize (Shift keeps the ratio, Alt
turns snapping off), double-click — or double-tap on a phone — a text box to edit its Markdown.
Elements snap to the canvas edges and centre and to each other. Drop image files onto the canvas
to insert them (they are compressed in the browser first). On a phone the slide list becomes a
strip and the inspector opens as a bottom sheet from **Properties**.

| Keys                         | Does                                   |
| ---------------------------- | -------------------------------------- |
| Ctrl/⌘+Z, Ctrl/⌘+Shift+Z / Y | undo, redo                             |
| Arrows (Shift = ×10)         | nudge the selected element             |
| Delete / Backspace           | delete the selected element (or slide) |
| Enter / Escape               | edit the selected text box / stop      |
| Alt+↑ / Alt+↓ in the sorter  | move the slide earlier / later         |
| Ctrl/⌘+D in the sorter       | duplicate the slide                    |

Slides made from content (quick create, Markdown, the inspector's content form) stay
_auto-laid-out_ while you only change their text; moving, resizing or adding an element makes the
slide hand-arranged, and **Re-apply layout** turns it back.

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

## Deploy

`develop` deploys to slides-dev.passoca.dev and `main` to slides.passoca.dev: GitHub Actions
builds the Docker image, copies it to the VPS and restarts the container. Environments, ports,
the data volume, backups, releases (`pnpm release`) and the one-time setup
(`bash deploy/wizard.sh`) are in [docs/deploy.md](docs/deploy.md).
