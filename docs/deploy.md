# Deploy

slidessoca runs as one Docker container per environment on the VPS that already hosts
passoca-api, trucossoca and guessoca ([ADR 0001](adr/0001-storage-on-the-vps.md)). nginx on the
VPS terminates HTTPS and proxies to the container on the loopback interface.

## Environments

| Branch    | Environment (GitHub) | URL                            | Container        | Host port        | Image               | Volume                | Dir on VPS             |
| --------- | -------------------- | ------------------------------ | ---------------- | ---------------- | ------------------- | --------------------- | ---------------------- |
| `main`    | `production`         | https://slides.passoca.dev     | `slidessoca`     | `127.0.0.1:3004` | `slidessoca:latest` | `slidessoca-data`     | `~/dev/slidessoca`     |
| `develop` | `development`        | https://slides-dev.passoca.dev | `slidessoca-dev` | `127.0.0.1:3005` | `slidessoca:dev`    | `slidessoca-dev-data` | `~/dev/slidessoca-dev` |

Inside the container the app listens on `3000` with `DATA_DIR=/app/data` (the volume) and
`BODY_SIZE_LIMIT=16M`; it runs as the unprivileged `node` user. `ORIGIN` is set per environment
by the `docker:start:*` scripts in `package.json`. Extra env (e.g. `DECK_TTL_DAYS`,
`STORE_MAX_MB`, see `.env.example`) goes in `~/.slidessoca.env` / `~/.slidessoca-dev.env` on the
VPS; the start scripts pass it with `--env-file` when the file exists.

## Pipeline

- **CI** (`.github/workflows/ci.yml`, job `test`, the required check on `main` and `develop`):
  lint → format → check → test → build, on every PR and push.
- **Deploy** (`.github/workflows/deploy.yml`) on every push to `develop` or `main` (or by hand,
  _Run workflow_):
  1. checks that the `SSH_HOST` / `SSH_USER` / `SSH_KEY` secrets exist. Without them the run
     still tests and builds, then ends with the notice **"skipped deploy (no secrets)"** — green,
     not failed;
  2. installs, lints, format-checks, type-checks and tests;
  3. builds the image **in CI** (never on the VPS: a build there starves the other apps of
     memory), `docker save | gzip` → `slidessoca.tar.gz`, and smoke-tests it on the runner;
  4. `scp` the tarball + `package.json` to the environment's dir on the VPS, then over SSH:
     `npm run docker:load`, `docker:stop:<env>`, `docker:start:<env>`, probe `/health` and `/`
     for 30 s (prints `docker ps` + logs and fails if the app isn't serving), and prune only
     dangling images labelled `app=slidessoca`.

  Runs are serialised per branch (`concurrency`), never cancelled mid-deploy. If
  `appleboy/scp-action` or `ssh-action` fails with a 504 while downloading its binary, re-run the
  job.

## The data volume

Published decks are `decks/<id>.json.gz` in the volume. **The file's mtime is its expiry**:
publishing or republishing sets it to now + 30 days (`DECK_TTL_DAYS`), and the app deletes
expired files at boot and every hour. There is nothing else to clean up. Limits: 15 MB per deck
(`DECK_MAX_MB`), 2 GB for the store (`STORE_MAX_MB`, `507` when full), 30 publishes/hour/IP.

On the VPS:

```sh
# Size and count
docker exec slidessoca sh -c 'du -sh /app/data; ls /app/data/decks | wc -l'
# Expiry dates (mtime) of the newest decks
docker exec slidessoca sh -c 'ls -lt --time-style=+%F /app/data/decks | head'
# Read one deck
docker exec slidessoca sh -c 'gunzip -c /app/data/decks/<id>.json.gz' | head -c 500
# Backup (tar keeps the mtimes, i.e. the expiry dates)
docker run --rm -v slidessoca-data:/data -v "$PWD":/backup busybox tar czf /backup/slidessoca-data.tgz -C /data .
# Restore into the (stopped) container's volume
docker run --rm -v slidessoca-data:/data -v "$PWD":/backup busybox tar xzf /backup/slidessoca-data.tgz -C /data
```

Use `slidessoca-dev` / `slidessoca-dev-data` for development. The volume survives redeploys;
`docker volume rm` deletes every shared deck.

## First-time setup: the wizard

Everything that needs the owner's hands lives in one script:

```sh
bash deploy/wizard.sh
```

1. **GitHub secrets** `SSH_HOST`, `SSH_USER`, `SSH_KEY` for this repo (same key as guessoca),
   then an SSH test (docker, npm, nginx, ports 3004/3005 free).
2. **DNS**: A records `slides` and `slides-dev` → the VPS IP.
3. **nginx**: copies `deploy/slides.passoca.dev.nginx` and `deploy/slides-dev.passoca.dev.nginx`
   to the VPS and prints the `sudo` commands to enable them (`client_max_body_size 16m`,
   `X-Real-IP`; the app trusts `X-Real-IP` only because nginx is the sole client of the
   loopback ports).
4. **certbot** for both domains.
5. **First deploys** of `develop` and `main` (`gh workflow run deploy.yml`).
6. **Proof** over HTTPS: `/health`, the app shell, and a 2 MB POST that must not get nginx's 413.

Its answers are saved in `deploy/.wizard.env` (git-ignored), so it can be re-run.

## Releasing

git-flow, as in dssoca, without the npm publish:

```sh
git checkout -b release/x.y.z origin/develop
# bump "version" in package.json
pnpm release      # validates the bump vs the last v* tag + the branch, drafts the CHANGELOG section
```

Then follow the steps it prints: move the `[Unreleased]` bullets under `## [x.y.z]`, PR
`release/x.y.z` into `main` (merging deploys production), tag `vX.Y.Z` on `main` +
`gh release create`, and back-merge `main` into `develop`.

## Manual operation on the VPS

```sh
cd ~/dev/slidessoca          # or ~/dev/slidessoca-dev
npm run docker:stop:prod     # / docker:stop:dev
npm run docker:start:prod    # / docker:start:dev
docker logs --tail 100 slidessoca
```

Rollback: re-run an older green Deploy run on `main` (_Re-run all jobs_), or revert on `main`.
