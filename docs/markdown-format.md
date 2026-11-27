# The slidessoca Markdown format

One `.md` file = one deck. Upload it on **/new → Markdown** together with the images it
references (or a `.zip` is NOT needed — just select the `.md` and the image files together).

```markdown
---
title: My talk # deck title (default: first slide title)
theme: dracula # dark | light | dracula | tokyo-night | gruvbox | nord | solarized | coffee
---

# Big title

A subtitle line

---

## Agenda

- First point
- Second point with **emphasis**

Note:
Speaker notes: everything after a `Note:` line, until the next ---.

---

<!-- layout: image-left -->

## A photo slide

Text goes beside the image.
![A cat on a keyboard](cat.jpg)

---

> Simplicity is prerequisite for reliability.
> — Edsger Dijkstra

---

![First](one.png)
![Second](https://example.com/two.png)
```

## Rules

| Thing           | How                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Slide break     | a line with only `---` (ignored inside fenced code)                                                                             |
| Title           | first `#`, `##` or `###` heading                                                                                                |
| Subtitle        | a second heading right after the title, or the single line after a `#` title                                                    |
| Body            | everything else: paragraphs, `-`/`1.` lists, `**bold**`, `*italic*`, `` `code` ``, links                                        |
| Image           | `![alt](file-or-url)` on its own line. Local names match uploaded files (case-insensitive, folders ignored)                     |
| Quote           | `>` lines; a last line starting with `—`, `--` or `-` is the citation                                                           |
| Speaker notes   | a `Note:` / `Notes:` line; everything after it in that slide                                                                    |
| Layout override | `<!-- layout: NAME -->` — `title`, `section`, `bullets`, `image-right`, `image-left`, `image-full`, `gallery`, `quote`, `blank` |

## Automatic layouts

Without an override the layout is picked from the content:

| Content              | Layout        |
| -------------------- | ------------- |
| `#` title + one line | `title`       |
| title only           | `section`     |
| title + body         | `bullets`     |
| body + 1 image       | `image-right` |
| 1 image, no body     | `image-full`  |
| 2+ images, no body   | `gallery`     |
| quote only           | `quote`       |

Text that does not fit its box is shrunk automatically (down to half size).

Exporting a deck back to Markdown uses the same format; hand-placed positions are not kept.
