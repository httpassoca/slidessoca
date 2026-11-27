---
id: SL-0005
type: story
title: "Development and production on the VPS"
status: in-progress
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

- [x] CI `test` job: lint, format, check, test, build.
- [x] Dockerfile (adapter-node, data volume, healthcheck, BODY_SIZE_LIMIT).
- [x] Deploy workflow: develop → dev container (:3005), main → prod container (:3004); image built
      in CI, never on the VPS; probe after start; skips cleanly when SSH secrets are missing.
- [x] nginx blocks + wizard for DNS/certs/secrets (written).
- [ ] Owner runs `bash deploy/wizard.sh` (secrets, DNS, nginx, certbot, first deploys, HTTPS proof).
- [x] Branch protection on main/develop.
- [x] Documentation updated (README, CLAUDE.md).

## Notes

- 2026-11-27: Dockerfile (node:24-slim, multi-stage, non-root, `LABEL app=slidessoca`, healthcheck),
  `deploy.yml` (develop → `development`/:3005, main → `production`/:3004, image built and
  smoke-tested in CI, probe after start, "skipped deploy (no secrets)" notice), nginx blocks,
  `deploy/wizard.sh`, `pnpm release`, `docs/deploy.md`. Branch protection (`test` required) was
  already on `main` and `develop`. Remaining: the owner runs the wizard.
