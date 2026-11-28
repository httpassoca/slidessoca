---
id: SL-0013
type: task
title: "Fix the Docker build: keep docs/markdown-format.md in the image context"
status: done
priority: high
tags: [deploy, bug]
depends_on: []
parent: null
epic: null
created: 2026-11-28
updated: 2026-11-28
---

## Description

Every Deploy run failed at `RUN pnpm build` inside the image: `.dockerignore` dropped all of
`docs/`, but `src/lib/format-doc.ts` imports `docs/markdown-format.md?raw` (the in-app /format
page and the Markdown example). CI builds outside Docker, so it stayed green.

## Done

- `.dockerignore` drops `docs/*` except `docs/markdown-format.md`.
- `test/unit/dockerignore.test.ts` fails if any file src/ imports from outside src/ is ignored.
- Checked with a local `docker build --target build`.
