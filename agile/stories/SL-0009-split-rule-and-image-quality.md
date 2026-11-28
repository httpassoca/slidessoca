---
id: SL-0009
type: story
title: "One split rule for quick create, keep small images as they are"
status: done
priority: low
tags: [import, markdown, images]
depends_on: [SL-0003]
parent: null
epic: null
created: 2026-11-27
updated: 2026-11-27
---

## Description

As the owner, I want quick create's "one text box" to split slides the same way the Markdown
format does — only a line containing just `---` — so a slide can hold several paragraphs without
switching modes. I also want images that are already small JPEG/WebP files to keep their bytes,
so exporting a deck and importing it again does not lose quality each time.

## Acceptance criteria

- [x] One text box: only a `---` line starts a new slide; blank lines inside a slide are
      paragraph breaks; leading / trailing / repeated `---` lines make no empty slides.
- [x] First line of a slide is its title unless it starts with `>`, a list item or an image.
- [x] Field hint, example text and README describe the new rule.
- [x] `compressImage` keeps the original bytes of WebP / JPEG files ≤ 1920px on both edges and
      ≤ 500 KB (`shouldKeepOriginal`, pure and tested). GIFs still pass through.
- [x] Tests; browser pass (preview at 1280×800 and 360×740; .md zip export → import keeps a
      small JPEG byte-identical).

## Notes

- `splitQuickText` now reuses the Markdown parser's `splitSlides` (also ignores `---` inside
  code fences), then applies the existing title rule. The empty-line mode is gone.
- `shouldKeepOriginal({ type, width, height, bytes })` in `src/lib/client/images.ts`;
  `KEEP_ORIGINAL_BYTES = 500 KB`. `image/jpg` (non-standard) is still re-encoded.
