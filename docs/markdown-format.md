# The slidessoca Markdown format

One `.md` file = one deck. Pick (or drag in) the `.md` on **/new → Markdown**, or a `.zip`
holding it, or just paste the Markdown. **Images are links**: write each one as a full
`https://` URL to a picture on the web. Image files are not uploaded — a local path like
`cat.jpg` (or an image inside the zip) is not embedded; the import shows a warning for each one
so you can swap in a link.

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
![A tabby cat](https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/1280px-Cat_November_2010-1a.jpg)

---

> Simplicity is prerequisite for reliability.
> — Edsger Dijkstra

---

![A cat in the sun](https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/1280px-Cat_November_2010-1a.jpg)
![A cat on snow](https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Felis_catus-cat_on_snow.jpg/1280px-Felis_catus-cat_on_snow.jpg)
```

## Rules

| Thing           | How                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Slide break     | a line with only `---` (ignored inside fenced code)                                                                             |
| Title           | first `#`, `##` or `###` heading                                                                                                |
| Subtitle        | a second heading right after the title, or the single line after a `#` title                                                    |
| Body            | everything else: paragraphs, `-`/`1.` lists, `**bold**`, `*italic*`, `` `code` ``, links                                        |
| Image           | `![alt](https://…)` on its own line: a full http(s) link. Local paths are not embedded (the import warns about each one)        |
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

Front matter values may end with a `# comment`; quote a value that contains ` #`
(`title: "Talk #3"`).

## Export

**Download .md** writes the deck in this same format; image links stay links. An older deck that
still holds uploaded images downloads as a `.zip` with `deck.md` and `images/slide-N-M.webp`
(slide N, image M); importing that zip again keeps the text and warns about each image, since
images are links now (put the files online and use their URLs). A layout is written as `<!-- layout: … -->` only when it differs from the
automatic one. Hand-placed positions are not kept; use **Download .json** for an exact copy.

## Images on other sites

The browser loads each image straight from its site, without telling it which page asked
(`no-referrer`), so most hosts that block hotlinking still show it. Wikimedia Commons
(`upload.wikimedia.org`) works well: open the file page, pick a size and copy the image link. For
JPG / PDF downloads the image must also allow copying (CORS); when a site does not, that slide
gets a placeholder and the download says how many images were left out.
