# ADR 0001 — Shared decks are gzipped JSON files on the existing VPS

Status: accepted · 2026-11-27

## Context

Share links must work for a month and the product is free, so storage has to cost as close to
nothing as possible. Decks can carry images.

## Decision

- Decks are edited and kept **in the browser** (IndexedDB). Only a _published_ copy goes to the
  server.
- The server is one SvelteKit (adapter-node) container on the VPS that already runs passoca-api,
  trucossoca and guessoca. Published decks are written to a Docker volume as
  `data/decks/<id>.json.gz`. **The file's mtime is its expiry time**; an hourly sweep deletes
  expired files. No database, no object storage, no new bill.
- Images are downscaled to ≤1920px and re-encoded as WebP in the browser before they enter a
  deck, and the JSON is gzipped on disk. Limits: 15 MB per deck, 2 GB for the whole store
  (`507` when full), 30 publishes/hour/IP.
- Ownership without accounts: publishing returns a random 32-char token; the server stores only
  its SHA-256. The publishing browser keeps the token and can republish (same link, restarts the
  30 days) or delete.

## Notes

- 2026-11-27 (SL-0008): the published copy carries **no speaker notes** unless the owner ticks
  "Include speaker notes" in the Share dialog. `publicDeck(deck, { notes })` empties them; the
  choice (`deck.publishNotes`) is local and never sent. The Share dialog measures the exact upload
  against the 15 MB default (`src/lib/deck/limits.ts`, shared with the server, still overridable
  by `DECK_MAX_MB`) and blocks publishing at the limit; picked image files over 20 MB are refused
  before compression.

## Alternatives

- Vercel Blob / S3 / R2: free tiers exist but add an account, a bill risk and egress limits.
- SQLite: fine, but files + mtime already give TTL for free and stay trivially inspectable.

## Consequences

- Losing the browser's IndexedDB loses the editable deck (the shared copy can be re-imported
  as a copy). Accounts/sync would be a later decision.
- A single VPS disk: the quota and the per-deck cap protect the other apps on it.
