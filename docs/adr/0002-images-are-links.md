# ADR 0002 — Images are links

Status: accepted · 2026-11-28 · supersedes the image part of ADR 0001

## Context

slidessoca is free, and published decks live on one VPS disk (ADR 0001). Images were uploaded
into decks: compressed in the browser (≤1920px, WebP) and stored inside the deck JSON as `data:`
URLs. Even compressed, photos are almost all of a deck's weight: a 20-slide talk with photos was
several MB, against a few KB of text. That is what forced a 15 MB per-deck limit, a 16 MB request
body, the size meter in the Share dialog and a 20 MB file gate, and it is what fills the 2 GB
store. Every viewer also downloads the whole deck JSON, images included, before the first slide.

The owner's call: "Make all images URLs. This way we do not suffer by user image size."

## Decision

- An image in a deck is an **http(s) link**. Nothing is uploaded; there is no `data:` image in
  new content.
- Every place that took an image file (editor Image button, canvas drop, Inspector "Replace",
  content images, quick create blocks, Markdown import with its images or a zip) takes an
  **Image URL** instead: paste a link, see a preview, set the alt text. Dropping or pasting an
  image _file_ shows a short "images are links" toast; dragging an image from another browser
  tab drops its link.
- The Markdown format keeps `![alt](https://…)`. Local paths (and images inside an uploaded zip)
  are not embedded: the import lists each one with "use a full https link".
- `validateDeck(input, { allowDataImages })`: strict by default (what `/api/decks` POST/PUT
  uses), so the server answers **400** to a deck with an uploaded image, naming the slide. The
  browser passes `allowDataImages: true` on its local paths (JSON import, backup restore, "Make a
  copy" of a shared deck) so **legacy decks keep working locally**. The Share dialog lists the
  slides that still hold uploaded images and blocks Publish / Republish until they are replaced.
- Limits follow: `DECK_MAX_MB` defaults to **1** (text only is small); the size meter is gone.
  The container's `BODY_SIZE_LIMIT=16M` and nginx's `client_max_body_size 16m` are left as they
  are (still above the limit; lowering them would need the owner to re-apply the live nginx
  block and change the wizard's 2 MB proof).
- Rendering: `SlideView` images get `referrerpolicy="no-referrer"` (many hosts block hotlinks by
  referrer), `decoding="async"` and `loading="lazy"` (exports switch them to eager). A link that
  fails still draws the quiet missing-image frame.
- Downloads: JPG / PDF draw slides on a canvas, which a cross-origin image would taint. Each
  image is fetched with `mode: 'cors'` and inlined as a `data:` URL **only for the export**; a
  host that refuses CORS gets the missing-image frame and the export ends with a toast saying how
  many images were left out. The HTML download inlines the same way and otherwise keeps the link
  (it shows when the file is opened online).
- **No server image proxy.** It would turn the app into an open fetcher (SSRF) and move every
  viewer's image bandwidth onto the VPS, which is exactly the cost this decision removes.

## Consequences

- Published decks are a few KB; the store's 2 GB lasts practically forever, and viewers on
  mobile data only download text plus the images on the slides they look at.
- **Hotlink breakage**: an image is only as alive as its link. A site can delete the file,
  rename it, or block hotlinking (most do it by referrer, which `no-referrer` sidesteps; some
  check cookies or user agent). The slide then shows its alt text in the missing-image frame.
  Wikimedia Commons (`upload.wikimedia.org`) is the recommended source. Links through
  `Special:FilePath` work in slides, but their redirects carry no CORS headers, so exports can't
  inline them: use the direct `upload.wikimedia.org` link.
- **CORS on exports**: JPG / PDF can only include images from hosts that send
  `Access-Control-Allow-Origin`. Others are left out, with a toast.
- **Privacy**: viewers' browsers contact the image hosts directly (IP address, no referrer).
- **Legacy decks**: decks made before this keep their embedded images in the browser and in
  backups, can be presented, exported and downloaded, but cannot be published until each uploaded
  image is replaced with a link. Old `.zip` Markdown exports re-import their text with a warning
  per image. Already-published copies keep rendering until they expire.
- No editing of the picture itself (crop, resize) beyond fit and placement: that was never there.
