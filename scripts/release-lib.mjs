// Pure helpers for scripts/release.mjs (no git, no fs) so they can be unit-tested.

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/

/** @param {string} v */
export const isSemver = (v) => SEMVER.test(v)

/** @param {string} v @returns {number[]} */
const parts = (v) => v.replace(/^v/, '').split('-')[0].split('.').map(Number)

/**
 * True when `version` is strictly greater than `tag` (major.minor.patch; pre-release ignored).
 * @param {string} version @param {string} tag
 */
export function isBump(version, tag) {
  const [a, b] = [parts(version), parts(tag)]
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

const SECTIONS = /** @type {const} */ ([
  ['Added', ['feat']],
  ['Fixed', ['fix']],
  ['Changed', ['perf', 'refactor']],
  ['Docs', ['docs']],
])

const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/

/**
 * Drafts Keep-a-Changelog sections from conventional commit subjects. `chore`/`ci`/`test`/`style`
 * commits and non-conventional subjects are left out; breaking changes (`!`) are marked.
 * @param {string[]} subjects
 * @returns {string}
 */
export function draftChangelog(subjects) {
  /** @type {Record<string, string[]>} */
  const out = {}
  for (const subject of subjects) {
    const m = CONVENTIONAL.exec(subject.trim())
    if (!m) continue
    const [, type, scope, bang, text] = m
    const section = SECTIONS.find(([, types]) =>
      /** @type {readonly string[]} */ (types).includes(type),
    )
    if (!section) continue
    const line = `- ${bang ? '**Breaking:** ' : ''}${scope ? `**${scope}**: ` : ''}${text}`
    ;(out[section[0]] ??= []).push(line)
  }
  return SECTIONS.filter(([name]) => out[name])
    .map(([name]) => `### ${name}\n\n${out[name].join('\n')}`)
    .join('\n\n')
}
