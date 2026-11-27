import { describe, expect, it } from 'vitest'
import { draftChangelog, isBump, isSemver } from '../../scripts/release-lib.mjs'

describe('release helpers', () => {
  it('validates semver', () => {
    expect(isSemver('0.1.0')).toBe(true)
    expect(isSemver('1.2.3-rc.1')).toBe(true)
    expect(isSemver('1.2')).toBe(false)
    expect(isSemver('v1.2.3')).toBe(false)
  })

  it('requires a strictly greater version than the last tag', () => {
    expect(isBump('0.2.0', 'v0.1.9')).toBe(true)
    expect(isBump('1.0.0', 'v0.9.9')).toBe(true)
    expect(isBump('0.1.10', 'v0.1.9')).toBe(true)
    expect(isBump('0.1.0', 'v0.1.0')).toBe(false)
    expect(isBump('0.1.0', 'v0.2.0')).toBe(false)
  })

  it('drafts changelog sections from conventional commits', () => {
    const draft = draftChangelog([
      'feat(editor): drag to reorder slides',
      'fix: viewer swipe on iOS',
      'feat!: new share format',
      'chore: bump deps',
      'refactor(layout): simpler grid',
      'random subject',
    ])
    expect(draft).toBe(
      [
        '### Added',
        '',
        '- **editor**: drag to reorder slides',
        '- **Breaking:** new share format',
        '',
        '### Fixed',
        '',
        '- viewer swipe on iOS',
        '',
        '### Changed',
        '',
        '- **layout**: simpler grid',
      ].join('\n'),
    )
    expect(draftChangelog(['chore: x'])).toBe('')
  })
})
