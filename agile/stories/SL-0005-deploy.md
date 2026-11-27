---
id: SL-0005
type: story
title: "Development and production on the VPS"
status: todo
priority: high
tags: [infra, ci]
depends_on: [SL-0001]
parent: null
epic: null
created: 2026-11-27
updated: 2026-11-27
---

## Description

As the owner, I want develop to deploy to slides-dev.passoca.dev and main to slides.passoca.dev,
cheaply, on the VPS that already runs my other apps, with CI guarding every PR.

## Acceptance criteria

- [ ] CI `test` job: lint, format, check, test, build.
- [ ] Dockerfile (adapter-node, data volume, healthcheck, BODY_SIZE_LIMIT).
- [ ] Deploy workflow: develop → dev container (:3005), main → prod container (:3004); image built
      in CI, never on the VPS; probe after start; skips cleanly when SSH secrets are missing.
- [ ] nginx blocks + wizard for DNS/certs/secrets.
- [ ] Branch protection on main/develop.
- [ ] Documentation updated (README, CLAUDE.md).
