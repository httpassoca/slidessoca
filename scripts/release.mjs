#!/usr/bin/env node
/**
 * Release helper (SL-0005). Encodes the git-flow release, it does not replace it:
 *
 *   release/x.y.z (off develop) → PR into main → tag vX.Y.Z + GitHub release → back-merge into develop
 *
 * Usage: pnpm release
 *   1. validates package.json#version is semver and greater than the last v* tag
 *   2. checks you are on release/<version>
 *   3. drafts a CHANGELOG section from conventional commits since the last tag (printed, not
 *      written: paste it under `## [x.y.z] — date` and fold in the [Unreleased] bullets)
 *   4. prints the remaining steps. Merging into main deploys slides.passoca.dev (deploy.yml).
 * Read-only: it never commits, tags or pushes. No npm publish (the package is private).
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { draftChangelog, isBump, isSemver } from './release-lib.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** @param {string} cmd */
const sh = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8' }).trim()
/** @param {string} msg */
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
if (!isSemver(version)) fail(`package.json version "${version}" is not semver`)

const lastTag = sh('git tag --sort=-v:refname --list "v*"').split('\n')[0] || ''
if (lastTag && !isBump(version, lastTag)) {
  fail(`version ${version} is not greater than the last tag ${lastTag} — bump package.json first`)
}
console.log(`✓ version ${version}${lastTag ? ` > ${lastTag}` : ' (first release)'}`)

const branch = sh('git rev-parse --abbrev-ref HEAD')
if (branch === `release/${version}`) console.log(`✓ on release/${version}`)
else console.warn(`! on "${branch}"; create the branch: git checkout -b release/${version} develop`)
if (sh('git status --porcelain')) console.warn('! working tree is not clean')

const range = lastTag ? `${lastTag}..HEAD` : 'HEAD'
const subjects = sh(`git log ${range} --no-merges --format=%s`).split('\n').filter(Boolean)
const today = new Date().toISOString().slice(0, 10)
const draft = draftChangelog(subjects) || '_(no feat/fix/perf/refactor/docs commits)_'

console.log(
  `\n── CHANGELOG draft ─────────────────────────────\n\n## [${version}] — ${today}\n\n${draft}\n`,
)
console.log(`── next steps ──────────────────────────────────
1. Move the [Unreleased] bullets under ## [${version}] in CHANGELOG.md, polish, commit:
     git commit -am "chore(release): ${version}"
2. git push -u origin release/${version}
   gh pr create --base main --title "release: ${version}"
3. Merge when \`test\` is green → Deploy ships slides.passoca.dev. Then tag and release:
     git fetch origin && git tag v${version} origin/main && git push origin v${version}
     gh release create v${version} --title "v${version}" --notes-file <the CHANGELOG section>
4. Back-merge: gh pr create --base develop --head main --title "chore: back-merge v${version}"
`)
